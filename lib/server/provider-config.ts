import "server-only";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";

// Adapted from OpenMAIC: retain the LLM env mapping and field-by-field merge.
// Classroom and media configuration are intentionally outside this module.
const providerEntrySchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  models: z.array(z.string()).optional(),
  proxy: z.string().optional(),
});
type ServerProviderEntry = {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
};
const configSchema = z.object({
  providers: z.record(z.string(), providerEntrySchema).optional(),
});
export class AIConfigurationError extends Error {
  constructor(
    message = "AI 服务配置不正确，请检查服务端环境变量或服务商配置文件",
  ) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export const LLM_ENV_MAP: Record<string, string> = {
  OPENAI: "openai",
  AZURE_OPENAI: "azure",
  ATLASCLOUD: "atlascloud",
  ANTHROPIC: "anthropic",
  GOOGLE: "google",
  DEEPSEEK: "deepseek",
  QWEN: "qwen",
  KIMI: "kimi",
  MINIMAX: "minimax",
  GLM: "glm",
  SILICONFLOW: "siliconflow",
  DOUBAO: "doubao",
  OPENROUTER: "openrouter",
  GROK: "grok",
  TENCENT: "tencent-hunyuan",
  TENCENT_HUNYUAN: "tencent-hunyuan",
  XIAOMI: "xiaomi",
  MIMO: "xiaomi",
  OLLAMA: "ollama",
  LEMONADE: "lemonade",
  BEDROCK: "bedrock",
};

function normalizeModelList(
  models: string[] | undefined,
): string[] | undefined {
  const parsed = models?.map((model) => model.trim()).filter(Boolean);
  return parsed && parsed.length > 0 ? parsed : undefined;
}

function loadEnvSection(
  envMap: Record<string, string>,
  yamlSection: Record<string, Partial<ServerProviderEntry>> | undefined,
  {
    requiresBaseUrl = false,
    keylessProviders = new Set<string>(),
    baseUrlOptionalProviders = new Set<string>(),
  }: {
    requiresBaseUrl?: boolean;
    keylessProviders?: Set<string>;
    baseUrlOptionalProviders?: Set<string>;
  } = {},
): Record<string, ServerProviderEntry> {
  const result: Record<string, ServerProviderEntry> = {};
  const requiresBaseUrlForProvider = (providerId: string) =>
    requiresBaseUrl && !baseUrlOptionalProviders.has(providerId);

  // First, add everything from YAML as defaults
  if (yamlSection) {
    for (const [id, entry] of Object.entries(yamlSection)) {
      if (
        requiresBaseUrlForProvider(id)
          ? !!entry?.baseUrl
          : entry?.apiKey || (entry?.baseUrl && keylessProviders.has(id))
      ) {
        result[id] = {
          apiKey: entry.apiKey || "",
          baseUrl: entry.baseUrl,
          models: normalizeModelList(entry.models),
          proxy: entry.proxy,
        };
      }
    }
  }

  // Then, apply env vars (env takes priority over YAML)
  for (const [prefix, providerId] of Object.entries(envMap)) {
    const envApiKey = process.env[`${prefix}_API_KEY`] || undefined;
    const envBaseUrl = process.env[`${prefix}_BASE_URL`] || undefined;
    const envModelsStr = process.env[`${prefix}_MODELS`];
    const envModels = envModelsStr
      ? envModelsStr
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined;

    if (result[providerId]) {
      // YAML entry exists — env vars override individual fields
      if (envApiKey) result[providerId].apiKey = envApiKey;
      if (envBaseUrl) result[providerId].baseUrl = envBaseUrl;
      if (envModels) result[providerId].models = envModels;
      continue;
    }

    // Activate on API key, or base URL alone for keyless providers (e.g. Ollama)
    if (
      requiresBaseUrlForProvider(providerId)
        ? !envBaseUrl
        : !(envApiKey || (envBaseUrl && keylessProviders.has(providerId)))
    )
      continue;
    result[providerId] = {
      apiKey: envApiKey || "",
      baseUrl: envBaseUrl,
      models: envModels,
    };
  }

  return result;
}

function validateAddress(value: string | undefined): void {
  if (!value) return;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
  } catch {
    throw new AIConfigurationError();
  }
}

// Read at each resolution; one call gets one immutable configuration snapshot.
export function readServerProviders(): Record<string, ServerProviderEntry> {
  const filename = path.resolve(
    /* turbopackIgnore: true */ process.env.SERVER_PROVIDERS_FILE ||
      "server-providers.yml",
  );
  let document: z.infer<typeof configSchema> = {};
  try {
    const raw = fs.readFileSync(filename, "utf8");
    document = configSchema.parse(yaml.load(raw) ?? {});
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ))
      throw new AIConfigurationError();
  }
  const providers = loadEnvSection(LLM_ENV_MAP, document.providers, {
    keylessProviders: new Set(["ollama", "lemonade", "bedrock"]),
  });
  for (const entry of Object.values(providers)) {
    validateAddress(entry.baseUrl);
    validateAddress(entry.proxy);
  }
  return providers;
}

// Safe summary for checks: never includes keys, addresses, or proxy details.
export function getServerProviders(): Record<string, { models?: string[] }> {
  return Object.fromEntries(
    Object.entries(readServerProviders()).map(([id, entry]) => [
      id,
      entry.models ? { models: entry.models } : {},
    ]),
  );
}
