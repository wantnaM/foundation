"use client";

import type { RowData } from "@tanstack/react-table";

import { useId, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { DataTableInstance } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DataTablePagination<TData extends RowData>({
  table,
  summary,
  language = "zh",
  pending = false,
  tableId,
}: {
  table: DataTableInstance<TData>;
  summary?: ReactNode;
  language?: "zh" | "en";
  pending?: boolean;
  tableId: string;
}) {
  const id = useId();
  const en = language === "en";
  const { pageIndex, pageSize } = table.state.pagination;
  const pages = Math.max(1, table.getPageCount());
  const buttons = [
    {
      label: en ? "Go to first page" : "第一页",
      icon: ChevronsLeft,
      disabled: !table.getCanPreviousPage(),
      action: () => table.setPageIndex(0),
    },
    {
      label: en ? "Go to previous page" : "上一页",
      icon: ChevronLeft,
      disabled: !table.getCanPreviousPage(),
      action: () => table.previousPage(),
    },
    {
      label: en ? "Go to next page" : "下一页",
      icon: ChevronRight,
      disabled: !table.getCanNextPage(),
      action: () => table.nextPage(),
    },
    {
      label: en ? "Go to last page" : "最后一页",
      icon: ChevronsRight,
      disabled: !table.getCanNextPage(),
      action: () => table.setPageIndex(pages - 1),
    },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4">
      <div className="text-sm text-muted-foreground">{summary}</div>
      <div className="flex flex-wrap items-center gap-4 lg:gap-8">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm font-medium">
            {en ? "Rows per page" : "每页条数"}
          </Label>
          <Select
            value={`${pageSize}`}
            disabled={pending}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger id={id} size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm font-medium">
          {en
            ? `Page ${pageIndex + 1} of ${pages}`
            : `第 ${pageIndex + 1} / ${pages} 页`}
        </div>
        <Pagination
          className="mx-0 w-auto"
          aria-label={en ? "Table pagination" : "表格分页"}
        >
          <PaginationContent className="gap-2">
            {buttons.map(({ label, icon: Icon, disabled, action }) => (
              <PaginationItem key={label}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label={label}
                  aria-controls={tableId}
                  disabled={pending || disabled}
                  onClick={action}
                >
                  <Icon />
                </Button>
              </PaginationItem>
            ))}
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
