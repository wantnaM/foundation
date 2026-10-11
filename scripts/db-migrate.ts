import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { migrateDatabase } = await import("../lib/server/db/migrate");
  const { closeDatabase } = await import("../lib/server/db");
  try {
    await migrateDatabase();
    console.log("数据库表结构已准备完成（已有记录会保留）");
  } catch {
    console.error("数据库表结构初始化失败，请检查连接配置及建表权限");
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main();
