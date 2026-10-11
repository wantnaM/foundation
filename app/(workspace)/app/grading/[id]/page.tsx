import { redirect, notFound } from "next/navigation";
import { teacher } from "@/lib/server/grading/auth";
import { readTask } from "@/lib/server/grading/store";
import { TaskDetail } from "@/components/grading/grading-ui";
export default async function GradingTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await teacher();
  if (!user) redirect("/app/grading");
  const { id } = await params;
  const task = readTask(id, user.id);
  if (!task) notFound();
  return <TaskDetail initial={{ ...task, parsed: {} }} />;
}
