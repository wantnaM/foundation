import Link from "next/link";
import { Activity, Cpu, Coins, ScrollText } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sections = {
  usage: {
    title: "用量信息",
    description: "查看各模型的 Token 消耗与每日使用趋势。",
    icon: Activity,
    metrics: ["请求次数", "输入 Tokens", "输出 Tokens", "成功率"],
    empty: "用量统计尚未接入",
    detail: "接入请求记录后，这里将展示按日期、服务商和模型汇总的真实用量。",
  },
  models: {
    title: "模型列表",
    description: "按供应商查看模型清单、配置状态与能力信息。",
    icon: Cpu,
    metrics: ["已配置服务商", "可用模型", "默认模型", "连接状态"],
    empty: "模型清单尚未接入",
    detail:
      "后续将读取 AI 基座的现有配置，展示模型能力和连接状态，并提供连接测试。",
  },
  costs: {
    title: "费用估值",
    description: "根据模型价格与实际用量，了解 AI 的预估成本。",
    icon: Coins,
    metrics: ["预估总费用", "输入费用", "输出费用", "待定价请求"],
    empty: "费用估值尚未接入",
    detail:
      "配置模型价格后，将按实际用量估算费用；估值与服务商的最终账单可能存在差异。",
  },
  logs: {
    title: "请求日志",
    description: "追踪每一次 AI 请求的结果、耗时和异常原因。",
    icon: ScrollText,
    metrics: ["请求总数", "成功请求", "失败请求", "平均耗时"],
    empty: "请求日志尚未接入",
    detail:
      "接入数据库记录后，这里将支持筛选请求，并查看输入、回复、用量及错误详情。",
  },
};

export type AISection = keyof typeof sections;

export function AIManagementPage({
  section,
  children,
  metrics,
  showMetrics = true,
}: {
  section: AISection;
  children?: React.ReactNode;
  metrics?: { label: string; value: string; hint?: string }[];
  showMetrics?: boolean;
}) {
  const current = sections[section];
  const Icon = current.icon;
  return (
    <>
      <SiteHeader
        title={current.title}
        breadcrumbs={[{ label: "AI模型管理", href: "/ai" }]}
      />
      <WorkspaceContent scrollable={section !== "models"}>
        <div
          className={`@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6 ${section === "models" ? "h-full min-h-0" : ""}`}
        >
          <div className="shrink-0 px-4 lg:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                AI模型管理
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {current.description}
            </p>
            <nav
              aria-label="AI模型管理子页面"
              className="mt-6 flex flex-wrap gap-1 border-b"
            >
              {(
                Object.entries(sections) as [
                  AISection,
                  (typeof sections)[AISection],
                ][]
              ).map(([key, item]) => (
                <Link
                  key={key}
                  href={`/ai/${key}`}
                  aria-current={section === key ? "page" : undefined}
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${section === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
          {showMetrics && (
            <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
              {(
                metrics ??
                current.metrics.map((label) => ({
                  label,
                  value: "—",
                  hint: "等待数据接入",
                }))
              ).map((metric) => (
                <Card key={metric.label}>
                  <CardHeader>
                    <CardDescription>{metric.label}</CardDescription>
                    <CardTitle className="text-3xl font-semibold">
                      {metric.value}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {metric.hint ?? "全部请求"}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div
            className={`px-4 lg:px-6 ${section === "models" ? "min-h-0 flex-1" : ""}`}
          >
            {children ?? (
              <Card>
                <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 rounded-xl border bg-muted/40 p-3">
                    <Icon
                      className="size-6 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <h2 className="font-semibold">{current.empty}</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {current.detail}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </WorkspaceContent>
    </>
  );
}
