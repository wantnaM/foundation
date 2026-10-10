import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader({
  title = "Documents",
  actions,
}: {
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-(--header-height) shrink-0 items-center border-b">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 py-1 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <span className="shrink-0 text-base font-medium">{title}</span>
        {actions ? (
          <div className="ml-auto w-40 min-w-0 sm:w-80 lg:w-96">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
