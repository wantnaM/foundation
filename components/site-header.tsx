import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader({
  title = "Dashboard",
  breadcrumbs = [],
  actions,
}: {
  title?: string;
  breadcrumbs?: { label: string; href: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-(--header-height) shrink-0 items-center border-b">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 py-1 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-vertical:h-4 data-vertical:self-center"
        />
        <Breadcrumb className="min-w-0" aria-label="面包屑导航">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((item) => (
              <Fragment key={item.href}>
                <BreadcrumbItem className="hidden sm:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
              </Fragment>
            ))}
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {actions ? (
          <div className="ml-auto w-40 min-w-0 shrink-0 sm:w-80 lg:w-96">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
