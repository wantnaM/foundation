import type { ReactNode } from "react";

export function WorkspaceContent({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="workspace-content"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      tabIndex={0}
      role="region"
      aria-label="页面内容"
    >
      {children}
    </div>
  );
}
