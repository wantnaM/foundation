import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";

export const metadata: Metadata = { title: "语文作文批改" };

export default function ChineseEssayPage() {
  return (
    <>
      <SiteHeader
        title="语文作文批改"
        breadcrumbs={[{ label: "AI批改", href: "/app/grading" }]}
      />
      <WorkspaceContent>
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:gap-10">
          <div className="flex flex-col gap-3 text-center">
            <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              让我们开始<span className="text-primary">语文作文批改</span>吧。
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              根据作文内容与评分标准，提供评价与修改建议。
            </p>
          </div>
        </section>
      </WorkspaceContent>
    </>
  );
}
