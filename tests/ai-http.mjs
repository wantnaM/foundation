import assert from "node:assert/strict";

const origin = process.env.AI_TEST_ORIGIN || "http://localhost:3000";
const url = `${origin}/api/ai-admin`;
const password = process.env.AI_TEST_PASSWORD || "demo-platform-admin";
const post = (body, cookie = "", requestOrigin = origin) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
assert.equal((await fetch(url)).status, 401);
assert.equal((await post({ action: "probe" })).status, 401);
assert.equal(
  (await post({ action: "login", password }, "", "https://foreign.example"))
    .status,
  403,
);
assert.equal(
  (await post({ action: "login", password: "invalid-password" })).status,
  400,
);
const login = await post({ action: "login", password });
assert.equal(login.status, 200);
const rawCookie = login.headers.get("set-cookie");
assert.match(rawCookie, /HttpOnly/i);
assert.match(rawCookie, /SameSite=strict/i);
const cookie = rawCookie.split(";")[0];
const before = await (await fetch(url, { headers: { Cookie: cookie } })).json();
assert.ok(before.config.providers.length);
assert.equal(
  (
    await post(
      {
        action: "save",
        config: { ...before.config, apiKey: "must-not-be-saved" },
      },
      cookie,
    )
  ).status,
  400,
);
assert.equal(
  (
    await post(
      {
        action: "save",
        config: { ...before.config, routes: { broken: "missing:model" } },
      },
      cookie,
    )
  ).status,
  400,
);
const after = await (await fetch(url, { headers: { Cookie: cookie } })).json();
assert.deepEqual(after.config, before.config);
assert.ok(!JSON.stringify(after).includes(password));
const chosen = after.config.providers.find((p) =>
  p.models.some(
    (m) =>
      `${p.id}:${m.id}` ===
      (after.config.routes.probe || after.config.defaultModel),
  ),
);
if (chosen?.type === "demo") {
  const probe = await post({ action: "probe" }, cookie);
  assert.equal(probe.status, 200);
  assert.equal((await probe.json()).demo, true);
  const report = await (
    await fetch(url, { headers: { Cookie: cookie } })
  ).json();
  assert.equal(report.totals.calls, before.totals.calls + 1);
  assert.equal(report.calls[0].status, "demo");
} else console.log("跳过真实模型测试，避免自动产生外部费用。");
const logout = await post({ action: "logout" }, cookie);
assert.equal(logout.status, 200);
assert.match(
  logout.headers.get("set-cookie"),
  /expires=Thu, 01 Jan 1970|Max-Age=0/i,
);
assert.equal((await fetch(url)).status, 401);
console.log(
  "AI 管理接口：登录、来源保护、权限、配置校验、日志及退出检查通过。",
);
