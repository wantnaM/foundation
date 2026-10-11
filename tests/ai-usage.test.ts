import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { query, closeDatabase } from "../lib/server/db";
import { migrateDatabase } from "../lib/server/db/migrate";
import { getAIUsage } from "../lib/server/ai-usage";
import { usagePeriod } from "../lib/ai-usage";
loadEnvConfig(process.cwd());
const original = process.env.DATABASE_URL;
const schema = `usage_test_${randomUUID().replaceAll("-", "")}`;
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
test("日期按北京时间划分，验证范围和真实日期", () => {
  assert.deepEqual(
    usagePeriod({ range: "1" }, new Date("2026-10-10T16:00:00Z")),
    { range: "1", start: "2026-10-11", end: "2026-10-11" },
  );
  assert.equal(
    usagePeriod({}, new Date("2026-10-11T01:00:00Z")).start,
    "2026-09-12",
  );
  for (const [start, end] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-10-12", "2026-10-11"],
    ["2024-01-01", "2026-01-01"],
  ])
    assert.throws(() => usagePeriod({ range: "custom", start, end }));
});
test("汇总跨天、多模型、失败用量，缺失用量不当作零，缓存思考不重复累加", async () => {
  for (const [date, model, input, output, status] of [
    ["2026-10-10T15:59:59Z", "a", 900, 900, "succeeded"],
    ["2026-10-10T16:00:00Z", "a", 100, 20, "succeeded"],
    ["2026-10-11T15:59:59Z", "a", 30, 10, "failed"],
    ["2026-10-11T16:00:00Z", "a", 800, 800, "succeeded"],
    ["2026-10-11T02:00:00Z", "b", 50, null, "succeeded"],
    ["2026-10-11T02:01:00Z", "c", null, null, "failed"],
  ] as const)
    await query(
      `INSERT INTO ai_requests(id,started_at,completed_at,status,source,requested_model,provider_id,model_id,request_body,input_tokens,output_tokens,cache_read_tokens,reasoning_tokens) VALUES($1,$2,$2,$3,'test',$4,'test',$5,'{}',$6,$7,5,3)`,
      [randomUUID(), date, status, `test:${model}`, model, input, output],
    );
  const data = await getAIUsage("2026-10-11", "2026-10-11");
  assert.equal(data.days[0].input, 180);
  assert.equal(data.days[0].output, 30);
  assert.equal(data.days[0].missing, 2);
  assert.equal(data.models.length, 3);
  assert.equal(data.models[0].label, "test:a");
  assert.equal(
    data.models.find((r) => r.label === "test:b")?.outputKnown,
    false,
  );
  const selected = await getAIUsage(
    "2026-10-11",
    "2026-10-12",
    "test",
    "test:a",
  );
  assert.equal(selected.days[0].input, 130);
  assert.equal(selected.days[1].input, 800);
  assert.equal(selected.models.length, 1);
  const empty = await getAIUsage("2026-10-13", "2026-10-14", "test");
  assert.equal(empty.models.length, 0);
  assert.equal(empty.days.length, 2);
  const injection = await getAIUsage(
    "2026-10-11",
    "2026-10-11",
    "test' OR 1=1 --",
  );
  assert.equal(injection.models.length, 0);
});
