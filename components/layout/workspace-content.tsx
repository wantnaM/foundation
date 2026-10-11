import type { ReactNode } from "react";

export function WorkspaceContent({
  children,
  scrollable = true,
}: {
  children: ReactNode;
  scrollable?: boolean;
}) {
  return (
    <div
      data-slot="workspace-content"
      className={`min-h-0 flex-1 overscroll-contain ${scrollable ? "overflow-y-auto" : "overflow-hidden"}`}
      tabIndex={0}
      role="region"
      aria-label="页面内容"
    >
      {children}
    </div>
  );
}
