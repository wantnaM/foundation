import "server-only";
import { getModel, PROVIDERS, type ProviderId } from "@/lib/ai/providers";
import { modelIdsMatch } from "@/lib/ai/model-aliases";
import { AIConfigurationError, readServerProviders } from "./provider-config";

// OpenMAIC selection order without classroom routes or browser-supplied credentials:
// explicit backend model > DEFAULT_MODEL. No hidden vendor fallback.
export function resolveModel(params: { modelString?: string } = {}) {
  const modelString = (params.modelString ?? process.env.DEFAULT_MODEL)?.trim();
  const separator = modelString?.indexOf(":") ?? -1;
  if (
    !modelString ||
    separator <= 0 ||
    !modelString.slice(separator + 1).trim()
  )
    throw new AIConfigurationError("请设置默认模型，格式为 厂商:模型名称");
  const providerId = modelString.slice(0, separator) as ProviderId;
  const modelId = modelString.slice(separator + 1).trim();
  if (!Object.hasOwn(PROVIDERS, providerId))
    throw new AIConfigurationError("当前服务商不在模型清单中，请检查模型配置");
  const connection = readServerProviders()[providerId];
  if (!connection)
    throw new AIConfigurationError(
      "所选服务商尚未配置，请在服务端填写 API Key 或本地服务地址",
    );
  if (
    connection.models?.length &&
    !connection.models.some((id) => modelIdsMatch(providerId, id, modelId))
  )
    throw new AIConfigurationError("所选模型不在该服务商配置的允许清单中");
  try {
    const { model, modelInfo } = getModel({
      providerId,
      modelId,
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl,
      proxy: connection.proxy,
    });
    // Credentials stay inside the connection object and are never returned as metadata.
    return {
      model,
      modelInfo,
      providerId,
      modelId,
      modelString: `${providerId}:${modelId}`,
    };
  } catch {
    throw new AIConfigurationError();
  }
}
