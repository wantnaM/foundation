import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { query, closeDatabase } = await import("../lib/server/db");
  try {
    await query("SELECT 1");
    console.log("PostgreSQL 连接成功。");
  } catch {
    console.error(
      "PostgreSQL 连接失败，请检查 .env.local、账号权限与数据库服务。",
    );
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main();
