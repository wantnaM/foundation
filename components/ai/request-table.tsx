"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  useTable,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import {
  DataTable,
  dataTableFeatures,
  type DataTableInstance,
} from "@/components/data-table";
import {
  RequestStatusBadge,
  statusLabels,
} from "@/components/ai/request-display";
import { RefreshLogs } from "@/components/ai/refresh-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RequestStatus } from "@/lib/server/ai-requests";

export type RequestTableRow = {
  id: string;
  time: string;
  model: string;
  source: string;
  preview: string;
  status: RequestStatus;
  duration: string;
  tokens: string;
};

const column = createColumnHelper<typeof dataTableFeatures, RequestTableRow>();
const columns = [
  column.display({
    id: "time",
    header: "请求时间",
    size: 145,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs tabular-nums">
        {row.original.time}
      </span>
    ),
  }),
  column.display({
    id: "model",
    header: "模型",
    size: 190,
    cell: ({ row }) => (
      <span className="block truncate font-medium" title={row.original.model}>
        {row.original.model}
      </span>
    ),
  }),
  column.display({
    id: "source",
    header: "来源",
    size: 100,
    cell: ({ row }) => (
      <span
        className="block truncate text-muted-foreground"
        title={row.original.source}
      >
        {row.original.source}
      </span>
    ),
  }),
  column.display({
    id: "preview",
    header: "请求内容",
    size: 120,
    cell: ({ row }) => (
      <span className="block truncate" title={row.original.preview}>
        {row.original.preview || "—"}
      </span>
    ),
  }),
  column.display({
    id: "status",
    header: "状态",
    size: 64,
    cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
  }),
  column.display({
    id: "duration",
    header: "耗时",
    size: 72,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.original.duration}
      </span>
    ),
  }),
  column.display({
    id: "tokens",
    header: "输入 / 输出 Tokens",
    size: 132,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.original.tokens}
      </span>
    ),
  }),
  column.display({
    id: "actions",
    header: "操作",
    size: 88,
    enableHiding: false,
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/ai/logs/${row.original.id}`}>查看详情</Link>
      </Button>
    ),
  }),
];

export function RequestTable({
  rows,
  page,
  pages,
  pageSize,
  total,
  status,
  modelSearch,
}: {
  rows: RequestTableRow[];
  page: number;
  pages: number;
  pageSize: number;
  total: string;
  status?: RequestStatus;
  modelSearch: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({});
  function navigate(
    nextPage: number,
    nextSize: number,
    nextStatus = status ?? "all",
    nextModel = modelSearch,
  ) {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(nextSize),
    });
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextModel.trim()) params.set("model", nextModel.trim());
    startTransition(() => router.push(`/ai/logs?${params}`));
  }
  const pagination = { pageIndex: page - 1, pageSize };
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: { columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    pageCount: pages,
    onPaginationChange: (update) => {
      const next = typeof update === "function" ? update(pagination) : update;
      navigate(
        next.pageSize === pageSize ? next.pageIndex + 1 : 1,
        next.pageSize,
      );
    },
  }) satisfies DataTableInstance<RequestTableRow>;

  return (
    <DataTable
      table={table}
      pending={pending}
      fillColumn="preview"
      summary={<>共 {total} 条</>}
      emptyMessage={
        status || modelSearch
          ? "没有符合当前条件的请求"
          : "暂无请求记录，运行 pnpm ai:chat 后点击刷新记录"
      }
      toolbar={
        <>
          <Select
            value={status ?? "all"}
            disabled={pending}
            onValueChange={(value) => navigate(1, pageSize, value)}
          >
            <SelectTrigger
              id="request-status"
              aria-label="请求状态"
              size="sm"
              className="w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("model");
              navigate(
                1,
                pageSize,
                status ?? "all",
                typeof value === "string" ? value : "",
              );
            }}
          >
            <Input
              key={modelSearch}
              name="model"
              type="search"
              aria-label="模型名称"
              placeholder="搜索模型名称…"
              defaultValue={modelSearch}
              className="h-8 w-52"
              disabled={pending}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending}
            >
              <Search data-icon="inline-start" />
              搜索
            </Button>
          </form>
          <RefreshLogs />
        </>
      }
    />
  );
}
