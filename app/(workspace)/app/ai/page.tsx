import { isAIAdmin, adminDemo } from "@/lib/server/ai/admin";
import { AIConsole } from "@/components/ai/ai-console";

export const dynamic = "force-dynamic";
export default async function AIPage() {
  return (
    <AIConsole authenticated={await isAIAdmin()} demoLogin={adminDemo()} />
  );
}
