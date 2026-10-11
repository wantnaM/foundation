import "server-only";
import { readFile } from "node:fs/promises";
import { transaction } from "./index";

/** Explicit deployment step; normal requests never create or alter tables. */
export async function migrateDatabase() {
  const sql = await readFile(
    new URL("./migrations/001-ai-requests.sql", import.meta.url),
    "utf8",
  );
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(614035921)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS foundation_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = await client.query(
      "SELECT 1 FROM foundation_migrations WHERE version = $1",
      ["001-ai-requests"],
    );
    if (applied.rowCount) return;
    await client.query(sql);
    await client.query(
      "INSERT INTO foundation_migrations(version) VALUES ($1)",
      ["001-ai-requests"],
    );
  });
}
