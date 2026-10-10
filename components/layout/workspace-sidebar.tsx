"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  LayoutDashboard,
  Settings2,
  CircleHelp,
  Search,
} from "lucide-react";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { siteConfig } from "@/config/site";

export function WorkspaceSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar {...props}>
      <SidebarHeader className="px-6 py-8">
        <Link
          href="/app"
          onClick={() => setOpenMobile(false)}
          aria-label="Foundation 首页"
          className="inline-flex w-fit flex-col"
        >
          <span className="text-3xl font-bold tracking-tight">
            {siteConfig.name.toLowerCase()}
          </span>
          <span className="mt-1 h-1.5 w-full rounded-full bg-primary" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-4">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {siteConfig.navigation.map((item) => {
                const Icon = item.href === "/app/agent" ? Bot : LayoutDashboard;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-11 rounded-xl"
                      tooltip={item.label}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavSecondary
          className="mt-auto px-4"
          items={[
            { title: "Settings", icon: <Settings2 /> },
            { title: "Get Help", icon: <CircleHelp /> },
            { title: "Search", icon: <Search /> },
          ]}
        />
      </SidebarContent>
      <SidebarFooter className="px-4 pb-4">
        <NavUser
          user={{ name: "shadcn", email: "m@example.com", avatar: "" }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
