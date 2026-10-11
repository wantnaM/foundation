import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { query, closeDatabase } from "../lib/server/db";
import { migrateDatabase } from "../lib/server/db/migrate";
import { getModelPrices, saveModelPrice } from "../lib/server/model-prices";
import { priceKey } from "../lib/model-prices";
loadEnvConfig(process.cwd());
const original = process.env.DATABASE_URL;
const schema = `price_test_${randomUUID().replaceAll("-", "")}`;
let admin: Client;
before(async () => {
  assert.ok(original, "需要本地测试数据库");
  admin = new Client({ connectionString: original });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(original);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  await migrateDatabase();
});
after(async () => {
  await closeDatabase();
  if (admin) {
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
  process.env.DATABASE_URL = original;
});

test("人民币高峰价初始化、保存及历史保留，重复迁移不覆盖手动价格", async () => {
  const key = priceKey("deepseek", "deepseek-v4-flash");
  let prices = await getModelPrices();
  assert.deepEqual(prices[key], {
    input: "2",
    output: "8",
    cacheHit: "0.04",
    source: "deepseek-official-peak",
  });
  assert.equal(prices[priceKey("deepseek", "deepseek-v4-pro")].input, "9");
  assert.equal(Object.keys(prices).length, 2);
  const value = {
    provider: "deepseek",
    model: "deepseek-v4-flash",
    input: "3.125",
    output: "0",
    cacheHit: "0.000001",
  };
  await saveModelPrice(value);
  await saveModelPrice(value);
  await migrateDatabase();
  prices = await getModelPrices();
  assert.equal(prices[key].input, "3.125");
  assert.equal(prices[key].output, "0");
  const history = await query(
    "SELECT * FROM model_prices WHERE provider_id='deepseek' AND model_id='deepseek-v4-flash' ORDER BY id",
  );
  assert.equal(history.rows.length, 2);
  assert.equal(Number(history.rows[0].input_price), 2);
  for (const input of [
    "",
    "-1",
    "NaN",
    "Infinity",
    "1e2",
    "0.1234567",
    "10000000000",
  ])
    await assert.rejects(saveModelPrice({ ...value, input }));
  await assert.rejects(saveModelPrice({ ...value, model: "nonexistent" }));
  await assert.rejects(
    query(
      "INSERT INTO model_prices(provider_id,model_id,currency,input_price,output_price,cache_hit_price) VALUES('test','test','USD',1,1,1)",
    ),
  );
});
