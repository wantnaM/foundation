import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";
import { EssayGradingWorkspace } from "@/components/grading/essay-grading-workspace";

export const metadata: Metadata = { title: "语文作文批改" };

export default function ChineseEssayPage() {
  return (
    <>
      <SiteHeader
        title="语文作文批改"
        breadcrumbs={[{ label: "AI批改", href: "/app/grading" }]}
      />
      <WorkspaceContent>
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-3 text-center">
            <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              让每一篇<span className="text-primary">作文</span>，都有
              <span className="text-primary">进步</span>的方向
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              统一写作要求与评价标准，一次批改多篇作文。
            </p>
          </div>
          <EssayGradingWorkspace />
        </section>
      </WorkspaceContent>
    </>
  );
}
