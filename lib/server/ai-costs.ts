import "server-only";
import { query } from "./db";
import type { UsageData, UsagePoint } from "../ai-usage";

/** First price also estimates earlier calls; subsequent edits apply from their save time. */
export async function getAICosts(
  start: string,
  end: string,
  provider = "",
  model = "",
): Promise<UsageData> {
  const identity = `COALESCE(provider_id, split_part(requested_model, ':', 1), '未知供应商') AS provider, COALESCE(provider_id || ':' || model_id, requested_model, '未知模型') AS model`;
  const [result, options] = await Promise.all([
    query<{
      kind: string;
      label: string;
      input: string | null;
      output: string | null;
      missing: string;
      count: string;
    }>(
      `
      WITH filtered AS (SELECT *, ${identity} FROM ai_requests
        WHERE started_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Shanghai') AND started_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Shanghai')),
      selected AS (SELECT * FROM filtered WHERE ($3='' OR provider=$3) AND ($4='' OR model=$4)),
      priced AS (SELECT r.*, p.id AS price_id,
        CASE WHEN input_tokens IS NOT NULL AND input_tokens>=0 AND
          (cache_read_tokens IS NOT NULL OR p.input_price=p.cache_hit_price) AND
          COALESCE(cache_read_tokens,0) BETWEEN 0 AND input_tokens
          THEN ((input_tokens-COALESCE(cache_read_tokens,0))*p.input_price + COALESCE(cache_read_tokens,0)*p.cache_hit_price)/1000000 END AS input_cost,
        CASE WHEN output_tokens>=0 THEN output_tokens*p.output_price/1000000 END AS output_cost
        FROM selected r LEFT JOIN LATERAL (
          SELECT * FROM model_prices p WHERE p.provider_id=r.provider AND p.model_id=COALESCE(r.model_id,substring(r.model FROM position(':' IN r.model)+1))
          ORDER BY CASE WHEN p.effective_at<=r.started_at THEN 0 ELSE 1 END,
            CASE WHEN p.effective_at<=r.started_at THEN p.effective_at END DESC, p.effective_at ASC, p.id DESC LIMIT 1
        ) p ON true)
      SELECT 'day' AS kind, to_char(started_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS label,
        sum(input_cost)::text AS input, sum(output_cost)::text AS output,
        count(*) FILTER(WHERE price_id IS NULL OR input_cost IS NULL OR output_cost IS NULL)::text AS missing, count(*)::text AS count
        FROM priced GROUP BY 2
      UNION ALL SELECT 'model', model, sum(input_cost)::text, sum(output_cost)::text,
        count(*) FILTER(WHERE price_id IS NULL OR input_cost IS NULL OR output_cost IS NULL)::text,count(*)::text FROM priced GROUP BY model`,
      [start, end, provider, model],
    ),
    query<{ provider: string; model: string }>(
      `SELECT DISTINCT ${identity} FROM ai_requests ORDER BY provider,model`,
    ),
  ]);
  const convert = (r: (typeof result.rows)[number]): UsagePoint => ({
    label: r.label,
    input: Number(r.input),
    output: Number(r.output),
    inputKnown: r.input !== null,
    outputKnown: r.output !== null,
    missing: Number(r.missing),
    count: Number(r.count),
  });
  const daily = new Map(
    result.rows
      .filter((r) => r.kind === "day")
      .map((r) => [r.label, convert(r)]),
  );
  const days: UsagePoint[] = [];
  for (
    let time = Date.parse(start);
    time <= Date.parse(end);
    time += 86400000
  ) {
    const label = new Date(time).toISOString().slice(0, 10);
    days.push(
      daily.get(label) ?? {
        label,
        input: 0,
        output: 0,
        inputKnown: true,
        outputKnown: true,
        missing: 0,
        count: 0,
      },
    );
  }
  return {
    days,
    models: result.rows
      .filter((r) => r.kind === "model")
      .map(convert)
      .sort((a, b) => b.input + b.output - a.input - a.output),
    options: options.rows,
  };
}
