"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshLogs() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
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
      {pending ? "刷新中" : "刷新记录"}
    </Button>
  );
}
