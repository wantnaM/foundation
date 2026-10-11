import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { aiDataDir } from "./config";

const instances = new Map<string, DatabaseSync>();
export function aiDB() {
  const dir = aiDataDir();
  let db = instances.get(dir);
  if (!db) {
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, "ai.sqlite"));
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY, started TEXT NOT NULL, owner TEXT NOT NULL, task TEXT,
        module TEXT NOT NULL, stage TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
        status TEXT NOT NULL, duration INTEGER, input_tokens INTEGER, output_tokens INTEGER,
        estimated_cost REAL, currency TEXT NOT NULL, error_code TEXT
      );
      CREATE INDEX IF NOT EXISTS calls_started ON calls(started);
      CREATE INDEX IF NOT EXISTS calls_owner ON calls(owner);
      CREATE TABLE IF NOT EXISTS login_limits (id TEXT PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
    instances.set(dir, db);
  }
  return db;
}
export function aiReport() {
  const db = aiDB();
  return {
    calls: db
      .prepare(
        "SELECT * FROM calls ORDER BY started DESC, rowid DESC LIMIT 100",
      )
      .all(),
    totals: db
      .prepare(
        "SELECT COUNT(*) AS calls, SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS success, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN status='demo' THEN 1 ELSE 0 END) AS demo, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running, SUM(CASE WHEN status IN ('success','failed','cancelled') AND (input_tokens IS NULL OR output_tokens IS NULL) THEN 1 ELSE 0 END) AS unknown_usage, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens FROM calls",
      )
      .get(),
    groups: db
      .prepare(
        "SELECT module,stage,provider,model,currency,COUNT(*) AS calls,SUM(input_tokens) AS input_tokens,SUM(output_tokens) AS output_tokens,SUM(estimated_cost) AS estimated_cost FROM calls GROUP BY module,stage,provider,model,currency ORDER BY calls DESC",
      )
      .all(),
  };
}
export function closeAIDatabases() {
  for (const db of instances.values()) db.close();
  instances.clear();
}
