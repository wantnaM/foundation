import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { createLogger } from "@/lib/logger";
import { databaseConfig, DatabaseConfigurationError } from "./config";

const log = createLogger("Database");
const shared = globalThis as typeof globalThis & {
  foundationDatabasePool?: Pool;
};

// Lazy initialization keeps builds and non-database pages independent of credentials.
export function databasePool(): Pool {
  if (!shared.foundationDatabasePool) {
    const pool = new Pool(databaseConfig());
    // Never log connection strings, query arguments or driver errors containing data.
    pool.on("error", () =>
      log.error("空闲数据库连接已断开，下次请求将重新连接"),
    );
    shared.foundationDatabasePool = pool;
  }
  return shared.foundationDatabasePool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  return databasePool().query<T>(text, [...values]);
}

/** All statements in this callback must use the supplied client. */
export async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await databasePool().connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}

export async function databaseStatus(): Promise<
  "connected" | "unconfigured" | "unavailable"
> {
  try {
    await query("SELECT 1");
    return "connected";
  } catch (error) {
    return error instanceof DatabaseConfigurationError
      ? "unconfigured"
      : "unavailable";
  }
}

export async function closeDatabase(): Promise<void> {
  const pool = shared.foundationDatabasePool;
  shared.foundationDatabasePool = undefined;
  if (pool) await pool.end();
}
