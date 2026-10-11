import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Task } from "@/types/grading";
import { dataDir, leaseMs } from "./config";

let instance: DatabaseSync | undefined;
export function db() {
  if (!instance) {
    mkdirSync(dataDir(), { recursive: true });
    instance = new DatabaseSync(path.join(dataDir(), "grading.sqlite"));
    instance.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, lease TEXT, lease_until INTEGER DEFAULT 0, request_key TEXT NOT NULL, UNIQUE(owner, request_key));
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_limits (account TEXT PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_versions VALUES (1, datetime('now'));`);
  }
  return instance;
}
export function readTask(id: string, owner?: string): Task | null {
  const row = (
    owner
      ? db()
          .prepare("SELECT body, revision FROM tasks WHERE id=? AND owner=?")
          .get(id, owner)
      : db().prepare("SELECT body, revision FROM tasks WHERE id=?").get(id)
  ) as { body: string; revision: number } | undefined;
  return row ? { ...JSON.parse(row.body), revision: row.revision } : null;
}
export function listTasks(owner: string): Task[] {
  const rows = db()
    .prepare(
      "SELECT body, revision FROM tasks WHERE owner=? ORDER BY rowid DESC LIMIT 100",
    )
    .all(owner) as { body: string; revision: number }[];
  return rows.map((r) => ({ ...JSON.parse(r.body), revision: r.revision }));
}
export function byRequest(owner: string, key: string): Task | null {
  const row = db()
    .prepare("SELECT id FROM tasks WHERE owner=? AND request_key=?")
    .get(owner, key) as { id: string } | undefined;
  return row ? readTask(row.id, owner) : null;
}
export function insertTask(task: Task, key: string) {
  db()
    .prepare(
      "INSERT INTO tasks (id,owner,body,status,request_key) VALUES (?,?,?,?,?)",
    )
    .run(task.id, task.ownerId, JSON.stringify(task), task.status, key);
}
export function saveTask(task: Task, lease?: string) {
  task.updatedAt = new Date().toISOString();
  const result = lease
    ? db()
        .prepare(
          "UPDATE tasks SET body=?,status=?,revision=revision+1 WHERE id=? AND revision=? AND lease=? AND lease_until>?",
        )
        .run(
          JSON.stringify(task),
          task.status,
          task.id,
          task.revision,
          lease,
          Date.now(),
        )
    : db()
        .prepare(
          "UPDATE tasks SET body=?,status=?,revision=revision+1 WHERE id=? AND owner=? AND revision=? AND (lease IS NULL OR lease_until<?)",
        )
        .run(
          JSON.stringify(task),
          task.status,
          task.id,
          task.ownerId,
          task.revision,
          Date.now(),
        );
  if (!result.changes) throw new Error("任务已发生变化，请刷新后重试");
  task.revision++;
}
export function claimTask(lease: string): Task | null {
  db().exec("BEGIN IMMEDIATE");
  try {
    const row = db()
      .prepare(
        "SELECT id FROM tasks WHERE status IN ('queued','processing') AND (lease IS NULL OR lease_until<?) ORDER BY rowid LIMIT 1",
      )
      .get(Date.now()) as { id: string } | undefined;
    if (!row) {
      db().exec("COMMIT");
      return null;
    }
    db()
      .prepare("UPDATE tasks SET lease=?,lease_until=? WHERE id=?")
      .run(lease, Date.now() + leaseMs, row.id);
    db().exec("COMMIT");
    return readTask(row.id);
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
  }
}
export function heartbeat(id: string, lease: string) {
  return db()
    .prepare(
      "UPDATE tasks SET lease_until=? WHERE id=? AND lease=? AND lease_until>?",
    )
    .run(Date.now() + leaseMs, id, lease, Date.now()).changes;
}
export function releaseTask(id: string, lease: string) {
  db()
    .prepare("UPDATE tasks SET lease=NULL,lease_until=0 WHERE id=? AND lease=?")
    .run(id, lease);
}
export function addHistory(task: Task, message: string) {
  task.history.push({ at: new Date().toISOString(), message });
  task.history = task.history.slice(-200);
}
