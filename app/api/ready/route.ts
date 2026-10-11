import { databaseStatus } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseStatus();
  const ready = database === "connected";
  return Response.json(
    {
      success: ready,
      data: { status: ready ? "ready" : "not_ready", database },
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
