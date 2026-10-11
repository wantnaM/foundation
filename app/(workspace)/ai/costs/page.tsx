import type { Metadata } from "next";
import { AIManagementPage } from "@/components/ai/management-page";

export const metadata: Metadata = { title: "费用估值 · AI模型管理" };

export default function Page() {
  return <AIManagementPage section="costs" />;
}
