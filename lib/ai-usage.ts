export type UsageParams = {
  range?: string;
  start?: string;
  end?: string;
  provider?: string;
  model?: string;
};
export type UsagePoint = {
  label: string;
  input: number;
  output: number;
  missing: number;
  count: number;
  inputKnown: boolean;
  outputKnown: boolean;
};
export type UsageData = {
  days: UsagePoint[];
  models: UsagePoint[];
  options: { provider: string; model: string }[];
};
export function usagePeriod(params: UsageParams, now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 10);
  const range = ["1", "7", "30", "custom"].includes(params.range ?? "")
    ? params.range!
    : "30";
  const valid = (v?: string) =>
    !!v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (range === "custom" && (!valid(params.start) || !valid(params.end)))
    throw new Error("日期无效");
  const end = range === "custom" ? params.end! : today;
  const start =
    range === "custom"
      ? params.start!
      : new Date(Date.parse(end) - (Number(range) - 1) * 86400000)
          .toISOString()
          .slice(0, 10);
  if (start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 365)
    throw new Error("日期范围无效");
  return { range, start, end };
}
