import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { agents } from "@/config/agents";
import { getAgentFormConfig } from "@/config/agent-forms";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceContent } from "@/components/layout/workspace-content";
import { AgentConfigForm } from "@/components/agents/agent-config-form";

type Props = { params: Promise<{ agentId: string }> };

export function generateStaticParams() {
  return agents.map((agent) => ({ agentId: agent.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agentId } = await params;
  return {
    title:
      agents.find((agent) => agent.id === agentId)?.title ?? "智能体不存在",
  };
}

export default async function AgentDetailPage({ params }: Props) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) notFound();

  return (
    <>
      <SiteHeader
        title={agent.title}
        breadcrumbs={[{ label: "智能体", href: "/app/agent" }]}
      />
      <WorkspaceContent>
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:gap-10">
          <div className="flex flex-col gap-3 text-center">
            <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              让我们定制你的<span className="text-primary">{agent.title}</span>
              吧。
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              添加学习目标、主题，再补充背景信息，以定制你的资源。
            </p>
          </div>
          <AgentConfigForm
            key={agent.id}
            agent={agent}
            config={getAgentFormConfig(agent)}
          />
        </section>
      </WorkspaceContent>
    </>
  );
}
