import { Badge } from "@/components/ui/badge";
import type { RequestStatus } from "@/lib/server/ai-requests";

export const statusLabels: Record<RequestStatus, string> = {
  running: "处理中",
  succeeded: "成功",
  failed: "失败",
  cancelled: "已取消 / 超时",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "succeeded"
          ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"
          : status === "failed" || status === "cancelled"
            ? "border-destructive/20 bg-destructive/5 text-destructive"
            : ""
      }
    >
      {statusLabels[status]}
    </Badge>
  );
}

export function requestTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function tokenDisplay(value: string | null) {
  return value === null ? "未知" : BigInt(value).toLocaleString("zh-CN");
}
