import type { Metadata } from "next";
import { teacher } from "@/lib/server/grading/auth";
import { mode } from "@/lib/server/grading/config";
import { listTasks } from "@/lib/server/grading/store";
import { LoginPanel, TaskList } from "@/components/grading/grading-ui";
export const metadata: Metadata = { title: "AI 批改" };
export default async function GradingPage() {
  const user = await teacher();
  return user ? (
    <TaskList
      initial={listTasks(user.id).map((t) => ({ ...t, parsed: {} }))}
      mode={mode()}
    />
  ) : (
    <LoginPanel mode={mode()} />
  );
}
