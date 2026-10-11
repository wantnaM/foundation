import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getModelCatalog } from "../lib/server/model-catalog";
import {
  LLM_ENV_MAP,
  AIConfigurationError,
} from "../lib/server/provider-config";

test("模型目录遵循服务端清单、识别别名且忽略旧默认模型，并隔离连接信息", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "foundation-model-catalog-"));
  const filename = path.join(folder, "providers.yml");
  const names = [
    "DEFAULT_MODEL",
    "SERVER_PROVIDERS_FILE",
    ...Object.keys(LLM_ENV_MAP).flatMap((prefix) => [
      `${prefix}_API_KEY`,
      `${prefix}_BASE_URL`,
      `${prefix}_MODELS`,
    ]),
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    for (const name of names) delete process.env[name];
    process.env.SERVER_PROVIDERS_FILE = filename;
    process.env.DEFAULT_MODEL = "deepseek:obsolete-default";
    writeFileSync(
      filename,
      `providers:
  openai:
    apiKey: test-private-key
    baseUrl: https://private.example/v1?api_key=query-secret#fragment-secret
    proxy: http://private-proxy.example
    models: [gpt-5.6-sol, gpt-5.6-sol, custom-model]
  ollama:
    baseUrl: http://localhost:11434/v1
    models: [local-model]
`,
    );
    const catalog = getModelCatalog();
    assert.equal(catalog.initialProviderId, "openai");
    const openai = catalog.providers.find((p) => p.id === "openai")!;
    assert.equal(openai.configured, true);
    assert.equal(openai.source, "configured");
    assert.equal(openai.apiAddress, "https://private.example/v1");
    assert.equal(openai.customAddress, true);
    assert.deepEqual(
      openai.models.map((m) => m.id),
      ["gpt-5.6-sol", "custom-model"],
    );
    assert.equal(Object.hasOwn(openai.models[0], "isDefault"), false);
    assert.ok(openai.models[0].contextWindow);
    assert.deepEqual(openai.models[1].capabilities, []);
    assert.equal(
      catalog.providers.find((p) => p.id === "ollama")?.configured,
      true,
    );
    const deepseek = catalog.providers.find((p) => p.id === "deepseek")!;
    assert.equal(deepseek.configured, false);
    assert.equal(deepseek.source, "catalog");
    assert.equal(deepseek.apiAddress, "https://api.deepseek.com/v1");
    assert.equal(deepseek.customAddress, false);
    assert.equal(
      catalog.providers.find((p) => p.id === "azure")?.apiAddress,
      undefined,
    );
    assert.ok(deepseek.models.length);
    const serialized = JSON.stringify(catalog);
    for (const secret of [
      "test-private-key",
      "query-secret",
      "fragment-secret",
      "private-proxy.example",
      "apiKey",
      "baseUrl",
      "proxy",
    ]) {
      assert.equal(serialized.includes(secret), false);
    }

    // Refresh reads current configuration; it never retains a stale model allow-list.
    process.env.DEFAULT_MODEL = "openai:new-default";
    writeFileSync(
      filename,
      "providers:\n  openai:\n    apiKey: test-private-key\n",
    );
    const refreshed = getModelCatalog().providers.find(
      (p) => p.id === "openai",
    )!;
    assert.equal(refreshed.source, "catalog");
    assert.equal(
      refreshed.models.some((m) => m.id === "new-default"),
      false,
    );
    process.env.OPENAI_MODELS = "restricted-model";
    assert.deepEqual(
      getModelCatalog()
        .providers.find((p) => p.id === "openai")
        ?.models.map((m) => m.id),
      ["restricted-model"],
    );
    writeFileSync(filename, "providers: [invalid]");
    assert.throws(() => getModelCatalog(), AIConfigurationError);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    rmSync(folder, { recursive: true, force: true });
  }
});
