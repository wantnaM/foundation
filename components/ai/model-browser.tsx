"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Check,
  Cpu,
  Eye,
  Radio,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogModel, CatalogProvider } from "@/lib/server/model-catalog";

const capabilityIcons = {
  深度思考: Brain,
  图像理解: Eye,
  工具调用: Wrench,
  流式输出: Radio,
};

function ModelRow({ model }: { model: CatalogModel }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{model.name}</span>
          </div>
          <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {model.id}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {model.capabilities.map((label) => {
          const Icon = capabilityIcons[label as keyof typeof capabilityIcons];
          return (
            <Badge
              key={label}
              variant="secondary"
              className="gap-1 font-normal"
            >
              {Icon && <Icon className="size-3" aria-hidden="true" />}
              {label}
            </Badge>
          );
        })}
        {!model.capabilities.length && (
          <span className="text-xs text-muted-foreground">能力未登记</span>
        )}
      </div>
      {(model.contextWindow || model.outputWindow) && (
        <p className="w-full text-xs text-muted-foreground">
          {model.contextWindow &&
            `上下文 ${model.contextWindow.toLocaleString("zh-CN")} Tokens`}
          {model.contextWindow && model.outputWindow && " · "}
          {model.outputWindow &&
            `输出上限 ${model.outputWindow.toLocaleString("zh-CN")} Tokens`}
        </p>
      )}
    </li>
  );
}

export function ModelBrowser({
  providers,
  initialProviderId,
}: {
  providers: CatalogProvider[];
  initialProviderId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(initialProviderId);
  const [modelSearch, setModelSearch] = useState("");
  const panelId = useId();
  const selected =
    providers.find((provider) => provider.id === selectedId) ?? providers[0];
  if (!selected)
    return (
      <p className="py-12 text-center text-muted-foreground">暂无供应商目录</p>
    );
  const visibleModels = selected.models.filter((model) =>
    `${model.name} ${model.id}`
      .toLowerCase()
      .includes(modelSearch.trim().toLowerCase()),
  );

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,2fr)] overflow-hidden rounded-xl border bg-background md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
      <aside
        className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b bg-background md:border-r md:border-b-0"
        aria-label="供应商列表"
      >
        <div className="shrink-0 border-b p-4">
          <h2 className="text-sm font-semibold">供应商</h2>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          aria-label="供应商滚动列表"
          tabIndex={0}
        >
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              aria-pressed={selected.id === provider.id}
              aria-controls={panelId}
              onClick={() => {
                setSelectedId(provider.id);
                setModelSearch("");
              }}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm transition-colors ${selected.id === provider.id ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className="min-w-0 flex-1 truncate">{provider.name}</span>
              {provider.configured ? (
                <Check
                  className="size-3.5 shrink-0 text-emerald-600"
                  aria-label="已配置"
                />
              ) : (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30"
                  aria-label="未配置"
                />
              )}
            </button>
          ))}
        </div>
      </aside>
      <section
        id={panelId}
        aria-label={`${selected.name} 模型列表`}
        className="flex min-h-0 min-w-0 flex-col overflow-hidden p-4 lg:p-5"
      >
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <Badge
                variant="outline"
                className={
                  selected.configured
                    ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {selected.configured ? "已配置" : "未配置"}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw
              data-icon="inline-start"
              aria-hidden="true"
              className={pending ? "animate-spin" : ""}
            />
            {pending ? "刷新中" : "刷新配置"}
          </Button>
        </div>
        <div className="mt-4 shrink-0">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="font-medium">API 地址</span>
          </div>
          <div
            className="break-all rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5"
            aria-label="API 地址"
          >
            {selected.apiAddress ??
              (selected.id === "bedrock"
                ? "由服务 SDK 根据区域确定"
                : "尚未配置")}
          </div>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">模型</h3>
            <Badge variant="secondary">{selected.models.length}</Badge>
          </div>
          <div className="relative w-full sm:w-56">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="搜索模型"
              placeholder="搜索模型名称或 ID…"
              value={modelSearch}
              onChange={(event) => setModelSearch(event.target.value)}
              className="h-8 pl-8"
            />
          </div>
        </div>
        <div
          className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain"
          key={selected.id}
          aria-label="模型滚动列表"
          tabIndex={0}
        >
          {visibleModels.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {visibleModels.map((model) => (
                <ModelRow key={model.id} model={model} />
              ))}
            </ul>
          )}
          {!visibleModels.length && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
              <Cpu
                className="mb-3 size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <h3 className="text-sm font-medium">
                {modelSearch.trim() ? "没有匹配的模型" : "尚未登记模型"}
              </h3>
              <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                {modelSearch.trim()
                  ? "试试其他名称或模型 ID。"
                  : "在服务端供应商配置中填写模型名称，刷新后即可查看。"}
              </p>
            </div>
          )}
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            模型能力和容量来自本地目录；供应商实际支持情况以调用结果为准。
          </p>
        </div>
      </section>
    </div>
  );
}
