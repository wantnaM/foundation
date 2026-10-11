import { z } from "zod";
import { isAIAdmin, loginAIAdmin, logoutAIAdmin } from "@/lib/server/ai/admin";
import { publicAIConfig, saveAIConfig } from "@/lib/server/ai/config";
import { aiReport } from "@/lib/server/ai/store";
import { generateAI } from "@/lib/server/ai/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  if (!(await isAIAdmin()))
    return response({ error: "请先登录 AI 管理中心" }, 401);
  try {
    return response({ ...publicAIConfig(), ...aiReport() });
  } catch {
    return response({ error: "读取公共 AI 配置失败，请检查服务端配置" }, 503);
  }
}
export async function POST(request: Request) {
  if (
    request.headers.get("origin") !==
    (process.env.AI_APP_ORIGIN || new URL(request.url).origin)
  )
    return response({ error: "请求来源不匹配" }, 403);
  try {
    if (Number(request.headers.get("content-length") || 0) > 100000)
      return response({ error: "配置内容过大" }, 413);
    const raw = await request.text();
    if (raw.length > 100000) return response({ error: "配置内容过大" }, 413);
    const body = z
      .object({
        action: z.enum(["login", "logout", "save", "probe"]),
        password: z.string().max(256).optional(),
        config: z.unknown().optional(),
      })
      .parse(JSON.parse(raw));
    if (body.action === "login") {
      await loginAIAdmin(body.password || "");
      return response({ ok: true });
    }
    if (!(await isAIAdmin()))
      return response({ error: "请先登录 AI 管理中心" }, 401);
    if (body.action === "logout") {
      await logoutAIAdmin();
      return response({ ok: true });
    }
    if (body.action === "save") {
      saveAIConfig(body.config);
      return response({ ok: true });
    }
    const result = await generateAI({
      ownerId: "platform-admin",
      module: "platform",
      stage: "probe",
      system: "请简短回复连接成功。",
      messages: [{ role: "user", content: "测试连接" }],
      signal: request.signal,
    });
    return response({ id: result.id, text: result.value, demo: result.demo });
  } catch (error) {
    // Never serialize SDK errors, provider response bodies or credentials.
    if (error instanceof z.ZodError)
      return response(
        { error: "配置或填写内容不符合要求，请检查模型编号、路由及服务地址" },
        400,
      );
    const known =
      error instanceof Error &&
      /^(管理员密码不正确|尝试过于频繁|请先设置至少|当前由环境变量)/.test(
        error.message,
      );
    return response(
      {
        error: known
          ? error.message
          : "操作未完成，请检查配置及密钥；调用失败可在日志中查看状态",
      },
      400,
    );
  }
}
