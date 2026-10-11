"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url?: string;
    icon: React.ReactNode;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname();
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.url ? (
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === item.url || pathname.startsWith(`${item.url}/`)
                  }
                >
                  <Link
                    href={item.url}
                    aria-current={
                      pathname === item.url ||
                      pathname.startsWith(`${item.url}/`)
                        ? "page"
                        : undefined
                    }
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton>
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
