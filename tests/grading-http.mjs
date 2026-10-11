// Run against a local demo server: node tests/grading-http.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
const origin = process.env.GRADING_TEST_ORIGIN || "http://localhost:3100";
async function call(path, cookie = "", init = {}) {
  return fetch(`${origin}/api/grading${path}`, {
    ...init,
    headers: { Origin: origin, Cookie: cookie, ...init.headers },
  });
}
const post = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
async function login(id) {
  const response = await call(
    "/login",
    "",
    post({ id, password: "demo-teacher" }),
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  return cookie.split(";")[0];
}
assert.equal((await call("")).status, 401);
const owner = await login("teacher"),
  other = await login("teacher2");
const form = new FormData();
form.set("title", "接口权限与上传验收");
form.set("subject", "数学");
form.set("level", "五年级");
for (const [role, name] of [
  ["paper", "题目"],
  ["reference", "参考答案"],
  ["student", "学生甲"],
]) {
  const sample = createCanvas(640, 480),
    context = sample.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, 640, 480);
  context.fillStyle = "black";
  context.font = "24px sans-serif";
  context.fillText(`${role}: 2.5 x 4 = 10`, 30, 60);
  form.append(
    role,
    new Blob([sample.toBuffer("image/png")], {
      type: "image/png",
    }),
    `${name}.png`,
  );
}
form.set("studentNames", JSON.stringify(["接口测试学生"]));
const key = randomUUID(),
  submit = { method: "POST", headers: { "Idempotency-Key": key }, body: form };
const response = await call("/tasks", owner, submit);
assert.equal(response.status, 201);
const { task: created } = await response.json();
const duplicate = await call("/tasks", owner, submit);
assert.equal((await duplicate.json()).task.id, created.id);
assert.equal((await call(`/tasks/${created.id}`, other)).status, 404);
assert.equal(
  (await call(`/tasks/${created.id}/files/${created.materials[0].id}`, other))
    .status,
  404,
);
assert.equal(
  (await call(`/tasks/${created.id}/export?format=pdf`, other)).status,
  404,
);
assert.equal(
  (
    await call(
      `/tasks/${created.id}`,
      other,
      post({ action: "retry", revision: 0 }),
    )
  ).status,
  404,
);
assert.equal(
  (
    await call(`/tasks/${created.id}`, owner, {
      ...post({}),
      headers: {
        Origin: "https://untrusted.invalid",
        "Content-Type": "application/json",
      },
    })
  ).status,
  403,
);
let task;
for (let i = 0; i < 30; i++) {
  task = (await (await call(`/tasks/${created.id}`, owner)).json()).task;
  if (task.status === "review" || task.status === "failed") break;
  await new Promise((r) => setTimeout(r, 1000));
}
assert.equal(task.status, "review");
assert.equal(task.cells.length, 3);
const preview = await call(`/tasks/${task.id}/export?format=csv`, owner);
assert.equal(preview.status, 200);
assert.match(await preview.text(), /演示结果/);
const file = await call(
  `/tasks/${task.id}/files/${task.materials[0].id}`,
  owner,
);
assert.equal(file.status, 200);
assert.match(file.headers.get("cache-control"), /no-store/);
assert.equal(
  (
    await call(
      `/tasks/${task.id}`,
      owner,
      post({ action: "confirm", revision: -1, cellIds: [task.cells[0].id] }),
    )
  ).status,
  409,
);
const confirmed = await call(
  `/tasks/${task.id}`,
  owner,
  post({
    action: "confirm",
    revision: task.revision,
    cellIds: task.cells.map((c) => c.id),
  }),
);
assert.equal(confirmed.status, 200);
assert.equal((await confirmed.json()).task.status, "completed");
const report = await call(`/tasks/${task.id}/export?format=pdf`, owner);
assert.equal(report.status, 200);
assert.equal(
  (await PDFDocument.load(await report.arrayBuffer())).getPageCount(),
  1,
);
assert.equal((await call("/logout", other, post({}))).status, 200);
assert.equal((await call("", other)).status, 401);
console.log(
  "HTTP 验收通过：登录、真实上传、去重、后台完成、账户隔离、文件权限、来源保护、旧版本冲突、确认与导出。",
);
