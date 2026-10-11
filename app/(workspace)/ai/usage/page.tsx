import type { Metadata } from "next";
import { AIManagementPage } from "@/components/ai/management-page";

export const metadata: Metadata = { title: "用量信息 · AI模型管理" };

export default function Page() {
  return <AIManagementPage section="usage" />;
}
