import type { Metadata } from "next";
import { AIManagementPage } from "@/components/ai/management-page";
import { listRequests, type RequestStatus } from "@/lib/server/ai-requests";
import {
  requestTime,
  tokenDisplay,
  statusLabels,
} from "@/components/ai/request-display";
import { RequestTable } from "@/components/ai/request-table";
import { RefreshLogs } from "@/components/ai/refresh-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "请求日志 · AI模型管理" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    pageSize?: string;
    model?: string;
  }>;
}) {
  const params = await searchParams;
  const modelSearch =
    typeof params.model === "string" ? params.model.trim() : "";
  const status =
    params.status && Object.hasOwn(statusLabels, params.status)
      ? (params.status as RequestStatus)
      : undefined;
  let data: Awaited<ReturnType<typeof listRequests>>;
  try {
    data = await listRequests(
      Number(params.page ?? 1),
      status,
      Number(params.pageSize ?? 20),
      modelSearch,
    );
  } catch {
    return (
      <AIManagementPage section="logs" showMetrics={false}>
        <Card>
          <CardHeader>
            <CardTitle>暂时无法读取请求记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              请检查数据库连接，并确认已运行 pnpm db:migrate 初始化数据表。
            </p>
            <RefreshLogs />
          </CardContent>
        </Card>
      </AIManagementPage>
    );
  }
  return (
    <AIManagementPage section="logs" showMetrics={false}>
      <RequestTable
        rows={data.rows.map((row) => ({
          id: row.id,
          time: requestTime(row.started_at),
          model:
            row.provider_id && row.model_id
              ? `${row.provider_id}:${row.model_id}`
              : (row.requested_model ?? "未指定模型"),
          source: row.source,
          preview: row.preview,
          status: row.status,
          duration:
            row.duration_ms === null
              ? "—"
              : `${(row.duration_ms / 1000).toFixed(2)} 秒`,
          tokens: `${tokenDisplay(row.input_tokens)} / ${tokenDisplay(row.output_tokens)}`,
        }))}
        page={data.page}
        pages={data.pages}
        pageSize={data.pageSize}
        total={data.summary.filtered}
        status={status}
        modelSearch={modelSearch}
      />
    </AIManagementPage>
  );
}
