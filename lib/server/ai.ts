import "server-only";
import { APICallError, type LanguageModelUsage } from "ai";
import { z } from "zod";
import { callLLM } from "@/lib/ai/llm";
import { normalizeUsage } from "@/lib/usage/normalize";
import type { ThinkingConfig } from "@/lib/types/provider";
import { resolveModel } from "./resolve-model";
import { AIConfigurationError } from "./provider-config";
import {
  startRequest,
  finishRequest,
  RequestStorageError,
  type RequestBody,
} from "./ai-requests";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});
const inputSchema = z
  .object({
    prompt: z.string().trim().min(1).optional(),
    messages: z.array(messageSchema).min(1).optional(),
    system: z.string().optional(),
    model: z.string().min(1).optional(),
    source: z.string().trim().min(1).max(80).default("backend-chat"),
    // Task policy belongs to the caller. Omitted settings stay omitted.
    maxOutputTokens: z.number().int().positive().optional(),
    // Node timers overflow above a signed 32-bit delay; this is a runtime limit,
    // not a task timeout. Do not introduce a default or a business-specific cap.
    timeoutMs: z.number().int().positive().max(2_147_483_647).optional(),
    maxRetries: z.number().int().nonnegative().optional(),
  })
  .refine((input) => Boolean(input.prompt) !== Boolean(input.messages), {
    message: "提供一个问题或一组对话记录，不能同时提供两者",
  });

export class BackendAIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendAIError";
  }
}

export type ChatOptions = z.input<typeof inputSchema> & {
  signal?: AbortSignal;
  thinking?: ThinkingConfig;
};

/** Common server entry: persist before calling, and await final persistence before returning. */
export async function chat(options: ChatOptions) {
  const parsed = inputSchema.safeParse(options);
  if (!parsed.success)
    throw new BackendAIError(
      "INVALID_INPUT",
      "请提供有效的问题或对话记录，并检查输出长度和超时设置",
    );
  const input = parsed.data;
  const requestedModel = input.model ?? process.env.DEFAULT_MODEL;
  const body: RequestBody = {
    system: input.system,
    messages: input.messages ?? [{ role: "user", content: input.prompt! }],
    maxOutputTokens: input.maxOutputTokens,
    timeoutMs: input.timeoutMs,
    maxRetries: input.maxRetries,
    // Copy only known settings; never persist arbitrary caller objects or credentials.
    thinking: options.thinking
      ? {
          mode: options.thinking.mode,
          enabled: options.thinking.enabled,
          effort: options.thinking.effort,
          level: options.thinking.level,
          budgetTokens: options.thinking.budgetTokens,
          excludeReasoningOutput: options.thinking.excludeReasoningOutput,
        }
      : undefined,
  };
  const requestId = await startRequest({
    source: input.source,
    requestedModel,
    body,
  });
  const started = performance.now();
  let selected: ReturnType<typeof resolveModel> | undefined;
  let usage: LanguageModelUsage | undefined;
  let text: string | undefined;
  let finishReason: string | undefined;
  let failure: BackendAIError | AIConfigurationError | undefined;
  try {
    selected = resolveModel({ modelString: input.model });
    const signals = [
      ...(options.signal ? [options.signal] : []),
      ...(input.timeoutMs !== undefined
        ? [AbortSignal.timeout(input.timeoutMs)]
        : []),
    ];
    const abortSignal =
      signals.length > 1 ? AbortSignal.any(signals) : signals[0];
    const result = await callLLM(
      {
        model: selected.model,
        system: input.system,
        messages: body.messages,
        ...(input.maxOutputTokens !== undefined
          ? { maxOutputTokens: input.maxOutputTokens }
          : {}),
        ...(input.maxRetries !== undefined
          ? { maxRetries: input.maxRetries }
          : {}),
        ...(abortSignal ? { abortSignal } : {}),
      },
      input.source,
      undefined,
      options.thinking,
    );
    // Keep billed usage even when the response is truncated or empty.
    usage = result.totalUsage;
    text = result.text;
    finishReason = result.finishReason;
    if (result.finishReason === "length")
      throw new BackendAIError(
        "OUTPUT_LIMIT",
        "回答达到长度上限，请增加输出长度或缩短任务",
      );
    if (!result.text.trim())
      throw new BackendAIError(
        "EMPTY_OUTPUT",
        "模型没有返回有效文字，请检查模型或思考设置",
      );
  } catch (error) {
    failure = safeAIError(error);
  }
  await finishRequest(requestId, {
    status: failure
      ? failure instanceof BackendAIError && failure.code === "ABORTED"
        ? "cancelled"
        : "failed"
      : "succeeded",
    provider: selected?.providerId,
    model: selected?.modelId,
    text,
    finishReason,
    usage,
    durationMs: performance.now() - started,
    errorCode:
      failure instanceof BackendAIError
        ? failure.code
        : failure
          ? "CONFIGURATION_ERROR"
          : undefined,
    errorMessage: failure?.message,
  });
  if (failure) throw failure;
  return {
    requestId,
    text: text!,
    provider: selected!.providerId,
    model: selected!.modelId,
    usage: normalizeUsage(usage),
  };
}

export { RequestStorageError };

function safeAIError(error: unknown): BackendAIError | AIConfigurationError {
  if (error instanceof BackendAIError || error instanceof AIConfigurationError)
    return error;
  if (APICallError.isInstance(error)) {
    const messages: Record<number, string> = {
      401: "模型服务拒绝了密钥，请检查密钥是否正确",
      402: "模型账户余额或额度不足，请检查服务商账户",
      403: "当前账号没有调用该模型的权限",
      404: "模型名称或服务地址不正确",
      429: "模型服务请求过多或额度受限，请稍后重试",
    };
    return new BackendAIError(
      `HTTP_${error.statusCode ?? "ERROR"}`,
      messages[error.statusCode ?? 0] ?? "模型服务暂时不可用，请稍后重试",
    );
  }
  if (
    error instanceof Error &&
    ["AbortError", "TimeoutError"].includes(error.name)
  )
    return new BackendAIError("ABORTED", "模型请求已取消或超过等待时间");
  // Never expose driver/SDK errors: they may contain request headers or response bodies.
  return new BackendAIError(
    "REQUEST_FAILED",
    "模型调用未完成，请检查网络与服务配置",
  );
}
