import "server-only";
import { randomUUID } from "node:crypto";
import {
  generateText,
  streamText,
  APICallError,
  type ModelMessage,
  type LanguageModelUsage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { resolveAI } from "./config";
import { aiDB } from "./store";

export class AIServiceError extends Error {
  constructor(
    public code: string,
    public retryable = false,
  ) {
    super(
      code === "INVALID_OUTPUT"
        ? "模型结果不符合要求，需要复核"
        : "AI 调用未完成，请检查配置或稍后重试",
    );
  }
}
type CallOptions = {
  ownerId: string;
  module: string;
  stage: string;
  taskId?: string;
  system: string;
  messages: ModelMessage[];
  signal?: AbortSignal;
  requireVision?: boolean;
  liveOnly?: boolean;
  legacyGrading?: boolean;
};
function prepare(options: CallOptions) {
  const resolved = resolveAI(options.stage, options.legacyGrading);
  const { provider, model, apiKey } = resolved;
  if (options.liveOnly && provider.type === "demo")
    throw new Error(
      "真实批改不能使用演示模型，请配置完整的公共模型或原有批改模型",
    );
  if (options.requireVision && !model.vision)
    throw new Error("当前阶段需要支持图片输入的模型");
  const id = randomUUID(),
    start = Date.now();
  const db = aiDB();
  db.prepare(
    "INSERT INTO calls (id,started,owner,task,module,stage,provider,model,status,currency) VALUES (?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    new Date().toISOString(),
    options.ownerId,
    options.taskId ?? null,
    options.module,
    options.stage,
    provider.id,
    model.id,
    "running",
    model.currency,
  );
  let ended = false;
  const finish = (
    status: string,
    usage?: LanguageModelUsage,
    errorCode?: string,
  ) => {
    if (ended) return;
    ended = true;
    const input = usage?.inputTokens ?? null,
      output = usage?.outputTokens ?? null;
    const cost =
      provider.type === "demo"
        ? null
        : input !== null &&
            output !== null &&
            model.inputPrice !== undefined &&
            model.outputPrice !== undefined
          ? (input * model.inputPrice + output * model.outputPrice) / 1_000_000
          : null;
    db.prepare(
      "UPDATE calls SET status=?,duration=?,input_tokens=?,output_tokens=?,estimated_cost=?,error_code=? WHERE id=?",
    ).run(
      status,
      Date.now() - start,
      input,
      output,
      cost,
      errorCode ?? null,
      id,
    );
  };
  const connection = () => {
    const baseURL = provider.baseUrl,
      key = apiKey || "local-no-key";
    switch (provider.type) {
      case "anthropic":
        return createAnthropic({ apiKey: key, baseURL })(model.id);
      case "google":
        return createGoogleGenerativeAI({ apiKey: key, baseURL })(model.id);
      default:
        return createOpenAI({ apiKey: key, baseURL }).chat(model.id);
    }
  };
  return { id, finish, connection, demo: provider.type === "demo" };
}
function classify(error: unknown) {
  if (error instanceof AIServiceError) return error;
  if (APICallError.isInstance(error))
    return new AIServiceError(
      error.statusCode === 200
        ? "INVALID_PROVIDER_RESPONSE"
        : `HTTP_${error.statusCode ?? "NETWORK"}`,
      error.isRetryable,
    );
  return new AIServiceError(
    "REQUEST_FAILED",
    error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name),
  );
}
async function execute<T>(options: CallOptions, parse: (text: string) => T) {
  const call = prepare(options);
  let usage: LanguageModelUsage | undefined;
  try {
    if (call.demo) {
      const value = parse(
        "公共 AI 演示调用已完成。这是固定演示回复，没有调用真实模型。",
      );
      call.finish("demo");
      return { id: call.id, value, demo: true };
    }
    const result = await generateText({
      model: call.connection(),
      system: options.system,
      messages: options.messages,
      maxRetries: 0,
      maxOutputTokens: 4096,
      abortSignal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)])
        : AbortSignal.timeout(45000),
    });
    usage = result.totalUsage;
    if (!result.text.trim()) throw new AIServiceError("INVALID_OUTPUT");
    let value: T;
    try {
      value = parse(result.text);
    } catch {
      throw new AIServiceError("INVALID_OUTPUT");
    }
    call.finish("success", usage);
    return { id: call.id, value, demo: false };
  } catch (error) {
    const safe = classify(error);
    call.finish("failed", usage, safe.code);
    throw safe;
  }
}
export const generateAI = (options: CallOptions) =>
  execute(options, (text) => text);
export async function generateAIJson<T>(
  options: CallOptions,
  schema: z.ZodType<T>,
) {
  return execute(options, (text) =>
    schema.parse(
      JSON.parse(
        text.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""),
      ),
    ),
  );
}
export async function* streamAI(options: CallOptions) {
  const call = prepare(options),
    abort = new AbortController();
  let usage: LanguageModelUsage | undefined,
    completed = false;
  try {
    if (call.demo) {
      yield "公共 AI 演示调用已完成，没有调用真实模型。";
      completed = true;
      call.finish("demo");
      return;
    }
    const result = streamText({
      model: call.connection(),
      system: options.system,
      messages: options.messages,
      maxRetries: 0,
      maxOutputTokens: 4096,
      abortSignal: AbortSignal.any([
        abort.signal,
        AbortSignal.timeout(45000),
        ...(options.signal ? [options.signal] : []),
      ]),
    });
    for await (const event of result.fullStream) {
      if (event.type === "text-delta") yield event.text;
      if (event.type === "error") throw event.error;
      if (event.type === "finish") {
        usage = event.totalUsage;
        completed = true;
      }
    }
    call.finish(completed ? "success" : "cancelled", usage);
  } catch (error) {
    const safe = classify(error);
    call.finish("failed", usage, safe.code);
    throw safe;
  } finally {
    abort.abort();
    if (!completed) call.finish("cancelled", usage, "CANCELLED");
  }
}
