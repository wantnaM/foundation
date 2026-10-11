"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Provider = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  apiKeyEnv?: string;
  models: {
    id: string;
    name: string;
    vision: boolean;
    currency: string;
    inputPrice?: number;
    outputPrice?: number;
  }[];
};
type Call = {
  id: string;
  started: string;
  module: string;
  stage: string;
  provider: string;
  model: string;
  status: string;
  duration: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  currency: string;
  error_code: string | null;
};
type Report = {
  config: {
    providers: Provider[];
    defaultModel: string;
    routes: Record<string, string>;
  };
  environmentManaged: boolean;
  readiness: { id: string; ready: boolean }[];
  totals: Record<string, number | null>;
  calls: Call[];
  groups: {
    module: string;
    stage: string;
    provider: string;
    model: string;
    calls: number;
    estimated_cost: number | null;
    currency: string;
    input_tokens: number | null;
    output_tokens: number | null;
  }[];
};
const statusLabel: Record<string, string> = {
  success: "成功",
  failed: "失败",
  running: "处理中",
  demo: "演示",
  cancelled: "已取消",
};
const cell = "border-b px-4 py-3 text-left whitespace-nowrap";
export function AIConsole({
  authenticated,
  demoLogin,
}: {
  authenticated: boolean;
  demoLogin: boolean;
}) {
  const [logged, setLogged] = useState(authenticated),
    [password, setPassword] = useState(""),
    [data, setData] = useState<Report | null>(null),
    [editor, setEditor] = useState(""),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const res = await fetch("/api/ai-admin", { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) {
      if (res.status === 401) setLogged(false);
      throw new Error(body.error);
    }
    setData(body);
    return body as Report;
  }, []);
  useEffect(() => {
    if (logged) void load().catch((e) => setMessage(e.message));
  }, [logged, load]);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/ai-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      if (action === "login") {
        setPassword("");
        setLogged(true);
      } else if (action === "logout") {
        setLogged(false);
        setData(null);
        setEditor("");
        setEditing(false);
      } else {
        await load();
        setMessage(
          action === "probe" ? body.text : "配置已保存，新调用将使用新配置。",
        );
        if (action === "save") setEditing(false);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "操作未完成");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground">
            FOUNDATION / 公共能力
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">AI 管理中心</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            统一管理模型连接，追踪平台调用与用量。
          </p>
        </div>
        {logged && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => action("logout")}
          >
            退出管理
          </Button>
        )}
      </header>
      {message && (
        <div
          role="status"
          className="rounded-lg border bg-muted/40 p-4 text-sm"
        >
          {message}
        </div>
      )}
      {!logged ? (
        <form
          className="max-w-md space-y-4 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            void action("login", { password });
          }}
        >
          <h2 className="text-xl font-medium">管理员登录</h2>
          <p className="text-sm text-muted-foreground">
            配置与平台用量仅对管理员开放。
          </p>
          {demoLogin && (
            <p className="rounded-md bg-muted p-3 text-sm">
              本地开发演示密码：demo-platform-admin。正式环境必须设置独立管理员密码。
            </p>
          )}
          <label className="block space-y-2">
            <span className="text-sm">管理员密码</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={256}
            />
          </label>
          <Button disabled={busy} type="submit">
            {busy ? "正在登录…" : "进入管理中心"}
          </Button>
        </form>
      ) : !data ? (
        <p>正在读取配置…</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-5 border-b pb-6 md:grid-cols-5">
            {[
              ["累计调用", data.totals.calls ?? 0],
              [
                "成功 / 失败",
                `${data.totals.success ?? 0} / ${data.totals.failed ?? 0}`,
              ],
              ["演示调用", data.totals.demo ?? 0],
              ["已报告输入量", data.totals.input_tokens ?? "未报告"],
              ["已报告输出量", data.totals.output_tokens ?? "未报告"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-medium">模型与连接</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(!editing);
                    setEditor(JSON.stringify(data.config, null, 2));
                  }}
                >
                  查看 / 修改配置
                </Button>
                <Button disabled={busy} onClick={() => action("probe")}>
                  {busy ? "处理中…" : "测试默认模型"}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void load().catch((e) => setMessage(e.message))
                  }
                >
                  刷新记录
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              默认：{data.config.defaultModel} ·
              测试真实模型会产生服务商用量；演示模型不调用外部服务。
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "服务商",
                      "连接状态",
                      "模型",
                      "图片输入",
                      "参考单价 / 百万单位",
                    ].map((x) => (
                      <th className={cell} key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.config.providers.flatMap((p) =>
                    p.models.map((m) => (
                      <tr key={`${p.id}:${m.id}`}>
                        <td className={cell}>
                          {p.name}
                          <span className="block text-xs text-muted-foreground">
                            {p.type}
                          </span>
                        </td>
                        <td className={cell}>
                          {!p.enabled
                            ? "已停用"
                            : p.type === "demo"
                              ? "演示"
                              : data.readiness.find((r) => r.id === p.id)?.ready
                                ? "已配置，待实测"
                                : "缺少密钥"}
                        </td>
                        <td className={cell}>
                          {m.name}
                          <span className="block text-xs text-muted-foreground">
                            {p.id}:{m.id}
                          </span>
                        </td>
                        <td className={cell}>
                          {m.vision ? "支持" : "未声明支持"}
                        </td>
                        <td className={cell}>
                          {m.inputPrice !== undefined &&
                          m.outputPrice !== undefined
                            ? `${m.currency} ${m.inputPrice} / ${m.outputPrice}`
                            : "未设置"}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            {editing && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm">
                  配置保存后对新调用生效；密钥只填写环境变量名称，不能填写密钥本身。阶段路由：
                  {Object.entries(data.config.routes)
                    .map(([k, v]) => `${k} → ${v}`)
                    .join("；") || "尚未设置，使用默认模型"}
                </p>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">公共 AI 配置</span>
                  <Textarea
                    className="min-h-80 font-mono text-xs"
                    value={editor}
                    onChange={(e) => setEditor(e.target.value)}
                    readOnly={data.environmentManaged}
                  />
                </label>
                <Button
                  disabled={busy || data.environmentManaged}
                  onClick={() => {
                    try {
                      void action("save", { config: JSON.parse(editor) });
                    } catch {
                      setMessage("配置不是有效 JSON，请检查括号与引号。");
                    }
                  }}
                >
                  保存配置
                </Button>
                {data.environmentManaged && (
                  <p className="text-sm">
                    当前由服务端环境变量管理，请在部署配置中修改并重启。
                  </p>
                )}
              </div>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-medium">用量汇总</h2>
            <p className="text-sm text-muted-foreground">
              费用按配置单价估算，分别显示币种，不代表供应商账单。未报告用量的真实调用：
              {data.totals.unknown_usage ?? 0} 次；演示不计真实用量。
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "模块 / 阶段",
                      "模型",
                      "次数",
                      "输入 / 输出",
                      "估算费用",
                    ].map((x) => (
                      <th className={cell} key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g, i) => (
                    <tr key={i}>
                      <td className={cell}>
                        {g.module} / {g.stage}
                      </td>
                      <td className={cell}>
                        {g.provider}:{g.model}
                      </td>
                      <td className={cell}>{g.calls}</td>
                      <td className={cell}>
                        {g.input_tokens ?? "未报告"} /{" "}
                        {g.output_tokens ?? "未报告"}
                      </td>
                      <td className={cell}>
                        {g.estimated_cost === null
                          ? "未知 / 未设置"
                          : `${g.currency} ${g.estimated_cost.toFixed(6)}（已知部分）`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.groups.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  暂无记录，测试一次模型后即可查看。
                </p>
              )}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-medium">最近 100 次调用</h2>
            <p className="text-sm text-muted-foreground">
              记录状态、耗时和用量，不保存输入材料、回复正文或密钥。
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "时间",
                      "模块 / 阶段",
                      "模型",
                      "结果",
                      "耗时",
                      "记录编号",
                    ].map((x) => (
                      <th className={cell} key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.calls.map((c) => (
                    <tr key={c.id}>
                      <td className={cell}>
                        {new Date(c.started).toLocaleString("zh-CN")}
                      </td>
                      <td className={cell}>
                        {c.module} / {c.stage}
                      </td>
                      <td className={cell}>
                        {c.provider}:{c.model}
                      </td>
                      <td className={cell}>
                        {statusLabel[c.status] || c.status}
                        {c.error_code && (
                          <span className="block text-xs text-muted-foreground">
                            {c.error_code}
                          </span>
                        )}
                      </td>
                      <td className={cell}>
                        {c.duration === null ? "—" : `${c.duration} ms`}
                      </td>
                      <td className={cell}>
                        <span title={c.id}>{c.id.slice(0, 8)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.calls.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  暂无调用日志。
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
