import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Check,
  Component,
  FolderCode,
  Layers,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const stack = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Lucide",
];
const directories = [
  ["app/", "页面、路由与 API", "01"],
  ["components/", "基础组件与公共布局", "02"],
  ["lib/", "客户端与服务端工具", "03"],
  ["hooks/ · types/ · config/", "Hooks、共享类型与应用配置", "04"],
  ["public/ · 文档/", "静态资源与项目说明", "05"],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-20">
      <section className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <div>
          <p className="mb-5 flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-600" />
            FOUNDATION / 01
          </p>
          <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            从一个干净的
            <br />
            <span className="text-muted-foreground">项目起点开始。</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
            页面、接口和基础组件已经就位。保留清晰的结构，给接下来的想法留出空间。
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {stack.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="rounded-md bg-background px-2.5 py-1 font-normal"
              >
                {name}
              </Badge>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/components">
                查看组件示例
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/health" target="_blank" rel="noreferrer">
                检查 API
              </a>
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="size-4 text-muted-foreground" />
              快速开始
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              pnpm
            </span>
          </div>
          <div className="space-y-5 bg-[#202823] p-6 font-mono text-sm text-[#e9efe9]">
            <div>
              <p className="mb-2 text-xs text-[#9aaa9f]"># 安装依赖</p>
              <p>
                <span className="text-[#9dc6ab]">$</span> pnpm install
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs text-[#9aaa9f]"># 启动开发环境</p>
              <p>
                <span className="text-[#9dc6ab]">$</span> pnpm dev
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs text-[#9aaa9f]"># 构建生产版本</p>
              <p>
                <span className="text-[#9dc6ab]">$</span> pnpm build
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
            <Check className="size-3.5 text-emerald-700" />
            本地运行无需配置环境变量
          </div>
        </div>
      </section>
      <section
        className="mt-16 grid gap-8 border-t pt-10 sm:mt-20 lg:grid-cols-[1fr_1.4fr] lg:gap-16"
        aria-labelledby="structure-heading"
      >
        <div>
          <span className="mb-4 flex size-10 items-center justify-center rounded-xl border bg-background">
            <FolderCode className="size-5" />
          </span>
          <h2
            id="structure-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            结构清晰，各就其位。
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
            沿用全栈项目的分层方式。页面默认在服务端渲染，交互按需进入客户端。
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5" />
              App Router
            </span>
            <span className="flex items-center gap-1.5">
              <Braces className="size-3.5" />
              严格类型
            </span>
            <span className="flex items-center gap-1.5">
              <Component className="size-3.5" />
              组件源码可编辑
            </span>
          </div>
        </div>
        <div className="divide-y">
          {directories.map(([name, description, index]) => (
            <div
              key={name}
              className="grid grid-cols-[1fr_auto] gap-2 py-4 first:pt-0"
            >
              <div>
                <p className="font-mono text-sm font-medium">{name}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
              <span className="pt-1 font-mono text-xs text-muted-foreground/60">
                {index}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
