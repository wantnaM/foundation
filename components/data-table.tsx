"use client";

import type { RowData } from "@tanstack/react-table";

import { useId, type ReactNode } from "react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type ReactTable,
} from "@tanstack/react-table";
import { ChevronDown, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/data-table-pagination";

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});
export type DataTableInstance<TData extends RowData> = ReactTable<
  typeof dataTableFeatures,
  TData
>;

export function DataTableColumnToggle<TData extends RowData>({
  table,
  label = "显示列",
}: {
  table: DataTableInstance<TData>;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 data-icon="inline-start" />
          {label}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {typeof column.columnDef.header === "string"
                ? column.columnDef.header
                : column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pages configure their own columns and state; this component renders the shared table. */
export function DataTable<TData extends RowData>({
  table,
  toolbar,
  rows,
  wrapTable,
  summary,
  emptyMessage = "暂无记录",
  bodyClassName,
  language = "zh",
  pending = false,
  fillColumn,
}: {
  table: DataTableInstance<TData>;
  toolbar?: ReactNode;
  rows?: ReactNode;
  wrapTable?: (content: ReactNode) => ReactNode;
  summary?: ReactNode;
  emptyMessage?: string;
  bodyClassName?: string;
  language?: "zh" | "en";
  pending?: boolean;
  fillColumn?: string;
}) {
  const tableId = useId();
  const content = (
    <Table
      id={tableId}
      className={fillColumn ? "table-fixed" : undefined}
      style={
        fillColumn
          ? {
              minWidth: table
                .getVisibleLeafColumns()
                .reduce((width, column) => width + column.getSize(), 0),
            }
          : undefined
      }
    >
      {fillColumn && (
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col
              key={column.id}
              style={
                column.id === fillColumn
                  ? undefined
                  : { width: column.getSize() }
              }
            />
          ))}
        </colgroup>
      )}
      <TableHeader className="sticky top-0 z-10 bg-muted">
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id} colSpan={header.colSpan}>
                {header.isPlaceholder ? null : <FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className={bodyClassName}>
        {table.getRowModel().rows.length ? (
          (rows ??
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  <FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          )))
        ) : (
          <TableRow>
            <TableCell
              colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
              className="h-36 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">{toolbar}</div>
          <DataTableColumnToggle table={table} />
        </div>
      )}
      <div className="overflow-hidden rounded-lg border">
        {wrapTable ? wrapTable(content) : content}
      </div>
      <DataTablePagination
        table={table}
        summary={summary}
        language={language}
        pending={pending}
        tableId={tableId}
      />
    </div>
  );
}
