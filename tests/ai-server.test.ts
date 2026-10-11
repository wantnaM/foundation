import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { chat, BackendAIError } from "../lib/server/ai";
import { resolveModel } from "../lib/server/resolve-model";
import {
  getServerProviders,
  readServerProviders,
  AIConfigurationError,
  LLM_ENV_MAP,
} from "../lib/server/provider-config";

const runFile = promisify(execFile);
const folder = mkdtempSync(path.join(tmpdir(), "foundation-ai-server-"));
const filename = path.join(folder, "providers.yml");
const envNames = [
  "NODE_ENV",
  "DEFAULT_MODEL",
  "SERVER_PROVIDERS_FILE",
  ...Object.keys(LLM_ENV_MAP).flatMap((prefix) => [
    `${prefix}_API_KEY`,
    `${prefix}_BASE_URL`,
    `${prefix}_MODELS`,
  ]),
];
const saved = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);
for (const name of envNames) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "test",
  SERVER_PROVIDERS_FILE: filename,
});
after(() => {
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
});

test("后端真实 SDK 路径：问答、历史消息、错误脱敏、取消和命令行读取 .env.local", async () => {
  let status = 200,
    finishReason = "stop",
    reply = "后端调用成功";
  const calls: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer backend-test-secret");
    calls.push(JSON.parse(raw));
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
              usage: {
                prompt_tokens: 20,
                completion_tokens: 5,
                total_tokens: 25,
              },
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
    const result = await chat({ prompt: "你好", system: "简短回答" });
    assert.equal(result.text, "后端调用成功");
    assert.equal(result.model, "deepseek-flash");
    assert.equal(result.usage.inputTokens, 20);
    assert.ok(!JSON.stringify(result).includes("backend-test-secret"));
    assert.equal(calls[0].model, "deepseek-flash");
    await chat({
      messages: [
        { role: "user", content: "第一次问题" },
        { role: "assistant", content: "之前的回答" },
        { role: "user", content: "继续" },
      ],
    });
    assert.equal((calls[1].messages as unknown[]).length, 3);
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
    status = 200;
    finishReason = "length";
    await assert.rejects(
      chat({ prompt: "截断测试" }),
      (error: unknown) =>
        error instanceof BackendAIError && error.code === "OUTPUT_LIMIT",
    );
    finishReason = "stop";
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
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
