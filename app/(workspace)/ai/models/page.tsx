import type { Metadata } from "next";
import { AIManagementPage } from "@/components/ai/management-page";
import { ModelBrowser } from "@/components/ai/model-browser";
import { getModelCatalog } from "@/lib/server/model-catalog";
import { connection } from "next/server";
import { getModelPrices } from "@/lib/server/model-prices";
import type { ModelPrices } from "@/lib/model-prices";

export const metadata: Metadata = { title: "模型列表 · AI模型管理" };

export default async function Page() {
  await connection();
  let prices: ModelPrices = {};
  let pricesAvailable = true;
  try {
    prices = await getModelPrices();
  } catch {
    pricesAvailable = false;
  }
  let catalog: ReturnType<typeof getModelCatalog> | undefined;
  try {
    catalog = getModelCatalog();
  } catch {
    // Configuration errors must not expose connection details to the browser.
  }
  if (!catalog) {
    return (
      <AIManagementPage section="models" showMetrics={false}>
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-6"
        >
          <h2 className="font-semibold">暂时无法读取模型清单</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            请检查服务端供应商配置，修正后刷新页面。
          </p>
        </div>
      </AIManagementPage>
    );
  }
  return (
    <AIManagementPage section="models" showMetrics={false}>
      <ModelBrowser
        {...catalog}
        prices={prices}
        pricesAvailable={pricesAvailable}
      />
    </AIManagementPage>
  );
}
