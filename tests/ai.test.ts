import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { z } from "zod";
import {
  readAIConfig,
  saveAIConfig,
  resolveAI,
  publicAIConfig,
  demoConfig,
} from "../lib/server/ai/config";
import { generateAI, generateAIJson, streamAI } from "../lib/server/ai/service";
import { aiDB, aiReport, closeAIDatabases } from "../lib/server/ai/store";

process.env.AI_DATA_DIR = mkdtempSync(
  path.join(tmpdir(), "foundation-ai-test-"),
);
delete process.env.AI_PROVIDERS_CONFIG;
after(closeAIDatabases);
const options = {
  ownerId: "test-owner",
  module: "test",
  stage: "test",
  system: "Test system",
  messages: [
    {
      role: "user" as const,
      content: "Private student content must not be logged",
    },
  ],
};
test("公共配置保存、模型清单与阶段选择，拒绝重复编号和无效路由", () => {
  saveAIConfig(demoConfig);
  assert.equal(readAIConfig().defaultModel, "demo:demo-text");
  assert.throws(() =>
    saveAIConfig({ ...demoConfig, routes: { test: "missing:model" } }),
  );
  assert.throws(() =>
    saveAIConfig({
      ...demoConfig,
      providers: [...demoConfig.providers, ...demoConfig.providers],
    }),
  );
  assert.throws(() => saveAIConfig({ ...demoConfig, apiKey: "secret" }));
  assert.equal(resolveAI("test").provider.type, "demo");
});
test("演示调用不会计入真实用量；真实流程不能回退到演示", async () => {
  const result = await generateAI(options);
  assert.equal(result.demo, true);
  await assert.rejects(
    generateAI({ ...options, liveOnly: true }),
    /真实批改不能/,
  );
  const report = aiReport();
  assert.equal(report.totals?.demo, 1);
  assert.ok(!JSON.stringify(report).includes("Private student"));
});
test("真实 SDK 请求、结构化检查、失败用量、阶段路由及流式记录", async () => {
  let requests = 0;
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests++;
    assert.equal(req.headers.authorization, "Bearer test-secret-not-logged");
    res.setHeader("Content-Type", "application/json");
    if (body.model === "broken") {
      res.statusCode = 429;
      res.end(JSON.stringify({ error: { message: "test-secret-not-logged" } }));
      return;
    }
    if (body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      const common = {
        id: "stream-id",
        object: "chat.completion.chunk",
        created: 1,
        model: "good",
      };
      res.write(
        `data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: { role: "assistant", content: "Hello" }, finish_reason: null }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } })}\n\n`,
      );
      res.end("data: [DONE]\n\n");
      return;
    }
    res.end(
      JSON.stringify({
        id: "call-id",
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: body.model === "invalid" ? "bad json" : '{"score":2}',
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.AI_TEST_KEY = "test-secret-not-logged";
  saveAIConfig({
    providers: [
      {
        id: "local",
        name: "Local contract",
        type: "openai-compatible",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKeyEnv: "AI_TEST_KEY",
        models: ["good", "invalid", "broken"].map((id) => ({
          id,
          name: id,
          inputPrice: 1,
          outputPrice: 2,
          vision: true,
        })),
      },
    ],
    defaultModel: "local:good",
    routes: { bad: "local:invalid", rate: "local:broken" },
  });
  try {
    assert.ok(
      !JSON.stringify(publicAIConfig()).includes(process.env.AI_TEST_KEY),
    );
    const valid = await generateAIJson(
      options,
      z.object({ score: z.number() }),
    );
    assert.equal(valid.value.score, 2);
    await assert.rejects(
      generateAIJson(
        { ...options, stage: "bad" },
        z.object({ score: z.number() }),
      ),
      /模型结果不符合/,
    );
    await assert.rejects(
      generateAI({ ...options, stage: "rate" }),
      (e) => e instanceof Error && "retryable" in e && e.retryable === true,
    );
    let text = "";
    for await (const part of streamAI(options)) text += part;
    assert.equal(text, "Hello");
    assert.equal(
      requests,
      4,
      "SDK retries disabled so each billed attempt has one record",
    );
    const failed = aiDB()
      .prepare("SELECT * FROM calls WHERE stage='bad'")
      .get();
    assert.equal(failed?.input_tokens, 10);
    assert.equal(failed?.error_code, "INVALID_OUTPUT");
    assert.ok(Math.abs(Number(failed?.estimated_cost) - 0.000018) < 1e-10);
    const report = aiReport();
    assert.ok(!JSON.stringify(report).includes("test-secret-not-logged"));
    assert.equal(report.totals?.failed, 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    saveAIConfig(demoConfig);
    delete process.env.AI_TEST_KEY;
  }
});
test("服务商环境配置优先、只读保护与缺少密钥明确失败", () => {
  process.env.AI_PROVIDERS_CONFIG = JSON.stringify({
    providers: [
      {
        id: "native",
        name: "Native",
        type: "anthropic",
        apiKeyEnv: "NONEXISTENT_AI_KEY",
        models: [{ id: "test", name: "test" }],
      },
    ],
    defaultModel: "native:test",
  });
  try {
    assert.throws(() => resolveAI("test"), /密钥未配置/);
    assert.throws(() => saveAIConfig(demoConfig), /环境变量/);
    assert.equal(publicAIConfig().readiness[0].ready, false);
  } finally {
    delete process.env.AI_PROVIDERS_CONFIG;
  }
});
test("Anthropic 与 Google 原生协议通过公共调用并记录用量", async () => {
  const server = createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    res.setHeader("Content-Type", "application/json");
    if (req.url?.includes("messages")) {
      assert.equal(req.headers["x-api-key"], "native-test-key");
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "test",
          content: [{ type: "text", text: "Native OK" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 8, output_tokens: 3 },
        }),
      );
    } else {
      assert.equal(req.headers["x-goog-api-key"], "native-test-key");
      res.end(
        JSON.stringify({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "Native OK" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 8,
            candidatesTokenCount: 3,
            totalTokenCount: 11,
          },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.NATIVE_TEST_KEY = "native-test-key";
  try {
    for (const type of ["anthropic", "google"] as const) {
      saveAIConfig({
        providers: [
          {
            id: type,
            name: type,
            type,
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            apiKeyEnv: "NATIVE_TEST_KEY",
            models: [{ id: "test", name: "test" }],
          },
        ],
        defaultModel: `${type}:test`,
      });
      assert.equal(
        (await generateAI({ ...options, stage: type })).value,
        "Native OK",
      );
      const row = aiDB()
        .prepare("SELECT input_tokens,output_tokens FROM calls WHERE stage=?")
        .get(type);
      assert.equal(row?.input_tokens, 8);
      assert.equal(row?.output_tokens, 3);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.NATIVE_TEST_KEY;
    saveAIConfig(demoConfig);
  }
});
