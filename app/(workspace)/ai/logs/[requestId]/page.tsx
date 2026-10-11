import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequest } from "@/lib/server/ai-requests";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RequestStatusBadge,
  requestTime,
  tokenDisplay,
} from "@/components/ai/request-display";

export const metadata: Metadata = { title: "请求详情 · AI模型管理" };

export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  let record: Awaited<ReturnType<typeof getRequest>>;
  try {
    record = await getRequest(requestId);
  } catch {
    return (
      <>
        <SiteHeader
          title="请求详情"
          breadcrumbs={[{ label: "请求日志", href: "/ai/logs" }]}
        />
        <WorkspaceContent>
          <div className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>暂时无法读取请求详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>请检查数据库连接后重试。</p>
                <Button asChild variant="outline">
                  <Link href="/ai/logs">返回请求日志</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </WorkspaceContent>
      </>
    );
  }
  if (!record) notFound();
  const info = [
    ["请求编号", record.id],
    ["服务商", record.provider_id ?? "未解析"],
    ["模型", record.model_id ?? record.requested_model ?? "未指定"],
    ["调用来源", record.source],
    ["开始时间（北京时间）", requestTime(record.started_at)],
    [
      "结束时间（北京时间）",
      record.completed_at ? requestTime(record.completed_at) : "尚未结束",
    ],
    [
      "耗时",
      record.duration_ms === null
        ? "—"
        : `${(record.duration_ms / 1000).toFixed(2)} 秒`,
    ],
    ["结束原因", record.finish_reason ?? "—"],
    ["输入 Tokens", tokenDisplay(record.input_tokens)],
    ["输出 Tokens", tokenDisplay(record.output_tokens)],
    ["缓存读取 Tokens", tokenDisplay(record.cache_read_tokens)],
    ["缓存写入 Tokens", tokenDisplay(record.cache_creation_tokens)],
    ["思考 Tokens（包含在输出中）", tokenDisplay(record.reasoning_tokens)],
  ];
  return (
    <>
      <SiteHeader
        title="请求详情"
        breadcrumbs={[
          { label: "AI模型管理", href: "/ai" },
          { label: "请求日志", href: "/ai/logs" },
        ]}
      />
      <WorkspaceContent>
        <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">请求详情</h1>
              <RequestStatusBadge status={record.status} />
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/ai/logs">返回请求日志</Link>
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>调用信息</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                {info.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          {record.status === "running" && (
            <p className="text-sm text-muted-foreground">
              请求尚未记录完成；如果调用进程意外中断，记录会保留此状态，请核查后再重试。
            </p>
          )}
          {record.error_code && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle>调用异常 · {record.error_code}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-destructive">
                {record.error_message}
              </CardContent>
            </Card>
          )}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>请求内容</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {record.request_body.system !== undefined ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      system（系统提示词）
                    </p>
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 font-sans text-sm leading-6">
                      {record.request_body.system}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    system（系统提示词）：本次未提供
                  </p>
                )}
                {record.request_body.messages.map((message, index) => (
                  <div key={index}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {message.role === "user"
                        ? "user（用户）"
                        : "assistant（助手历史消息）"}
                    </p>
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 font-sans text-sm leading-6">
                      {message.content}
                    </pre>
                  </div>
                ))}
                <details className="border-t pt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    请求参数 JSON
                  </summary>
                  <pre className="mt-4 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 font-mono text-xs leading-6">
                    {JSON.stringify(record.request_body, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  模型回复
                  {record.finish_reason === "length" ? "（未完整生成）" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">
                  {record.response_text || "没有记录到模型回复"}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspaceContent>
    </>
  );
}
