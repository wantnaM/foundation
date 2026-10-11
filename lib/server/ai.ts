import "server-only";
import { APICallError } from "ai";
import { z } from "zod";
import { callLLM } from "@/lib/ai/llm";
import { normalizeUsage } from "@/lib/usage/normalize";
import type { ThinkingConfig } from "@/lib/types/provider";
import { resolveModel } from "./resolve-model";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(100000),
});
const inputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(100000).optional(),
    messages: z.array(messageSchema).min(1).max(100).optional(),
    system: z.string().max(20000).optional(),
    model: z.string().min(1).optional(),
    source: z.string().trim().min(1).max(80).default("backend-chat"),
    maxOutputTokens: z.number().int().min(1).max(32768).default(4096),
    timeoutMs: z.number().int().min(1000).max(300000).default(60000),
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

/** Server tasks call this directly; no browser, HTTP endpoint or database required. */
export async function chat(options: ChatOptions) {
  const parsed = inputSchema.safeParse(options);
  if (!parsed.success)
    throw new BackendAIError(
      "INVALID_INPUT",
      "请提供有效的问题或对话记录，并检查输出长度和超时设置",
    );
  const input = parsed.data;
  const selected = resolveModel({ modelString: input.model });
  try {
    const result = await callLLM(
      {
        model: selected.model,
        system: input.system,
        messages: input.messages ?? [{ role: "user", content: input.prompt! }],
        maxOutputTokens: input.maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.any([
          AbortSignal.timeout(input.timeoutMs),
          ...(options.signal ? [options.signal] : []),
        ]),
      },
      input.source,
      undefined,
      options.thinking,
    );
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
    return {
      text: result.text,
      provider: selected.providerId,
      model: selected.modelId,
      usage: normalizeUsage(result.totalUsage),
    };
  } catch (error) {
    if (error instanceof BackendAIError) throw error;
    if (APICallError.isInstance(error)) {
      const messages: Record<number, string> = {
        401: "模型服务拒绝了密钥，请检查密钥是否正确",
        402: "模型账户余额或额度不足，请检查服务商账户",
        403: "当前账号没有调用该模型的权限",
        404: "模型名称或服务地址不正确",
        429: "模型服务请求过多或额度受限，请稍后重试",
      };
      throw new BackendAIError(
        `HTTP_${error.statusCode ?? "ERROR"}`,
        messages[error.statusCode ?? 0] ?? "模型服务暂时不可用，请稍后重试",
      );
    }
    if (
      error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name)
    )
      throw new BackendAIError("ABORTED", "模型请求已取消或超过等待时间");
    // Never expose driver/SDK errors: they may contain request headers or response bodies.
    throw new BackendAIError(
      "REQUEST_FAILED",
      "模型调用未完成，请检查网络与服务配置",
    );
  }
}
