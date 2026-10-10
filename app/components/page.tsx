import type { Metadata } from "next";
import { ComponentExamples } from "@/components/examples/component-examples";

export const metadata: Metadata = { title: "组件示例" };

export default function ComponentsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
      <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground">
        COMPONENTS / 02
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        从基础组件开始。
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        试试按钮、表单和弹窗。这里的交互仅用于展示，不会保存数据。
      </p>
      <ComponentExamples />
    </main>
  );
}
