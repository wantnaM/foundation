import type { Metadata } from "next";

import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";

import data from "./data.json";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <WorkspaceContent>
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards />
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive />
            </div>
            <DataTable data={data} />
          </div>
        </div>
      </WorkspaceContent>
    </>
  );
}
