import "server-only";
import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { db } from "./store";
import { mode } from "./config";
import type { Teacher } from "@/types/grading";

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const cookieName = "grading-session";
const tokenHash = (token: string) =>
  createHash("sha256").update(`${mode()}:${token}`).digest("hex");
export function accounts() {
  if (process.env.GRADING_ACCOUNTS)
    return z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          password: z.string().min(12),
        }),
      )
      .min(1)
      .parse(JSON.parse(process.env.GRADING_ACCOUNTS));
  if (mode() === "live")
    throw new HttpError("请先配置教师账户，真实模式不启用演示账户", 503);
  return [
    { id: "teacher", name: "林老师", password: "demo-teacher" },
    { id: "teacher2", name: "陈老师", password: "demo-teacher" },
  ];
}
export async function teacher(): Promise<Teacher | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const row = db()
    .prepare("SELECT owner,name FROM sessions WHERE token=? AND expires>?")
    .get(tokenHash(token), Date.now()) as
    { owner: string; name: string } | undefined;
  const account = row ? accounts().find((a) => a.id === row.owner) : undefined;
  return account ? { id: account.id, name: account.name } : null;
}
export async function requireTeacher() {
  const user = await teacher();
  if (!user) throw new HttpError("请先登录批改工作台", 401);
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected =
    process.env.GRADING_APP_ORIGIN || new URL(request.url).origin;
  if (origin !== expected)
    throw new HttpError("请求来源不匹配，请从工作台重试", 403);
}
export async function login(id: string, password: string) {
  const limits = db()
    .prepare("SELECT failures,reset_at FROM login_limits WHERE account=?")
    .get(id) as { failures: number; reset_at: number } | undefined;
  if (limits && limits.reset_at > Date.now() && limits.failures >= 8)
    throw new HttpError("尝试过于频繁，请 15 分钟后重试", 429);
  const account = accounts().find((a) => a.id === id);
  const actual = scryptSync(password, "grading-account-verification", 32);
  const expected = scryptSync(
    account?.password || randomBytes(24).toString("hex"),
    "grading-account-verification",
    32,
  );
  if (!account || !timingSafeEqual(actual, expected)) {
    const failures =
      limits && limits.reset_at > Date.now() ? limits.failures + 1 : 1;
    db()
      .prepare(
        "INSERT INTO login_limits VALUES (?,?,?) ON CONFLICT(account) DO UPDATE SET failures=excluded.failures,reset_at=excluded.reset_at",
      )
      .run(
        id,
        failures,
        limits && limits.reset_at > Date.now()
          ? limits.reset_at
          : Date.now() + 900000,
      );
    throw new HttpError("账户或密码不正确", 401);
  }
  db().prepare("DELETE FROM login_limits WHERE account=?").run(id);
  db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  db()
    .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
    .run(tokenHash(token), account.id, account.name, Date.now() + 7 * 86400000);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.GRADING_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 7 * 86400,
  });
  return { id: account.id, name: account.name };
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token)
    db().prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(token));
  jar.delete(cookieName);
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: "填写内容不完整或格式不正确，请检查后重试" },
      { status: 400 },
    );
  console.error(
    "grading request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "操作未完成，请刷新后重试；若仍失败请检查服务配置" },
    { status: 500 },
  );
}
