"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usagePeriod, type UsageData } from "@/lib/ai-usage";
const number = new Intl.NumberFormat("zh-CN");
const money = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.ceil(Number((value * 100).toPrecision(15))) / 100);
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const tokenConfig = {
  input: { label: "输入 Tokens", color: "var(--primary)" },
  output: {
    label: "输出 Tokens",
    color: "color-mix(in oklab, var(--primary) 40%, var(--card))",
  },
};
export function UsageDashboard({
  data,
  period,
  provider,
  model,
  costs = false,
}: {
  data: UsageData;
  period: ReturnType<typeof usagePeriod>;
  provider: string;
  model: string;
  costs?: boolean;
}) {
  const config = costs
    ? {
        input: { ...tokenConfig.input, label: "输入费用" },
        output: { ...tokenConfig.output, label: "输出费用" },
      }
    : tokenConfig;
  const displayValue = costs ? money : (value: number) => number.format(value);
  const [mode, setMode] = useState<"day" | "model">("day");
  const [range, setRange] = useState(period.range);
  const [selectedProvider, setProvider] = useState(provider);
  const [selectedModel, setModel] = useState(model);
  const [dates, setDates] = useState<DateRange | undefined>({
    from: parseISO(period.start),
    to: parseISO(period.end),
  });
  const points = mode === "day" ? data.days : data.models;
  const input = data.models.reduce((s, r) => s + r.input, 0),
    output = data.models.reduce((s, r) => s + r.output, 0);
  const count = data.models.reduce((s, r) => s + r.count, 0);
  const missing = data.models.reduce((s, r) => s + r.missing, 0);
  const known =
    count === 0 || data.models.some((r) => r.inputKnown || r.outputKnown);
  return (
    <div className="space-y-5">
      <form
        action={costs ? "/ai/costs" : "/ai/usage"}
        className="flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="range" value={range} />
        <input type="hidden" name="provider" value={selectedProvider} />
        <input type="hidden" name="model" value={selectedModel} />
        {range === "custom" && (
          <>
            <input
              type="hidden"
              name="start"
              value={dates?.from ? format(dates.from, "yyyy-MM-dd") : ""}
            />
            <input
              type="hidden"
              name="end"
              value={dates?.to ? format(dates.to, "yyyy-MM-dd") : ""}
            />
          </>
        )}
        <Select
          value={range}
          onValueChange={(value) => {
            setRange(value);
            if (value !== "custom") {
              const next = usagePeriod({ range: value });
              setDates({ from: parseISO(next.start), to: parseISO(next.end) });
            }
          }}
        >
          <SelectTrigger aria-label="时间范围" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">今天</SelectItem>
            <SelectItem value="7">近 7 天</SelectItem>
            <SelectItem value="30">近 30 天</SelectItem>
            <SelectItem value="custom">自定义日期</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={range !== "custom"}
              aria-label="选择日期范围"
              className="h-9 justify-start font-normal"
            >
              <CalendarDays className="size-4" />
              {dates?.from
                ? format(dates.from, "yyyy/MM/dd")
                : "开始日期"} —{" "}
              {dates?.to ? format(dates.to, "yyyy/MM/dd") : "结束日期"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={dates}
              onSelect={setDates}
              defaultMonth={dates?.from}
              numberOfMonths={2}
              locale={zhCN}
            />
          </PopoverContent>
        </Popover>
        <Select
          value={selectedProvider || "all"}
          onValueChange={(value) => {
            setProvider(value === "all" ? "" : value);
            setModel("");
          }}
        >
          <SelectTrigger aria-label="供应商" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部供应商</SelectItem>
            {[...new Set(data.options.map((row) => row.provider))].map(
              (value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select
          value={selectedModel || "all"}
          onValueChange={(value) => setModel(value === "all" ? "" : value)}
        >
          <SelectTrigger aria-label="模型" className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模型</SelectItem>
            {data.options
              .filter(
                (row) => !selectedProvider || row.provider === selectedProvider,
              )
              .map((row) => (
                <SelectItem key={row.model} value={row.model}>
                  {row.model}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          variant="outline"
          className="h-9"
          disabled={range === "custom" && (!dates?.from || !dates?.to)}
        >
          查询
        </Button>
      </form>
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
        {[
          [costs ? "预估总费用" : "总 Tokens", input + output, known],
          [
            costs ? "输入费用" : "输入 Tokens",
            input,
            count === 0 || data.models.some((r) => r.inputKnown),
          ],
          [
            costs ? "输出费用" : "输出 Tokens",
            output,
            count === 0 || data.models.some((r) => r.outputKnown),
          ],
        ].map(([label, value, available]) => (
          <Card key={String(label)} className="@container/card">
            <CardHeader>
              <CardDescription>{String(label)}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {available
                  ? displayValue(Number(value))
                  : costs
                    ? "暂无法估算"
                    : "未提供"}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {costs && missing > 0 && (
        <div
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
        >
          有 {missing}{" "}
          条记录因缺少价格或必要用量暂无法完整估算，当前仅合计可计算的费用。
        </div>
      )}
      <Card
        aria-label={costs ? "费用估值统计图" : "Token 用量统计图"}
        className="@container/card"
      >
        <CardHeader>
          <CardTitle>{costs ? "费用（元）" : "Tokens"}</CardTitle>
          <CardAction>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (value === "day" || value === "model") setMode(value);
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="图表维度"
              className="shadow-none"
            >
              <ToggleGroupItem
                value="day"
                className="px-3! font-normal shadow-none"
              >
                按天
              </ToggleGroupItem>
              <ToggleGroupItem
                value="model"
                className="px-3! font-normal shadow-none"
              >
                按模型
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {count === 0 ? (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              所选范围暂无用量记录
            </div>
          ) : !known ? (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              {costs
                ? "缺少价格或必要用量，暂无法估算费用"
                : "服务商未提供 Token 用量"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div
                style={{
                  minWidth:
                    mode === "model" ? Math.max(480, points.length * 180) : 480,
                }}
              >
                <ChartContainer
                  config={config}
                  className="h-[360px] w-full aspect-auto"
                  aria-label={
                    mode === "day"
                      ? `横轴为日期，纵轴为${costs ? "人民币费用" : "Token 用量"}`
                      : `横轴为模型，纵轴为${costs ? "人民币费用" : "Token 用量"}`
                  }
                >
                  <BarChart
                    accessibilityLayer
                    data={points}
                    margin={{
                      top: 12,
                      right: 16,
                      bottom: mode === "model" ? 20 : 0,
                      left: 8,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      interval={mode === "model" ? 0 : "preserveStartEnd"}
                      tickFormatter={(v) =>
                        mode === "day"
                          ? String(v).slice(5).replace("-", "/")
                          : String(v).split(":").slice(1).join(":") || v
                      }
                    />
                    <YAxis
                      domain={
                        costs
                          ? [0, (maximum: number) => Math.max(0.04, maximum)]
                          : undefined
                      }
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        costs ? money(v) : compact.format(v)
                      }
                      width={costs ? 80 : 56}
                      allowDecimals={costs}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        const row = payload?.[0]?.payload as
                          (typeof points)[number] | undefined;
                        if (!active || !row) return null;
                        return (
                          <div className="min-w-56 space-y-2 rounded-lg border bg-background p-3 text-xs shadow-md">
                            <p className="font-semibold">{row.label}</p>
                            {[
                              [
                                costs ? "输入费用" : "输入 Tokens",
                                row.input,
                                row.inputKnown,
                              ],
                              [
                                costs ? "输出费用" : "输出 Tokens",
                                row.output,
                                row.outputKnown,
                              ],
                              [
                                costs ? "合计" : "总 Tokens",
                                row.input + row.output,
                                row.inputKnown || row.outputKnown,
                              ],
                            ].map(([label, value, available]) => (
                              <div
                                key={String(label)}
                                className="flex justify-between gap-6"
                              >
                                <span>{String(label)}</span>
                                <span className="font-mono font-medium">
                                  {available
                                    ? displayValue(Number(value))
                                    : costs
                                      ? "暂无法估算"
                                      : "未提供"}
                                </span>
                              </div>
                            ))}
                            {row.missing > 0 && (
                              <p className="text-muted-foreground">
                                {costs
                                  ? "部分记录暂无法完整估算，仅合计可计算的费用"
                                  : "部分用量未提供，仅合计已知用量"}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="input"
                      stackId="tokens"
                      fill="var(--color-input)"
                      maxBarSize={56}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="output"
                      stackId="tokens"
                      fill="var(--color-output)"
                      maxBarSize={56}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-6 text-sm text-muted-foreground">
            {Object.entries(config).map(([key, item]) => (
              <span key={key} className="inline-flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
