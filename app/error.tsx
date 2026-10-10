"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-[65vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl font-semibold">页面暂时无法加载</h1>
      <p className="text-muted-foreground">请重试，或稍后刷新页面。</p>
      <Button onClick={reset}>重新加载</Button>
    </main>
  );
}
