import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getModel, PROVIDERS, getAllModels } from "../lib/ai/providers";
import { callLLM, streamLLM } from "../lib/ai/llm";
import { normalizeUsage } from "../lib/usage/normalize";
import { recordUsage, readUsageRecords } from "../lib/server/usage-storage";

// Upstream storage deliberately skips implicit writes in tests.
Object.assign(process.env, { NODE_ENV: "test" });

test("迁入的 12 个文件与来源一致，仅三个服务端入口增加保护标记", async () => {
  const files = [
    ...[
      "providers",
      "llm",
      "model-metadata",
      "model-aliases",
      "thinking-config",
      "thinking-context",
      "reasoning-sse",
      "azure",
    ].map((name) => `lib/ai/${name}.ts`),
    "lib/types/provider.ts",
    "lib/logger.ts",
    "lib/usage/normalize.ts",
    "lib/server/usage-storage.ts",
  ];
  // Optional local comparison: CI does not require the original checkout.
  const upstream = process.env.OPENMAIC_SOURCE_DIR;
  if (!upstream) return;
  for (const file of files) {
    const actual = (await readFile(file, "utf8"))
      .replace(/^import "server-only";\r?\n/, "")
      .replace(/\r\n/g, "\n");
    const original: string = (
      await readFile(path.join(upstream, file), "utf8")
    ).replace(/\r\n/g, "\n");
    assert.equal(actual, original, file);
  }
});

test("模型清单和本地用量文件可用，缓存与思考用量保持原语义", async () => {
  assert.ok(PROVIDERS.azure && PROVIDERS.bedrock);
  assert.ok(getAllModels().flatMap((entry) => entry.models).length > 20);
  const usage = normalizeUsage({
    inputTokens: 20,
    outputTokens: 10,
    totalTokens: 30,
    inputTokenDetails: {
      noCacheTokens: 12,
      cacheReadTokens: 5,
      cacheWriteTokens: 3,
    },
    outputTokenDetails: { textTokens: 6, reasoningTokens: 4 },
  });
  assert.deepEqual(usage, {
    inputTokens: 20,
    outputTokens: 10,
    cacheReadTokens: 5,
    cacheCreationTokens: 3,
    reasoningTokens: 4,
  });
  const baseDir = await mkdtemp(path.join(tmpdir(), "foundation-usage-"));
  const input = {
    source: "migration-test",
    providerId: "openai",
    modelId: "test",
    modelString: "openai:test",
    usage,
  };
  await recordUsage(input, { baseDir, now: new Date("2026-10-11T00:00:00Z") });
  await recordUsage({ ...input, usage: normalizeUsage(null) }, { baseDir });
  const rows = await readUsageRecords({ baseDir });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cacheReadTokens, 5);
  assert.equal(rows[0].reasoningTokens, 4);
});

test("统一入口通过本地接口完成完整回答、逐段回答和思考参数传递", async () => {
  const bodies: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    bodies.push(body);
    assert.equal(req.url, "/v1/chat/completions");
    const common = { id: "test-call", created: 1, model: "deepseek-v4-flash" };
    if (body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      for (const chunk of [
        {
          ...common,
          object: "chat.completion.chunk",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", reasoning_content: "检查" },
              finish_reason: null,
            },
          ],
        },
        {
          ...common,
          object: "chat.completion.chunk",
          choices: [
            { index: 0, delta: { content: "通过" }, finish_reason: null },
          ],
        },
        {
          ...common,
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
        },
      ])
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.end("data: [DONE]\n\n");
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ...common,
          object: "chat.completion",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: "通过" },
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const { model } = getModel({
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      apiKey: "test-key",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
    });
    const params = {
      model,
      prompt: "测试",
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(10000),
    };
    const answer = await callLLM(params, "migration-test", undefined, {
      mode: "disabled",
    });
    assert.equal(answer.text, "通过");
    assert.equal(answer.totalUsage.inputTokens, 12);
    const stream = streamLLM(params, "migration-stream-test", {
      mode: "disabled",
    });
    let text = "";
    for await (const chunk of stream.textStream) text += chunk;
    assert.equal(text, "通过");
    assert.equal((await stream.totalUsage).outputTokens, 3);
    assert.equal(await stream.reasoningText, "检查");
    assert.equal(bodies.length, 2);
    assert.deepEqual(bodies[0].thinking, { type: "disabled" });
    assert.deepEqual(bodies[1].thinking, { type: "disabled" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
