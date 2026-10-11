import type { Metadata } from "next";
import { AIManagementPage } from "@/components/ai/management-page";
import { UsageDashboard } from "@/components/ai/usage-dashboard";
import { usagePeriod, type UsageParams } from "@/lib/ai-usage";
import { getAIUsage } from "@/lib/server/ai-usage";
export const metadata: Metadata = { title: "用量信息 · AI模型管理" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<UsageParams>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === "string"),
  ) as UsageParams;
  let period;
  let data;
  let error;
  try {
    period = usagePeriod(params);
  } catch {
    error = "请选择有效的起止日期，范围最多 366 天。";
  }
  if (period) {
    try {
      data = await getAIUsage(
        period.start,
        period.end,
        params.provider,
        params.model,
      );
    } catch {
      error = "暂时无法读取用量，请检查数据库连接及请求记录数据表。";
    }
  }
  return (
    <AIManagementPage section="usage" showMetrics={false}>
      {data && period ? (
        <UsageDashboard
          key={[period.start, period.end, params.provider, params.model].join(
            "|",
          )}
          data={data}
          period={period}
          provider={params.provider ?? ""}
          model={params.model ?? ""}
        />
      ) : (
        <div role="alert" className="rounded-xl border p-6 text-sm">
          {error}
          <a href="/ai/usage" className="ml-4 underline">
            重新加载
          </a>
        </div>
      )}
    </AIManagementPage>
  );
}
