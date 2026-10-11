import "server-only";
import { query } from "./db";
import type { UsageData, UsagePoint } from "../ai-usage";
export async function getAIUsage(
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
 WITH filtered AS (SELECT *, ${identity} FROM ai_requests WHERE started_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Shanghai') AND started_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Shanghai')),
 selected AS (SELECT * FROM filtered WHERE ($3 = '' OR provider = $3) AND ($4 = '' OR model = $4))
 SELECT 'day' AS kind, to_char(started_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS label, sum(input_tokens)::text AS input, sum(output_tokens)::text AS output, count(*) FILTER (WHERE input_tokens IS NULL OR output_tokens IS NULL)::text AS missing, count(*)::text AS count FROM selected GROUP BY 2
 UNION ALL SELECT 'model', model, sum(input_tokens)::text, sum(output_tokens)::text, count(*) FILTER (WHERE input_tokens IS NULL OR output_tokens IS NULL)::text, count(*)::text FROM selected GROUP BY model`,
      [start, end, provider, model],
    ),
    query<{ provider: string; model: string }>(
      `SELECT DISTINCT ${identity} FROM ai_requests ORDER BY provider, model`,
    ),
  ]);
  const convert = (row: (typeof result.rows)[number]): UsagePoint => ({
    label: row.label,
    input: Number(row.input),
    inputKnown: row.input !== null,
    output: Number(row.output),
    outputKnown: row.output !== null,
    missing: Number(row.missing),
    count: Number(row.count),
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
