import type { ReactNode } from "react";
import { teacher } from "@/lib/server/grading/auth";
import { mode } from "@/lib/server/grading/config";
import { LogoutButton } from "@/components/grading/grading-ui";
import "@/components/grading/grading.css";

export default async function GradingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await teacher();
  return (
    <div className="grading-workspace">
      <header className="grading-topline">
        <span>
          AI 批改{" "}
          <span className="grading-mode">
            {mode() === "demo" ? "演示模式" : "真实服务"}
          </span>
        </span>
        {user && <LogoutButton teacher={user} />}
      </header>
      {children}
    </div>
  );
}
