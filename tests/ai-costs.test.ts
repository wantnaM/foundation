import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { query, closeDatabase } from "../lib/server/db";
import { migrateDatabase } from "../lib/server/db/migrate";
import { getAICosts } from "../lib/server/ai-costs";

loadEnvConfig(process.cwd());
const original = process.env.DATABASE_URL;
const schema = `cost_test_${randomUUID().replaceAll("-", "")}`;
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

async function call(
  model: string,
  input: number | null,
  output: number | null,
  cache: number | null,
  started = "2026-10-11T02:00:00Z",
) {
  await query(
    `INSERT INTO ai_requests(id,started_at,completed_at,status,source,requested_model,provider_id,model_id,request_body,input_tokens,output_tokens,cache_read_tokens,reasoning_tokens) VALUES($1,$2,$2,'succeeded','test',$3,'deepseek',$4,'{}',$5,$6,$7,100)`,
    [randomUUID(), started, `deepseek:${model}`, model, input, output, cache],
  );
}
test("人民币估值：缓存从输入中扣除，思考不重复计费，首次价格用于历史记录", async () => {
  await call("deepseek-v4-flash", 1000000, 1000000, 250000);
  await call("deepseek-v4-pro", 1000000, 1000000, 0, "2026-10-10T15:59:59Z");
  const data = await getAICosts("2026-10-11", "2026-10-11");
  assert.equal(data.models.length, 1);
  assert.equal(data.models[0].input, 1.51);
  assert.equal(data.models[0].output, 8);
  assert.equal(data.models[0].missing, 0);
  const previous = await getAICosts("2026-10-10", "2026-10-10");
  assert.equal(previous.models[0].input, 9);
  assert.equal(previous.models[0].output, 27);
});
test("缺失价格和用量不当零元，允许已知部分汇总，筛选与空日期有效", async () => {
  await call("unpriced", 100, 100, 0);
  await call("deepseek-v4-flash", 100, 10, null);
  await call("deepseek-v4-flash", 100, 10, 101);
  const data = await getAICosts("2026-10-11", "2026-10-11");
  assert.equal(
    data.models.reduce((s, r) => s + r.missing, 0),
    3,
  );
  const unpriced = await getAICosts(
    "2026-10-11",
    "2026-10-11",
    "deepseek",
    "deepseek:unpriced",
  );
  assert.equal(unpriced.models[0].inputKnown, false);
  assert.equal(unpriced.models[0].outputKnown, false);
  const empty = await getAICosts("2026-10-12", "2026-10-13", "deepseek");
  assert.equal(empty.models.length, 0);
  assert.equal(empty.days.length, 2);
  const injection = await getAICosts("2026-10-11", "2026-10-11", "' OR 1=1 --");
  assert.equal(injection.models.length, 0);
});
test("修改价格按生效时间估算，各个模型分别计价", async () => {
  await query(
    `INSERT INTO model_prices(provider_id,model_id,input_price,output_price,cache_hit_price,effective_at) VALUES('deepseek','history',1,2,0.1,'2026-10-09'),('deepseek','history',3,4,0.2,'2026-10-11')`,
  );
  await call("history", 1000000, 1000000, 0, "2026-10-10T02:00:00Z");
  await call("history", 1000000, 1000000, 0, "2026-10-11T02:00:00Z");
  const data = await getAICosts(
    "2026-10-10",
    "2026-10-11",
    "deepseek",
    "deepseek:history",
  );
  assert.deepEqual(
    data.days.map((r) => [r.input, r.output]),
    [
      [1, 2],
      [3, 4],
    ],
  );
  assert.equal(data.models[0].input, 4);
});
