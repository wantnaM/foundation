import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function AILayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
