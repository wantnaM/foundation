import { z } from "zod";
import {
  teacher,
  requireTeacher,
  login,
  logout,
  sameOrigin,
  errorResponse,
  HttpError,
} from "@/lib/server/grading/auth";
import { mode } from "@/lib/server/grading/config";
import { listTasks } from "@/lib/server/grading/store";
import { createTask, ownedTask, act } from "@/lib/server/grading/tasks";
import { materialBytes } from "@/lib/server/grading/files";
import { csvReport, pdfReport } from "@/lib/server/grading/exports";
import type { Task } from "@/types/grading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const publicTask = (task: Task) => ({ ...task, parsed: {} });
type Context = { params: Promise<{ path?: string[] }> };
export async function GET(request: Request, context: Context) {
  try {
    const parts = (await context.params).path || [];
    if (parts[0] === "session")
      return Response.json({ teacher: await teacher(), mode: mode() });
    const user = await requireTeacher();
    if (!parts.length)
      return Response.json({ tasks: listTasks(user.id).map(publicTask) });
    if (parts[0] !== "tasks" || !parts[1])
      throw new HttpError("页面不存在", 404);
    const task = ownedTask(parts[1], user);
    if (parts[2] === "files" && parts[3]) {
      const file = task.materials.find((m) => m.id === parts[3]);
      if (!file) throw new HttpError("文件不存在", 404);
      return new Response(new Uint8Array(await materialBytes(task, file.id)), {
        headers: {
          "Content-Type": file.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        },
      });
    }
    if (parts[2] === "export") {
      if (!["review", "completed"].includes(task.status))
        throw new HttpError("任务尚未完成，暂不能导出", 409);
      const format = new URL(request.url).searchParams.get("format");
      const filename = `${task.title}${task.mode === "demo" ? "-演示" : task.status !== "completed" ? "-预览" : "-最终"}`;
      const pdf = format === "pdf";
      return new Response(
        pdf ? new Uint8Array(await pdfReport(task)) : csvReport(task),
        {
          headers: {
            "Content-Type": pdf ? "application/pdf" : "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.${pdf ? "pdf" : "csv"}`,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (parts.length === 2) return Response.json({ task: publicTask(task) });
    throw new HttpError("页面不存在", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const parts = (await context.params).path || [];
    if (parts[0] === "login") {
      const input = z
        .object({ id: z.string().max(80), password: z.string().max(300) })
        .parse(await request.json());
      return Response.json({ teacher: await login(input.id, input.password) });
    }
    const user = await requireTeacher();
    if (parts[0] === "logout") {
      await logout();
      return Response.json({ ok: true });
    }
    if (parts[0] === "tasks" && parts.length === 1) {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 105 * 1024 * 1024)
        throw new HttpError("上传总大小超过 100 MB", 413);
      const key = z
        .string()
        .uuid()
        .parse(request.headers.get("idempotency-key"));
      const task = await createTask(user, await request.formData(), key);
      return Response.json({ task: publicTask(task) }, { status: 201 });
    }
    if (parts[0] === "tasks" && parts[1] && parts.length === 2)
      return Response.json({
        task: publicTask(act(ownedTask(parts[1], user), await request.json())),
      });
    throw new HttpError("操作不存在", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
