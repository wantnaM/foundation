import "server-only";
import { z } from "zod";
import { query, transaction } from "./db";
import { getModelCatalog } from "./model-catalog";
import { priceKey, type ModelPrices } from "@/lib/model-prices";

const amount = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,6})?$/);
const priceSchema = z.object({
  provider: z.string(),
  model: z.string(),
  input: amount,
  output: amount,
  cacheHit: amount,
});

export async function getModelPrices(): Promise<ModelPrices> {
  const result = await query(
    `SELECT DISTINCT ON (provider_id,model_id) provider_id,model_id,input_price,output_price,cache_hit_price,source FROM model_prices ORDER BY provider_id,model_id,effective_at DESC,id DESC`,
  );
  return Object.fromEntries(
    result.rows.map((row) => [
      priceKey(row.provider_id, row.model_id),
      {
        input: String(Number(row.input_price)),
        output: String(Number(row.output_price)),
        cacheHit: String(Number(row.cache_hit_price)),
        source: row.source,
      },
    ]),
  );
}

export async function saveModelPrice(value: unknown) {
  const parsed = priceSchema.safeParse(value);
  if (!parsed.success) throw new Error("请输入非负价格，最多保留六位小数。");
  const data = parsed.data;
  const provider = getModelCatalog().providers.find(
    (item) => item.id === data.provider,
  );
  if (!provider?.models.some((item) => item.id === data.model))
    throw new Error("模型不存在，请刷新后重试。");
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(614035922)");
    // Append changes to retain the prices that applied before a later edit.
    await client.query(
      `INSERT INTO model_prices(provider_id,model_id,input_price,output_price,cache_hit_price)
      SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (
        SELECT 1 FROM (SELECT * FROM model_prices WHERE provider_id=$1 AND model_id=$2 ORDER BY effective_at DESC,id DESC LIMIT 1) latest
        WHERE input_price=$3::numeric AND output_price=$4::numeric AND cache_hit_price=$5::numeric
      )`,
      [data.provider, data.model, data.input, data.output, data.cacheHit],
    );
  });
}
