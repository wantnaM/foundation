import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import {
  databaseConfig,
  DatabaseConfigurationError,
} from "../lib/server/db/config";
import {
  closeDatabase,
  databasePool,
  databaseStatus,
  query,
  transaction,
} from "../lib/server/db";

loadEnvConfig(process.cwd());
after(closeDatabase);

test("错误配置被拦截，报错不包含账号密码", async () => {
  const savedUrl = process.env.DATABASE_URL;
  const savedMax = process.env.DATABASE_POOL_MAX;
  try {
    for (const value of [
      undefined,
      "https://user:secret@example.com/db",
      "postgresql://localhost/",
      "broken-secret",
    ]) {
      if (value === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = value;
      assert.throws(databaseConfig, DatabaseConfigurationError);
    }
    process.env.DATABASE_URL = "postgresql://user:secret@localhost/foundation";
    process.env.DATABASE_POOL_MAX = "0";
    assert.throws(databaseConfig, /数据库未配置或配置不正确/);
    process.env.DATABASE_POOL_MAX = "2";
    assert.equal(databaseConfig().max, 2);
    delete process.env.DATABASE_URL;
    assert.equal(await databaseStatus(), "unconfigured");
  } finally {
    if (savedUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedUrl;
    if (savedMax === undefined) delete process.env.DATABASE_POOL_MAX;
    else process.env.DATABASE_POOL_MAX = savedMax;
  }
});

test(
  "真实 PostgreSQL：参数化读写、事务提交、失败回滚和连接释放",
  {
    skip:
      !process.env.DATABASE_URL && "尚未配置真实数据库，不能宣称连接验证通过",
  },
  async () => {
    assert.equal(await databaseStatus(), "connected");
    assert.equal(databasePool(), databasePool());
    const input = "测试'); DROP TABLE anything; --";
    const committed = await transaction(async (client) => {
      await client.query(
        "CREATE TEMP TABLE foundation_db_check (value text NOT NULL) ON COMMIT DROP",
      );
      await client.query("INSERT INTO foundation_db_check(value) VALUES ($1)", [
        input,
      ]);
      return (await client.query("SELECT value FROM foundation_db_check"))
        .rows[0].value;
    });
    assert.equal(committed, input);
    assert.equal(
      (await query("SELECT to_regclass('pg_temp.foundation_db_check') AS name"))
        .rows[0].name,
      null,
    );

    // Creating this table and failing must roll back the table itself; no permanent test data.
    const table = `foundation_rollback_${randomUUID().replaceAll("-", "")}`;
    await assert.rejects(
      transaction(async (client) => {
        await client.query(`CREATE TABLE "${table}" (value integer)`);
        await client.query(`INSERT INTO "${table}" VALUES (1)`);
        throw new Error("intentional rollback");
      }),
      /intentional rollback/,
    );
    assert.equal(
      (await query("SELECT to_regclass($1) AS name", [table])).rows[0].name,
      null,
    );
    assert.equal((await query("SELECT 1 AS value")).rows[0].value, 1);
    assert.equal(databasePool().waitingCount, 0);
  },
);
