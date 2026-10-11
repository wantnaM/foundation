import "server-only";
import { PROVIDERS, getModelInfo } from "@/lib/ai/providers";
import { readServerProviders } from "./provider-config";

export type CatalogModel = {
  id: string;
  name: string;
  group: string;
  contextWindow?: number;
  outputWindow?: number;
  capabilities: string[];
};
export type CatalogProvider = {
  id: string;
  name: string;
  configured: boolean;
  apiAddress?: string;
  customAddress: boolean;
  source: "configured" | "catalog";
  models: CatalogModel[];
};

/** Read the same configuration as backend calls, exposing only public catalogue fields. */
export function getModelCatalog() {
  const configured = readServerProviders();
  const providers: CatalogProvider[] = Object.values(PROVIDERS)
    .map<CatalogProvider>((provider) => {
      const connection = configured[provider.id];
      const configuredIds = connection?.models;
      const modelIds = [
        ...new Set(configuredIds ?? provider.models.map((model) => model.id)),
      ];
      return {
        id: provider.id,
        name: provider.name,
        configured: Boolean(connection),
        apiAddress: displayAddress(
          connection?.baseUrl || provider.defaultBaseUrl,
        ),
        customAddress: Boolean(connection?.baseUrl),
        source: configuredIds ? "configured" : "catalog",
        models: modelIds.map((id) => {
          const info = getModelInfo(provider.id, id);
          const name = info?.name ?? id;
          const capabilities: string[] = [];
          if (info?.capabilities?.thinking) capabilities.push("深度思考");
          if (info?.capabilities?.vision) capabilities.push("图像理解");
          if (info?.capabilities?.tools) capabilities.push("工具调用");
          if (info?.capabilities?.streaming) capabilities.push("流式输出");
          return {
            id,
            name,
            group: id.includes("/")
              ? id.slice(0, id.indexOf("/"))
              : name.split(/[\s/]/)[0],
            contextWindow: info?.contextWindow,
            outputWindow: info?.outputWindow,
            capabilities,
          };
        }),
      };
    })
    .sort((a, b) => Number(b.configured) - Number(a.configured));
  const initialProviderId =
    providers.find((provider) => provider.configured)?.id ??
    providers[0]?.id ??
    "";
  return { providers, initialProviderId };
}

// Query parameters and fragments may carry credentials; display only the endpoint path.
function displayAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;
  const url = new URL(address);
  return `${url.origin}${url.pathname}`;
}
