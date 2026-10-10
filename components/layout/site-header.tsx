"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Blocks } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-10">
        <Link
          href="/"
          aria-label="Foundation 首页"
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Blocks className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl">
            {siteConfig.name}
            <span className="ml-2 hidden font-mono text-xs font-normal text-muted-foreground sm:inline">
              / starter
            </span>
          </span>
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-1">
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                pathname === item.href
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
          <a
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noreferrer"
            className="ml-2 hidden items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-foreground md:flex"
          >
            开发文档
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
}
