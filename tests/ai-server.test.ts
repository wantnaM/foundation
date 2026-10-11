import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { closeDatabase, query } from "../lib/server/db";
import { migrateDatabase } from "../lib/server/db/migrate";
import {
  getRequest,
  listRequests,
  finishRequest,
  RequestStorageError,
} from "../lib/server/ai-requests";
import { chat, BackendAIError } from "../lib/server/ai";
import { resolveModel } from "../lib/server/resolve-model";
import {
  getServerProviders,
  readServerProviders,
  AIConfigurationError,
  LLM_ENV_MAP,
} from "../lib/server/provider-config";

const runFile = promisify(execFile);
loadEnvConfig(process.cwd());
const schema = `ai_test_${randomUUID().replaceAll("-", "")}`;
let admin: Client;
const folder = mkdtempSync(path.join(tmpdir(), "foundation-ai-server-"));
const filename = path.join(folder, "providers.yml");
const envNames = [
  "NODE_ENV",
  "DEFAULT_MODEL",
  "SERVER_PROVIDERS_FILE",
  "DATABASE_URL",
  ...Object.keys(LLM_ENV_MAP).flatMap((prefix) => [
    `${prefix}_API_KEY`,
    `${prefix}_BASE_URL`,
    `${prefix}_MODELS`,
  ]),
];
const saved = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);
for (const name of envNames)
  if (name !== "DATABASE_URL") delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "test",
  SERVER_PROVIDERS_FILE: filename,
});
before(async () => {
  assert.ok(
    process.env.DATABASE_URL,
    "AI 后端集成测试需要配置 PostgreSQL，测试数据会放入独立临时区域并清理",
  );
  admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  await migrateDatabase();
  await migrateDatabase();
});

after(async () => {
  await closeDatabase();
  if (admin) {
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
  for (const name of envNames) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

test("沿用 OpenMAIC：环境配置按字段覆盖 YAML，公开摘要不含密钥与地址", () => {
  writeFileSync(
    filename,
    "providers:\n  deepseek:\n    apiKey: yaml-test-secret\n    baseUrl: https://yaml.example/v1\n    models: [deepseek-v4-flash]\n",
  );
  process.env.DEFAULT_MODEL = "deepseek:deepseek-v4-flash";
  process.env.DEEPSEEK_API_KEY = "env-test-secret";
  const entry = readServerProviders().deepseek;
  assert.equal(entry.apiKey, "env-test-secret");
  assert.equal(entry.baseUrl, "https://yaml.example/v1");
  assert.deepEqual(entry.models, ["deepseek-v4-flash"]);
  process.env.DEEPSEEK_BASE_URL = "https://env.example/v1";
  assert.equal(
    readServerProviders().deepseek.baseUrl,
    "https://env.example/v1",
  );
  assert.deepEqual(getServerProviders(), {
    deepseek: { models: ["deepseek-v4-flash"] },
  });
  assert.equal(resolveModel().modelId, "deepseek-v4-flash");
  assert.throws(
    () => resolveModel({ modelString: "deepseek:deepseek-v4-pro" }),
    /允许清单/,
  );
  process.env.DEEPSEEK_MODELS = "deepseek-v4-pro, , deepseek-v4-flash";
  assert.equal(
    resolveModel({ modelString: "deepseek:deepseek-v4-pro" }).modelId,
    "deepseek-v4-pro",
  );
});

test("配置错误立即失败，不猜测默认模型或泄漏 YAML 内容", async () => {
  delete process.env.DEFAULT_MODEL;
  assert.throws(resolveModel, /默认模型/);
  assert.throws(
    () => resolveModel({ modelString: "deepseek-flash" }),
    /默认模型/,
  );
  assert.throws(
    () => resolveModel({ modelString: "__proto__:model" }),
    /服务商/,
  );
  writeFileSync(filename, "providers: [invalid-secret");
  assert.throws(
    readServerProviders,
    (error: unknown) =>
      error instanceof AIConfigurationError &&
      !error.message.includes("invalid-secret"),
  );
  writeFileSync(filename, "{}");
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_BASE_URL;
  delete process.env.DEEPSEEK_MODELS;
  assert.throws(
    () => resolveModel({ modelString: "deepseek:deepseek-flash" }),
    /尚未配置/,
  );
  await assert.rejects(
    chat({ prompt: "", messages: [] }),
    (error: unknown) =>
      error instanceof BackendAIError && error.code === "INVALID_INPUT",
  );
  await assert.rejects(
    chat({ prompt: "有效输入但服务商未配置" }),
    AIConfigurationError,
  );
  const failed = (await listRequests(1, "failed")).rows[0];
  assert.equal(failed.error_code, "CONFIGURATION_ERROR");
  assert.equal(failed.input_tokens, null);
});

test("后端真实 SDK 路径：问答、历史消息、错误脱敏、取消和命令行读取 .env.local", async () => {
  let status = 200,
    finishReason = "stop",
    reply = "后端调用成功",
    hasUsage = true,
    responseDelay = 0;
  const calls: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    // Decode once: large Chinese text can split a UTF-8 character across chunks.
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8");
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer backend-test-secret");
    calls.push(JSON.parse(raw));
    if (responseDelay)
      await new Promise((resolve) => setTimeout(resolve, responseDelay));
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        status === 200
          ? {
              id: "backend-test",
              object: "chat.completion",
              created: 1,
              model: "deepseek-flash",
              choices: [
                {
                  index: 0,
                  finish_reason: finishReason,
                  message: { role: "assistant", content: reply },
                },
              ],
              usage: hasUsage
                ? {
                    prompt_tokens: 20,
                    completion_tokens: 5,
                    total_tokens: 25,
                  }
                : undefined,
            }
          : {
              error: {
                message: "private-response backend-test-secret",
                type: "invalid_request_error",
                code: "invalid_api_key",
              },
            },
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    Object.assign(process.env, {
      DEFAULT_MODEL: "deepseek:deepseek-flash",
      DEEPSEEK_API_KEY: "backend-test-secret",
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    });
    const timeoutSpy = mock.method(AbortSignal, "timeout");
    const result = await chat({ prompt: "你好", system: "简短回答" });
    assert.equal(
      timeoutSpy.mock.callCount(),
      0,
      "未指定超时时不得偷偷创建定时取消",
    );
    timeoutSpy.mock.restore();
    assert.equal(result.text, "后端调用成功");
    assert.equal(result.model, "deepseek-flash");
    assert.equal(result.usage.inputTokens, 20);
    const saved = await getRequest(result.requestId);
    assert.equal(saved?.status, "succeeded");
    assert.equal(saved?.input_tokens, "20");
    assert.equal(saved?.response_text, result.text);
    assert.equal(saved?.request_body.messages[0].content, "你好");
    assert.ok(saved?.completed_at);
    assert.ok(!JSON.stringify(saved).includes("backend-test-secret"));
    assert.ok(!Object.hasOwn(saved!.request_body, "maxOutputTokens"));
    assert.ok(!Object.hasOwn(saved!.request_body, "timeoutMs"));
    assert.ok(!Object.hasOwn(saved!.request_body, "maxRetries"));
    assert.ok(!JSON.stringify(result).includes("backend-test-secret"));
    assert.equal(calls[0].model, "deepseek-flash");
    assert.ok(!Object.hasOwn(calls[0], "max_tokens"));
    assert.ok(!Object.hasOwn(calls[0], "max_completion_tokens"));

    const longPrompt = "长".repeat(100001);
    const longSystem = "规".repeat(20001);
    const custom = await chat({
      prompt: longPrompt,
      system: longSystem,
      maxOutputTokens: 131072,
      timeoutMs: 900000,
      maxRetries: 0,
    });
    const customSaved = (await getRequest(custom.requestId))!;
    assert.equal(customSaved.request_body.maxOutputTokens, 131072);
    assert.equal(customSaved.request_body.timeoutMs, 900000);
    assert.equal(customSaved.request_body.maxRetries, 0);
    const customWire = calls.at(-1)!;
    assert.equal(
      customWire.max_tokens ?? customWire.max_completion_tokens,
      131072,
    );
    assert.equal(
      (customWire.messages as { content: string }[])[0].content.length,
      20001,
    );
    assert.equal(
      (customWire.messages as { content: string }[])[1].content.length,
      100001,
    );

    const history = Array.from({ length: 101 }, (_, i) => ({
      role: i % 2 ? ("assistant" as const) : ("user" as const),
      content: `消息${i}`,
    }));
    await chat({ messages: history });
    assert.equal((calls.at(-1)!.messages as unknown[]).length, 101);
    await chat({
      messages: [
        { role: "user", content: "第一次问题" },
        { role: "assistant", content: "之前的回答" },
        { role: "user", content: "继续" },
      ],
    });
    assert.equal((calls.at(-1)!.messages as unknown[]).length, 3);
    status = 401;
    const before = calls.length;
    await assert.rejects(
      chat({ prompt: "错误测试" }),
      (error: unknown) =>
        error instanceof BackendAIError &&
        error.code === "HTTP_401" &&
        !error.message.includes("backend-test-secret") &&
        !error.message.includes("private-response"),
    );
    assert.equal(calls.length, before + 1);
    const failed = (await listRequests(1, "failed")).rows[0];
    assert.equal(failed.error_code, "HTTP_401");
    assert.equal(failed.input_tokens, null);
    assert.ok(
      !JSON.stringify(await getRequest(failed.id)).includes(
        "backend-test-secret",
      ),
    );
    status = 200;
    finishReason = "length";
    await assert.rejects(
      chat({ prompt: "截断测试" }),
      (error: unknown) =>
        error instanceof BackendAIError && error.code === "OUTPUT_LIMIT",
    );
    finishReason = "stop";
    const truncated = (await listRequests(1, "failed")).rows[0];
    assert.equal(truncated.error_code, "OUTPUT_LIMIT");
    assert.equal(truncated.input_tokens, "20");
    assert.equal(
      (await getRequest(truncated.id))?.response_text,
      "后端调用成功",
    );
    reply = "";
    await assert.rejects(
      chat({ prompt: "空结果测试" }),
      (error: unknown) =>
        error instanceof BackendAIError && error.code === "EMPTY_OUTPUT",
    );
    reply = "后端调用成功";
    await assert.rejects(
      chat({ prompt: "取消测试", signal: AbortSignal.abort() }),
      (error: unknown) =>
        error instanceof BackendAIError && error.code === "ABORTED",
    );
    assert.equal((await listRequests(1, "cancelled")).rows.length, 1);

    responseDelay = 80;
    await assert.rejects(
      chat({ prompt: "短任务主动设置超时", timeoutMs: 10 }),
      (error: unknown) =>
        error instanceof BackendAIError && error.code === "ABORTED",
    );
    responseDelay = 0;

    status = 503;
    const beforeNoRetry = calls.length;
    await assert.rejects(chat({ prompt: "任务主动禁止重试", maxRetries: 0 }));
    assert.equal(calls.length, beforeNoRetry + 1);
    const beforeRetry = calls.length;
    await assert.rejects(
      chat({ prompt: "任务主动允许一次重试", maxRetries: 1 }),
    );
    assert.equal(calls.length, beforeRetry + 2);
    const beforeSDKRetry = calls.length;
    await assert.rejects(chat({ prompt: "未指定时沿用当前 SDK 重试策略" }));
    assert.equal(calls.length, beforeSDKRetry + 3);
    status = 200;

    const beforeInvalid = calls.length;
    for (const settings of [
      { maxOutputTokens: 0 },
      { maxOutputTokens: 1.5 },
      { timeoutMs: -1 },
      { timeoutMs: 2147483648 },
      { maxRetries: -1 },
    ]) {
      await assert.rejects(
        chat({ prompt: "非法参数", ...settings }),
        (error: unknown) =>
          error instanceof BackendAIError && error.code === "INVALID_INPUT",
      );
    }
    assert.equal(calls.length, beforeInvalid);

    hasUsage = false;
    const noUsage = await chat({ prompt: "没有用量信息" });
    assert.equal((await getRequest(noUsage.requestId))?.input_tokens, null);
    assert.equal((await getRequest(noUsage.requestId))?.output_tokens, null);
    hasUsage = true;

    // A missing table must prevent a paid model call altogether.
    const beforeStorageFailure = calls.length;
    await query("ALTER TABLE ai_requests RENAME TO ai_requests_unavailable");
    try {
      await assert.rejects(
        chat({ prompt: "入库失败不调用" }),
        (error: unknown) =>
          error instanceof RequestStorageError && error.phase === "start",
      );
      assert.equal(calls.length, beforeStorageFailure);
    } finally {
      await query("ALTER TABLE ai_requests_unavailable RENAME TO ai_requests");
    }

    // Completed rows cannot be overwritten or counted twice.
    await assert.rejects(
      finishRequest(result.requestId, { status: "failed", durationMs: 1 }),
      RequestStorageError,
    );
    assert.equal((await getRequest(result.requestId))?.status, "succeeded");

    // A final write failure remains visibly pending, and never silently reports success.
    await query(
      "CREATE FUNCTION suppress_ai_update() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NULL; END'",
    );
    await query(
      "CREATE TRIGGER suppress_ai_update BEFORE UPDATE ON ai_requests FOR EACH ROW EXECUTE FUNCTION suppress_ai_update()",
    );
    let pendingId: string;
    try {
      const beforeFinalWriteFailure = calls.length;
      await assert.rejects(
        chat({ prompt: "结束入库失败", source: "finish-failure-test" }),
        (error: unknown) =>
          error instanceof RequestStorageError && error.phase === "finish",
      );
      assert.equal(calls.length, beforeFinalWriteFailure + 1);
      const pending = await query(
        "SELECT id, status FROM ai_requests WHERE source = 'finish-failure-test'",
      );
      assert.equal(pending.rows[0].status, "running");
      pendingId = pending.rows[0].id;
    } finally {
      await query("DROP TRIGGER suppress_ai_update ON ai_requests");
      await query("DROP FUNCTION suppress_ai_update()");
    }
    await finishRequest(pendingId!, {
      status: "failed",
      durationMs: 1,
      errorCode: "TEST_ONLY",
    });

    // A separate cwd proves that the CLI loads local configuration, without touching real files.
    const cwd = mkdtempSync(path.join(tmpdir(), "foundation-ai-cli-"));
    writeFileSync(
      path.join(cwd, ".env.local"),
      `DEFAULT_MODEL=deepseek:deepseek-flash\nDEEPSEEK_API_KEY=backend-test-secret\nDEEPSEEK_BASE_URL=http://127.0.0.1:${address.port}/v1\n`,
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "development",
      TSX_TSCONFIG_PATH: path.resolve("tsconfig.json"),
    };
    for (const name of [
      "DEFAULT_MODEL",
      "DEEPSEEK_API_KEY",
      "DEEPSEEK_BASE_URL",
      "SERVER_PROVIDERS_FILE",
    ])
      delete env[name];
    // Avoid creating test usage records while still loading .env.local in the CLI.
    env.VITEST = "1";
    delete env.__NEXT_PROCESSED_ENV;
    const args = [
      "--conditions=react-server",
      "--import",
      pathToFileURL(path.resolve("node_modules/tsx/dist/loader.mjs")).href,
      path.resolve("scripts/ai-chat.ts"),
    ];
    const checked = await runFile(process.execPath, [...args, "--check"], {
      cwd,
      env,
    });
    assert.match(checked.stdout, /deepseek:deepseek-flash/);
    assert.ok(!checked.stdout.includes("backend-test-secret"));
    const called = await runFile(process.execPath, [...args, "你好"], {
      cwd,
      env,
    });
    assert.match(called.stdout, /后端调用成功/);
    assert.match(called.stdout, /已保存/);
    const cliRows = await query(
      "SELECT status, request_body FROM ai_requests WHERE source = 'backend-cli'",
    );
    assert.equal(cliRows.rows.length, 1);
    assert.equal(cliRows.rows[0].status, "succeeded");
    assert.ok(!Object.hasOwn(cliRows.rows[0].request_body, "maxOutputTokens"));
    assert.ok(!Object.hasOwn(cliRows.rows[0].request_body, "timeoutMs"));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("数据库列表分页、筛选、未知状态、无效编号及查询参数不会泄漏数据", async () => {
  assert.equal(await getRequest("invalid-id"), null);
  const before = Number((await listRequests()).summary.total);
  await query(`INSERT INTO ai_requests(id, source, request_body)
    SELECT gen_random_uuid(), 'pagination-test', '{"messages":[{"role":"user","content":"分页测试"}]}'::jsonb FROM generate_series(1, 21)`);
  const first = await listRequests(1, "running");
  assert.equal(first.rows.length, 20);
  assert.equal(first.pages, 2);
  assert.equal(Number(first.summary.total), before + 21);
  const last = await listRequests(999, "running");
  assert.equal(last.page, 2);
  assert.equal(last.rows.length, 1);
  assert.ok(last.rows.every((row) => row.preview === "分页测试"));
  const smaller = await listRequests(2, "running", 10);
  assert.equal(smaller.pageSize, 10);
  assert.equal(smaller.pages, 3);
  assert.equal(smaller.rows.length, 10);
  assert.ok(
    smaller.rows.every(
      (row) =>
        !first.rows.slice(0, 10).some((firstRow) => firstRow.id === row.id),
    ),
  );
  assert.equal((await listRequests(3, "running", 10)).rows.length, 1);
  assert.equal((await listRequests(1, "running", 50)).rows.length, 21);
  assert.equal((await listRequests(1, "running", NaN)).pageSize, 20);
  assert.equal((await listRequests(1, "running", 1000000)).pageSize, 20);
  assert.equal((await listRequests(NaN)).page, 1);
  assert.equal(await getRequest(randomUUID()), null);
});

test("模型名称搜索覆盖所有页、组合状态筛选且按普通文字匹配", async () => {
  await query(`INSERT INTO ai_requests(id, source, requested_model, provider_id, model_id, status, completed_at, request_body)
    SELECT gen_random_uuid(), 'model-search-test', 'original-alias', 'example', 'Alpha-Model', 'succeeded', clock_timestamp(),
      '{"messages":[{"role":"user","content":"模型搜索分页测试"}]}'::jsonb FROM generate_series(1, 21)`);
  await query(`INSERT INTO ai_requests(id, source, requested_model, status, completed_at, request_body)
    VALUES (gen_random_uuid(), 'model-search-test', 'Fallback_Model%Special', 'failed', clock_timestamp(), '{"messages":[]}'::jsonb)`);
  const matches = await listRequests(1, undefined, 10, "  aLPHa  ");
  assert.equal(matches.summary.filtered, "21");
  assert.equal(matches.rows.length, 10);
  assert.equal(matches.pages, 3);
  assert.ok(matches.rows.every((row) => row.model_id === "Alpha-Model"));
  const last = await listRequests(999, "succeeded", 10, "example:alpha-model");
  assert.equal(last.page, 3);
  assert.equal(last.rows.length, 1);
  assert.equal(
    (await listRequests(1, "failed", 10, "alpha")).summary.filtered,
    "0",
  );
  const fallback = await listRequests(1, "failed", 20, "_Model%");
  assert.equal(fallback.summary.filtered, "1");
  assert.equal(fallback.rows[0].requested_model, "Fallback_Model%Special");
  assert.equal(
    (await listRequests(1, undefined, 20, "%")).summary.filtered,
    "1",
  );
  assert.equal(
    (await listRequests(1, undefined, 20, "' OR 1=1 --")).summary.filtered,
    "0",
  );
  assert.equal(
    (await listRequests(1, undefined, 20, "does-not-exist")).summary.filtered,
    "0",
  );
  assert.equal(
    (await listRequests(1, undefined, 20, "   ")).summary.filtered,
    (await listRequests()).summary.filtered,
  );
});
