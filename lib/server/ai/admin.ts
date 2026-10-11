import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { aiDB } from "./store";

const cookieName = "platform-ai-admin";
export const adminDemo = () =>
  !process.env.AI_ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
function password() {
  const value = process.env.AI_ADMIN_PASSWORD;
  if (value && value.length >= 16) return value;
  if (adminDemo()) return "demo-platform-admin";
  throw new Error("请先设置至少 16 位的 AI 管理员密码");
}
const sign = (value: string) =>
  createHmac("sha256", password()).update(value).digest("hex");
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function isAIAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  try {
    const [expires, nonce, signature] = token.split(".");
    return (
      Number(expires) > Date.now() &&
      Number(expires) < Date.now() + 86401000 &&
      Boolean(nonce && signature) &&
      equal(sign(`${expires}.${nonce}`), signature)
    );
  } catch {
    return false;
  }
}
export async function loginAIAdmin(input: string) {
  const db = aiDB(),
    now = Date.now();
  const row = db
    .prepare("SELECT failures,reset_at FROM login_limits WHERE id='admin'")
    .get() as { failures: number; reset_at: number } | undefined;
  if (row && row.reset_at > now && row.failures >= 8)
    throw new Error("尝试过于频繁，请 15 分钟后重试");
  if (!equal(sign(input), sign(password()))) {
    const count = row && row.reset_at > now ? row.failures + 1 : 1;
    db.prepare("INSERT OR REPLACE INTO login_limits VALUES ('admin',?,?)").run(
      count,
      row && row.reset_at > now ? row.reset_at : now + 900000,
    );
    throw new Error("管理员密码不正确");
  }
  db.prepare("DELETE FROM login_limits WHERE id='admin'").run();
  const content = `${now + 86400000}.${randomBytes(24).toString("hex")}`;
  (await cookies()).set(cookieName, `${content}.${sign(content)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.AI_COOKIE_SECURE !== undefined
        ? process.env.AI_COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  });
}
export async function logoutAIAdmin() {
  (await cookies()).delete(cookieName);
}
