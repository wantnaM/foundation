import { apiSuccess } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export function GET() {
  return apiSuccess({ status: "ok", timestamp: new Date().toISOString() });
}
