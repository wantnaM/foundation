import "server-only";
import type { PoolConfig } from "pg";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("数据库未配置或配置不正确，请检查服务端环境配置");
  }
}

export function databaseConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseConfigurationError();
  try {
    const url = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2
    )
      throw new DatabaseConfigurationError();
  } catch {
    throw new DatabaseConfigurationError();
  }
  const max = Number(process.env.DATABASE_POOL_MAX ?? "10");
  if (!Number.isInteger(max) || max < 1 || max > 50)
    throw new DatabaseConfigurationError();
  return {
    connectionString,
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
    application_name: "foundation",
  };
}
