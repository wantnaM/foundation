import "server-only";
import path from "node:path";
import { resolveAI } from "../ai/config";

export const dataDir = () =>
  // Runtime uploads are created on the host, never bundled into the web build.
  path.resolve(
    /* turbopackIgnore: true */ process.env.GRADING_DATA_DIR || ".grading-data",
  );
export function mode(): "demo" | "live" {
  const value = process.env.GRADING_MODE || "demo";
  if (value !== "demo" && value !== "live")
    throw new Error("GRADING_MODE 只能为 demo 或 live");
  return value;
}
export function serviceConfig() {
  const ocr = process.env.GRADING_OCR_URL;
  const base = process.env.GRADING_AI_BASE_URL;
  const key = process.env.GRADING_AI_API_KEY;
  const model = process.env.GRADING_AI_MODEL;
  if (!ocr)
    throw new Error("真实服务尚未配置完整，请检查 OCR 地址及模型环境变量");
  for (const stage of [
    "grading.questions",
    "grading.answers",
    "grading.score",
  ]) {
    const selected = resolveAI(stage, true);
    if (selected.provider.type === "demo" || !selected.model.vision)
      throw new Error("真实服务尚未配置完整，请配置支持图片输入的真实模型");
  }
  for (const value of [ocr]) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("服务地址必须使用 HTTP 或 HTTPS");
  }
  return { ocr, base: base?.replace(/\/$/, ""), key, model };
}
export const leaseMs = 90000;
