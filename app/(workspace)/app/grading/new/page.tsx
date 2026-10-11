import { redirect } from "next/navigation";
import { teacher } from "@/lib/server/grading/auth";
import { mode } from "@/lib/server/grading/config";
import { NewTask } from "@/components/grading/grading-ui";
export default async function NewGradingPage() {
  if (!(await teacher())) redirect("/app/grading");
  return <NewTask mode={mode()} />;
}
