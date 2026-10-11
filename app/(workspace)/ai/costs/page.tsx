import type { Metadata } from "next";
import { AIManagementPage } from "@/components/ai/management-page";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UsageDashboard } from "@/components/ai/usage-dashboard";
import { usagePeriod, type UsageParams } from "@/lib/ai-usage";
import { getAICosts } from "@/lib/server/ai-costs";

export const metadata: Metadata = { title: "费用估值 · AI模型管理" };

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
    period = usagePeriod({ ...params, range: params.range ?? "30" });
  } catch {
    error = "请选择有效的起止日期，范围最多 366 天。";
  }
  if (period) {
    try {
      data = await getAICosts(
        period.start,
        period.end,
        params.provider,
        params.model,
      );
    } catch {
      error = "暂时无法读取费用估值，请稍后重试。";
    }
  }
  return (
    <AIManagementPage section="costs" showMetrics={false}>
      {data && period ? (
        <UsageDashboard
          key={[period.start, period.end, params.provider, params.model].join(
            "|",
          )}
          data={data}
          period={period}
          provider={params.provider ?? ""}
          model={params.model ?? ""}
          costs
        />
      ) : (
        <div role="alert" className="rounded-xl border p-6 text-sm">
          {error}
          <Button variant="link" asChild>
            <Link href="/ai/costs">重新加载</Link>
          </Button>
        </div>
      )}
    </AIManagementPage>
  );
}
