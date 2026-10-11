import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";
import { EssayGradingCard } from "@/components/grading/essay-grading-card";

export const metadata: Metadata = { title: "AI批改" };

export default function GradingPage() {
  return (
    <>
      <SiteHeader title="AI批改" />
      <WorkspaceContent>
        <div className="space-y-6 px-4 py-6 lg:px-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <EssayGradingCard />
          </div>
        </div>
      </WorkspaceContent>
    </>
  );
}
