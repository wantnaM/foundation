import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/manrope";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: { default: "Foundation · 通用项目框架", template: "%s · Foundation" },
  description: "基于 Next.js、React 与 TypeScript 的通用项目框架",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", inter.variable)}>
      <body className="flex min-h-dvh flex-col antialiased">
        <TooltipProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
