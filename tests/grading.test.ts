import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import type { Task } from "../types/grading";
import { cellScore, validateGrade, studentSummary } from "../types/grading";

process.env.GRADING_DATA_DIR = path.join(
  process.cwd(),
  ".grading-data",
  "tests",
  randomUUID(),
);
Object.assign(process.env, { NODE_ENV: "test" });
process.env.GRADING_MODE = "demo";
import { createTask, act, ownedTask } from "../lib/server/grading/tasks";
import {
  db,
  claimTask,
  releaseTask,
  readTask,
  saveTask,
} from "../lib/server/grading/store";
import { processTask } from "../lib/server/grading/pipeline";
import { csvReport, pdfReport } from "../lib/server/grading/exports";
import { putFile, pageImages } from "../lib/server/grading/files";
import { serviceConfig } from "../lib/server/grading/config";
const user = { id: "test-teacher", name: "测试教师" };
let task: Task;
after(() => {
  db().close();
});
async function runQueued() {
  const lease = randomUUID();
  const next = claimTask(lease);
  assert.ok(next);
  await processTask(next, lease);
  releaseTask(next.id, lease);
  return readTask(next.id)!;
}

test("完整演示流程持久保存且疑题不记零分", async () => {
  const form = new FormData();
  form.set("title", "验收任务");
  form.set("subject", "数学");
  form.set("level", "五年级");
  form.set("demo", "true");
  const key = randomUUID();
  const created = await createTask(user, form, key);
  assert.equal((await createTask(user, form, key)).id, created.id);
  task = await runQueued();
  assert.equal(task.status, "review");
  assert.equal(task.cells.length, 9);
  assert.equal(task.progress, 100);
  const unresolved = task.cells.find((c) => c.issue)!;
  assert.ok(unresolved);
  assert.equal(cellScore(unresolved), null);
  assert.equal(task.materials.filter((m) => m.role === "crop").length, 9);
  assert.equal(studentSummary(task, task.students[0].id).score, 10);
});
test("账户隔离及旧版本修改保护", () => {
  assert.throws(
    () => ownedTask(task.id, { id: "other", name: "其他教师" }),
    /无权/,
  );
  assert.throws(
    () =>
      act(structuredClone(task), {
        action: "confirm",
        revision: -1,
        cellIds: [task.cells[0].id],
      }),
    /更新/,
  );
});
test("疑题不得直接批量确认，分数越界不得保存", () => {
  const cell = task.cells.find((c) => c.issue)!;
  assert.throws(
    () =>
      act(structuredClone(task), {
        action: "confirm",
        revision: task.revision,
        cellIds: [cell.id],
      }),
    /待确认/,
  );
  assert.throws(
    () =>
      act(structuredClone(task), {
        action: "edit",
        revision: task.revision,
        cellId: cell.id,
        score: 999,
        feedback: "核对原稿",
        confirm: true,
      }),
    /范围/,
  );
});
test("教师确认保护、标准调整重批与最终成绩一致", async () => {
  const first = task.cells[0];
  act(task, {
    action: "edit",
    revision: task.revision,
    cellId: first.id,
    score: 1.5,
    feedback: "教师核对后修改",
    confirm: true,
  });
  const q = task.questions[0];
  act(task, {
    action: "rubric",
    revision: task.revision,
    question: { ...q, rubric: "结果正确得满分，保留教师已确认结果。" },
  });
  task = await runQueued();
  assert.equal(task.cells[0].finalScore, 1.5);
  assert.equal(task.cells[0].confirmed, true);
  assert.equal(task.cells[0].rubricVersion, 1);
  const issue = task.cells.find((c) => c.issue)!;
  act(task, {
    action: "edit",
    revision: task.revision,
    cellId: issue.id,
    score: 2,
    feedback: "教师已查看作答，结果正确。",
    confirm: true,
  });
  act(task, {
    action: "confirm",
    revision: task.revision,
    cellIds: task.cells.filter((c) => !c.confirmed).map((c) => c.id),
  });
  assert.equal(task.status, "completed");
  assert.equal(studentSummary(task, task.students[0].id).score, 9.5);
  const saved = readTask(task.id, user.id)!;
  assert.equal(saved.status, "completed");
  assert.equal(saved.cells[0].finalScore, 1.5);
  assert.match(csvReport(saved), /9.5/);
  const bytes = await pdfReport(saved);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
});
test("分项合计异常被拦截，导出防止表格公式执行", () => {
  assert.match(
    validateGrade(
      {
        score: 3,
        parts: [{ label: "步骤", score: 1, max: 2 }],
        feedback: "测试",
        evidence: "作答",
        issue: "",
      },
      task.questions[0],
    ),
    /合计/,
  );
  const copy = structuredClone(task);
  copy.students[0].name = '=HYPERLINK("x")';
  assert.match(csvReport(copy), /'=HYPERLINK/);
});
test("真实文件类型检查与 PDF 逐页渲染", async () => {
  await assert.rejects(
    () => putFile(task.id, Buffer.from("fake"), "fake.png", "student"),
    /不是可读取/,
  );
  const document = await PDFDocument.create();
  document.addPage([300, 400]).drawText("PDF render validation");
  const file = await putFile(
    task.id,
    Buffer.from(await document.save()),
    "sample.pdf",
    "paper",
  );
  task.materials.push(file);
  const pages = await pageImages(task, file);
  assert.equal(pages.length, 1);
  assert.ok((await sharp(pages[0]).metadata()).width);
});
test("后台租约过期后可恢复，旧处理者不能覆盖新结果", () => {
  const copy = structuredClone(task);
  copy.id = randomUUID();
  copy.status = "queued";
  copy.revision = 0;
  const { id } = copy;
  db()
    .prepare(
      "INSERT INTO tasks (id,owner,body,status,request_key) VALUES (?,?,?,?,?)",
    )
    .run(id, user.id, JSON.stringify(copy), copy.status, randomUUID());
  const first = claimTask("old-worker")!;
  assert.equal(first.id, id);
  db().prepare("UPDATE tasks SET lease_until=0 WHERE id=?").run(id);
  const recovered = claimTask("new-worker")!;
  assert.equal(recovered.id, id);
  assert.throws(() => saveTask(first, "old-worker"), /发生变化/);
  recovered.status = "review";
  saveTask(recovered, "new-worker");
  releaseTask(id, "new-worker");
});
test("切换真实模式时配置缺失必须失败，不能自动回退演示", () => {
  process.env.GRADING_MODE = "live";
  delete process.env.GRADING_AI_API_KEY;
  assert.throws(() => serviceConfig(), /配置完整/);
  process.env.GRADING_MODE = "demo";
});
test("真实 OCR 与看图模型接口契约端到端验证（本地服务替身）", async () => {
  let ocrCalls = 0,
    aiCalls = 0;
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk.toString();
    const body = JSON.parse(text);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/layout-parsing") {
      ocrCalls++;
      if (ocrCalls === 1) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: "temporary rate limit" }));
        return;
      }
      assert.equal(body.fileType, 1);
      assert.ok(body.file);
      res.end(
        JSON.stringify({
          result: {
            layoutParsingResults: [
              {
                prunedResult: {
                  parsing_res_list: [
                    {
                      block_content: "1. 2.5 × 4 = 10",
                      block_bbox: [0, 0, 300, 100],
                    },
                  ],
                },
              },
            ],
          },
        }),
      );
      return;
    }
    aiCalls++;
    assert.equal(req.headers.authorization, "Bearer test-only-key");
    assert.ok(
      body.messages[1].content.some(
        (c: { type: string }) => c.type === "image_url",
      ),
    );
    const prompt = body.messages[0].content as string;
    const payload = JSON.parse(body.messages[1].content[0].text);
    const result = prompt.includes("questions 数组")
      ? {
          questions: [
            {
              id: "1",
              title: "2.5 × 4",
              reference: "10",
              maxScore: 2,
              rubric: "正确得 2 分",
              kind: "objective",
              source: "teacher",
            },
          ],
          notices: [],
        }
      : prompt.includes("answers 数组")
        ? {
            answers: [
              {
                questionId: "1",
                text: "10",
                issue: "",
                blockIds: [payload.pages[0].blocks[0].id],
              },
            ],
          }
        : {
            score: 2,
            feedback: "结果正确",
            evidence: "10",
            issue: "",
            parts: [{ label: "结果", score: 2, max: 2 }],
          };
    res.end(
      JSON.stringify({
        id: "test-completion",
        object: "chat.completion",
        created: 1,
        model: "test-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: JSON.stringify(result) },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  process.env.GRADING_MODE = "live";
  process.env.GRADING_OCR_URL = `${base}/layout-parsing`;
  process.env.GRADING_AI_BASE_URL = `${base}/v1`;
  process.env.GRADING_AI_API_KEY = "test-only-key";
  process.env.GRADING_AI_MODEL = "test-model";
  try {
    const form = new FormData();
    form.set("title", "真实接口契约测试");
    form.set("subject", "数学");
    form.set("level", "五年级");
    form.set("studentNames", JSON.stringify(["验收学生"]));
    for (const [index, role] of ["paper", "reference", "student"].entries()) {
      const bytes = await sharp({
        create: {
          width: 400,
          height: 200,
          channels: 3,
          background: { r: 200 + index, g: 230, b: 245 },
        },
      })
        .png()
        .toBuffer();
      form.append(
        role,
        new File([new Uint8Array(bytes)], `${role}.png`, { type: "image/png" }),
      );
    }
    await createTask(user, form, randomUUID());
    const result = await runQueued();
    assert.equal(result.mode, "live");
    assert.equal(result.status, "review");
    assert.equal(result.cells[0].grade?.score, 2);
    assert.equal(result.cells[0].answer.cropIds.length, 1);
    assert.equal(ocrCalls, 4);
    assert.equal(aiCalls, 3);
    assert.ok(
      result.history.some((entry) => entry.message.includes("自动重试")),
    );
  } finally {
    process.env.GRADING_MODE = "demo";
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
