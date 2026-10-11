import "server-only";
import { readFile } from "node:fs/promises";
import { transaction } from "./index";

/** Explicit deployment step; normal requests never create or alter tables. */
export async function migrateDatabase() {
  const versions = ["001-ai-requests", "002-model-prices"];
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(614035921)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS foundation_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const version of versions) {
      const applied = await client.query(
        "SELECT 1 FROM foundation_migrations WHERE version = $1",
        [version],
      );
      if (applied.rowCount) continue;
      const sql = await readFile(
        new URL(`./migrations/${version}.sql`, import.meta.url),
        "utf8",
      );
      await client.query(sql);
      await client.query(
        "INSERT INTO foundation_migrations(version) VALUES ($1)",
        [version],
      );
    }
  });
}
