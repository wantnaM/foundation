import type { Metadata } from "next";
import { AgentLibrary } from "@/components/agents/agent-library";

export const metadata: Metadata = { title: "智能体" };

export default function AgentPage() {
  return <AgentLibrary />;
}
