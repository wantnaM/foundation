import "server-only";
import { randomUUID } from "node:crypto";
import type { LanguageModelUsage } from "ai";
import { query } from "./db";

export type RequestStatus = "running" | "succeeded" | "failed" | "cancelled";
export type RequestBody = {
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  thinking?: {
    mode?: string;
    enabled?: boolean;
    budgetTokens?: number;
    effort?: string;
    level?: string;
    excludeReasoningOutput?: boolean;
  };
};

export class RequestStorageError extends Error {
  constructor(public readonly phase: "start" | "finish") {
    super(
      phase === "start"
        ? "请求记录无法保存，尚未调用模型，请检查数据库连接并运行 pnpm db:migrate"
        : "模型调用已结束，但记录更新失败；请先检查数据库，避免直接重试产生重复费用",
    );
    this.name = "RequestStorageError";
  }
}

export async function startRequest(input: {
  source: string;
  requestedModel?: string;
  body: RequestBody;
}) {
  const id = randomUUID();
  try {
    await query(
      "INSERT INTO ai_requests(id, source, requested_model, request_body) VALUES ($1, $2, $3, $4::jsonb)",
      [
        id,
        input.source,
        input.requestedModel ?? null,
        JSON.stringify(input.body),
      ],
    );
    return id;
  } catch {
    throw new RequestStorageError("start");
  }
}

function token(value: number | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export async function finishRequest(
  id: string,
  result: {
    status: Exclude<RequestStatus, "running">;
    provider?: string;
    model?: string;
    text?: string;
    finishReason?: string;
    durationMs: number;
    usage?: LanguageModelUsage;
    errorCode?: string;
    errorMessage?: string;
  },
) {
  const usage = result.usage;
  try {
    const saved = await query(
      `UPDATE ai_requests SET completed_at = clock_timestamp(), status = $2,
      provider_id = $3, model_id = $4, response_text = $5, finish_reason = $6, duration_ms = $7,
      input_tokens = $8, output_tokens = $9, cache_read_tokens = $10, cache_creation_tokens = $11,
      reasoning_tokens = $12, error_code = $13, error_message = $14 WHERE id = $1 AND status = 'running'`,
      [
        id,
        result.status,
        result.provider ?? null,
        result.model ?? null,
        result.text ?? null,
        result.finishReason ?? null,
        Math.round(result.durationMs),
        token(usage?.inputTokens),
        token(usage?.outputTokens),
        token(
          usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens,
        ),
        token(usage?.inputTokenDetails?.cacheWriteTokens),
        token(
          usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens,
        ),
        result.errorCode ?? null,
        result.errorMessage ?? null,
      ],
    );
    if (saved.rowCount !== 1)
      throw new Error("Request already finalized or missing");
  } catch {
    throw new RequestStorageError("finish");
  }
}

export type RequestRow = {
  id: string;
  started_at: Date;
  completed_at: Date | null;
  status: RequestStatus;
  source: string;
  requested_model: string | null;
  provider_id: string | null;
  model_id: string | null;
  duration_ms: number | null;
  input_tokens: string | null;
  output_tokens: string | null;
  cache_read_tokens: string | null;
  cache_creation_tokens: string | null;
  reasoning_tokens: string | null;
  error_code: string | null;
  error_message: string | null;
  preview: string;
};
export type RequestDetail = Omit<RequestRow, "preview"> & {
  request_body: RequestBody;
  response_text: string | null;
  finish_reason: string | null;
};

export async function listRequests(
  page = 1,
  status?: RequestStatus,
  requestedPageSize = 20,
  modelSearch = "",
) {
  const pageSize = [10, 20, 30, 40, 50].includes(requestedPageSize)
    ? requestedPageSize
    : 20;
  const filter = status ?? null;
  const modelFilter = modelSearch.trim() || null;
  const matches = `($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR
    strpos(lower(CASE WHEN provider_id IS NOT NULL AND model_id IS NOT NULL
      THEN provider_id || ':' || model_id ELSE COALESCE(requested_model, '') END), lower($2)) > 0)`;
  const counts = await query<{
    total: string;
    succeeded: string;
    failed: string;
    average: string | null;
    filtered: string;
  }>(
    `SELECT count(*) AS total, count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
      count(*) FILTER (WHERE status IN ('failed', 'cancelled')) AS failed,
      round(avg(duration_ms))::text AS average, count(*) FILTER (WHERE ${matches}) AS filtered FROM ai_requests`,
    [filter, modelFilter],
  );
  const summary = counts.rows[0];
  const pages = Math.max(1, Math.ceil(Number(summary.filtered) / pageSize));
  const currentPage = Math.max(
    1,
    Math.min(pages, Number.isSafeInteger(page) ? page : 1),
  );
  const result = await query<RequestRow>(
    `SELECT id, started_at, completed_at, status, source, requested_model,
    provider_id, model_id, duration_ms, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
    reasoning_tokens, error_code, error_message, left(COALESCE(request_body->'messages'->-1->>'content', ''), 100) AS preview
    FROM ai_requests WHERE ${matches} ORDER BY started_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [filter, modelFilter, pageSize, (currentPage - 1) * pageSize],
  );
  return { rows: result.rows, summary, page: currentPage, pages, pageSize };
}

export async function getRequest(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null;
  const result = await query<RequestDetail>(
    "SELECT * FROM ai_requests WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}
