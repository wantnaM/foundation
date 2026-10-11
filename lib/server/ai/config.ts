import "server-only";
import { z } from "zod";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const aiDataDir = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.AI_DATA_DIR || ".ai-data",
  );
const modelSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(100),
    vision: z.boolean().default(false),
    inputPrice: z.number().nonnegative().optional(),
    outputPrice: z.number().nonnegative().optional(),
    currency: z.enum(["CNY", "USD"]).default("CNY"),
  })
  .strict();
const providerSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(80),
    name: z.string().min(1).max(100),
    type: z.enum([
      "openai",
      "openai-compatible",
      "anthropic",
      "google",
      "demo",
    ]),
    baseUrl: z
      .string()
      .url()
      .refine((s) => {
        const u = new URL(s);
        return (
          ["http:", "https:"].includes(u.protocol) &&
          !u.username &&
          !u.password &&
          !u.search &&
          !u.hash
        );
      }, "地址必须为无密码、无查询参数的 HTTP/HTTPS 地址")
      .optional(),
    apiKeyEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
    enabled: z.boolean().default(true),
    models: z.array(modelSchema).min(1).max(100),
  })
  .strict();
export const aiConfigSchema = z
  .object({
    providers: z.array(providerSchema).min(1).max(30),
    defaultModel: z.string().min(1),
    routes: z
      .record(z.string().regex(/^[a-zA-Z0-9_.:-]+$/), z.string().min(1))
      .default({}),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.providers.map((p) => p.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "服务商编号重复" });
    for (const p of c.providers) {
      if (new Set(p.models.map((m) => m.id)).size !== p.models.length)
        ctx.addIssue({ code: "custom", message: "模型编号重复" });
      if (p.type === "openai-compatible" && !p.baseUrl)
        ctx.addIssue({ code: "custom", message: "兼容服务必须提供地址" });
    }
    for (const target of [c.defaultModel, ...Object.values(c.routes)]) {
      if (
        !c.providers.some(
          (p) =>
            p.enabled && p.models.some((m) => `${p.id}:${m.id}` === target),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "默认模型或阶段路由未对应已启用的模型",
        });
    }
  });
export type AIConfig = z.infer<typeof aiConfigSchema>;
export const demoConfig: AIConfig = {
  providers: [
    {
      id: "demo",
      name: "本地演示",
      type: "demo",
      enabled: true,
      models: [
        {
          id: "demo-text",
          name: "演示文本模型",
          vision: false,
          currency: "CNY",
        },
      ],
    },
  ],
  defaultModel: "demo:demo-text",
  routes: {},
};
const configPath = () => path.join(aiDataDir(), "config.json");
export function readAIConfig(): AIConfig {
  try {
    if (process.env.AI_PROVIDERS_CONFIG)
      return aiConfigSchema.parse(JSON.parse(process.env.AI_PROVIDERS_CONFIG));
    if (existsSync(configPath()))
      return aiConfigSchema.parse(
        JSON.parse(readFileSync(configPath(), "utf8")),
      );
    return structuredClone(demoConfig);
  } catch {
    throw new Error("AI 公共配置无效，请检查模型、路由和服务地址");
  }
}
export function saveAIConfig(value: unknown) {
  if (process.env.AI_PROVIDERS_CONFIG)
    throw new Error("当前由环境变量管理配置，请修改环境变量并重启");
  const config = aiConfigSchema.parse(value);
  mkdirSync(aiDataDir(), { recursive: true });
  const temp = `${configPath()}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(config, null, 2), { mode: 0o600 });
  renameSync(temp, configPath());
  return config;
}
export function resolveAI(stage: string, legacyGrading = false) {
  const config = readAIConfig();
  // Explicit common routes win; old grading environment settings remain compatible.
  if (
    legacyGrading &&
    !config.routes[stage] &&
    !config.routes.grading &&
    process.env.GRADING_AI_MODEL &&
    process.env.GRADING_AI_BASE_URL &&
    process.env.GRADING_AI_API_KEY
  ) {
    const provider = providerSchema.parse({
      id: "grading-legacy",
      name: "批改原有配置",
      type: "openai-compatible",
      baseUrl: process.env.GRADING_AI_BASE_URL,
      apiKeyEnv: "GRADING_AI_API_KEY",
      models: [
        {
          id: process.env.GRADING_AI_MODEL,
          name: process.env.GRADING_AI_MODEL,
          vision: true,
        },
      ],
    });
    return {
      provider,
      model: provider.models[0],
      apiKey: process.env.GRADING_AI_API_KEY,
    };
  }
  const ref =
    config.routes[stage] ||
    (legacyGrading ? config.routes.grading : undefined) ||
    config.defaultModel;
  const provider = config.providers.find(
    (p) => p.enabled && p.models.some((m) => `${p.id}:${m.id}` === ref),
  )!;
  const model = provider.models.find((m) => `${provider.id}:${m.id}` === ref)!;
  const apiKey = provider.apiKeyEnv
    ? process.env[provider.apiKeyEnv]
    : undefined;
  if (
    provider.type !== "demo" &&
    provider.type !== "openai-compatible" &&
    !apiKey
  )
    throw new Error("所选模型的服务端密钥未配置");
  if (provider.type === "openai-compatible" && provider.apiKeyEnv && !apiKey)
    throw new Error("所选模型的服务端密钥未配置");
  return { provider, model, apiKey };
}
export function publicAIConfig() {
  const config = readAIConfig();
  return {
    config,
    environmentManaged: Boolean(process.env.AI_PROVIDERS_CONFIG),
    readiness: config.providers.map((p) => ({
      id: p.id,
      ready:
        p.enabled &&
        (p.type === "demo" ||
          (!p.apiKeyEnv && p.type === "openai-compatible") ||
          Boolean(p.apiKeyEnv && process.env[p.apiKeyEnv])),
    })),
  };
}
