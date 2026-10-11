import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Task, Teacher } from "@/types/grading";
import { questionSchema, cellScore } from "@/types/grading";
import { HttpError } from "./auth";
import { byRequest, insertTask, readTask, saveTask, addHistory } from "./store";
import { mode, serviceConfig } from "./config";
import { putFile, deleteTaskFiles } from "./files";
import { demoQuestions, demoCrop } from "./demo";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  subject: z.string().min(1).max(40),
  level: z.string().min(1).max(40),
  instructions: z.string().max(12000).default(""),
});
export function ownedTask(id: string, user: Teacher) {
  const task = readTask(id, user.id);
  if (!task) throw new HttpError("任务不存在或无权访问", 404);
  return task;
}
export function editable(task: Task, revision: number) {
  if (task.revision !== revision)
    throw new HttpError("任务已更新，请刷新后再操作", 409);
  if (!["review", "completed"].includes(task.status))
    throw new HttpError("任务仍在处理或尚未完成，暂不能修改", 409);
}
function taskBase(user: Teacher, input: z.infer<typeof inputSchema>): Task {
  return {
    id: randomUUID(),
    ownerId: user.id,
    ...input,
    mode: mode(),
    status: "queued",
    stage: "materials",
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: 0,
    materials: [],
    students: [],
    questions: [],
    cells: [],
    notices: [],
    error: "",
    calls: 0,
    parsed: {},
    history: [],
  };
}
export async function createTask(user: Teacher, form: FormData, key: string) {
  const existing = byRequest(user.id, key);
  if (existing) return existing;
  if (mode() === "live") serviceConfig();
  const input = inputSchema.parse({
    title: form.get("title"),
    subject: form.get("subject"),
    level: form.get("level"),
    instructions: form.get("instructions") || "",
  });
  const task = taskBase(user, input);
  try {
    if (form.get("demo") === "true") {
      if (task.mode !== "demo") throw new HttpError("真实模式不能创建演示任务");
      for (const [i, name] of ["张小禾", "李明", "王安然"].entries()) {
        const id = `s${i + 1}`;
        const file = await demoCrop(
          task,
          name,
          demoQuestions[0],
          "内置演示学生材料",
        );
        const material = task.materials.find((m) => m.id === file)!;
        material.role = "student";
        material.studentId = id;
        task.students.push({ id, name, fileIds: [file], issue: "" });
      }
      const paper = await demoCrop(
        task,
        "教师",
        demoQuestions[0],
        "内置演示题目",
      );
      task.materials.find((m) => m.id === paper)!.role = "paper";
      const ref = await demoCrop(
        task,
        "教师",
        demoQuestions[1],
        "内置演示参考答案",
      );
      task.materials.find((m) => m.id === ref)!.role = "reference";
    } else {
      const paper = form
        .getAll("paper")
        .filter((v): v is File => v instanceof File && v.size > 0);
      const reference = form
        .getAll("reference")
        .filter((v): v is File => v instanceof File && v.size > 0);
      const submissions = form
        .getAll("student")
        .filter((v): v is File => v instanceof File && v.size > 0);
      if (!paper.length || !reference.length || !submissions.length)
        throw new HttpError("请上传题目、参考答案和至少一份学生作业");
      const all = [...paper, ...reference, ...submissions];
      if (
        all.length > 60 ||
        all.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024
      )
        throw new HttpError("每批最多 60 个文件，总大小不超过 100 MB");
      const names = z
        .array(z.string().trim().min(1).max(80))
        .parse(JSON.parse(String(form.get("studentNames") || "[]")));
      if (names.length !== submissions.length)
        throw new HttpError("每份学生作业都需要指定学生姓名或编号");
      for (const [role, files] of [
        ["paper", paper],
        ["reference", reference],
        ["student", submissions],
      ] as const) {
        for (const [i, file] of files.entries()) {
          let studentId: string | undefined;
          if (role === "student") {
            let student = task.students.find((s) => s.name === names[i]);
            if (!student) {
              student = {
                id: randomUUID(),
                name: names[i],
                fileIds: [],
                issue: "",
              };
              task.students.push(student);
            }
            studentId = student.id;
          }
          const material = await putFile(
            task.id,
            Buffer.from(await file.arrayBuffer()),
            file.name,
            role,
            studentId,
          );
          if (
            task.materials.some(
              (m) => m.role !== "crop" && m.hash === material.hash,
            )
          )
            throw new HttpError(
              `检测到重复材料：${file.name}，请移除重复文件后再提交`,
            );
          task.materials.push(material);
          if (task.materials.reduce((n, m) => n + m.pages, 0) > 100)
            throw new HttpError("每批材料总页数不超过 100 页");
          if (studentId)
            task.students
              .find((s) => s.id === studentId)!
              .fileIds.push(material.id);
        }
      }
    }
    addHistory(task, "材料已保存，等待后台自动处理");
    insertTask(task, key);
    return task;
  } catch (error) {
    await deleteTaskFiles(task.id);
    const duplicate = byRequest(user.id, key);
    if (duplicate) return duplicate;
    throw error;
  }
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    revision: z.number().int(),
    cellId: z.string(),
    score: z.number().nonnegative(),
    feedback: z.string().trim().min(1).max(6000),
    confirm: z.boolean(),
  }),
  z.object({
    action: z.literal("confirm"),
    revision: z.number().int(),
    cellIds: z.array(z.string()).min(1).max(10000),
  }),
  z.object({
    action: z.literal("rubric"),
    revision: z.number().int(),
    question: questionSchema,
  }),
  z.object({ action: z.literal("retry"), revision: z.number().int() }),
]);
export function act(task: Task, raw: unknown) {
  const input = actionSchema.parse(raw);
  if (input.action === "retry") {
    if (task.revision !== input.revision || task.status !== "failed")
      throw new HttpError("此任务当前不能重试", 409);
    task.status = "queued";
    task.error = "";
    addHistory(task, "教师请求继续未完成步骤");
    saveTask(task);
    return task;
  }
  editable(task, input.revision);
  if (input.action === "edit") {
    const cell = task.cells.find((c) => c.id === input.cellId);
    if (!cell) throw new HttpError("作答不存在", 404);
    const q = task.questions.find((q) => q.id === cell.questionId)!;
    if (
      input.score > q.maxScore ||
      !Number.isFinite(input.score) ||
      Math.abs(Math.round(input.score * 100) - input.score * 100) > 0.000001
    )
      throw new HttpError("分数应在本题范围内，最多两位小数");
    cell.finalScore = input.score;
    cell.finalFeedback = input.feedback;
    cell.protected = true;
    cell.confirmed = input.confirm;
    cell.issue = "";
    addHistory(
      task,
      `教师修改 ${task.students.find((s) => s.id === cell.studentId)!.name} 第${q.id}题，得分 ${input.score}${input.confirm ? "，已确认" : ""}`,
    );
  }
  if (input.action === "confirm") {
    const selected = task.cells.filter((c) => input.cellIds.includes(c.id));
    if (selected.length !== new Set(input.cellIds).size)
      throw new HttpError("确认范围不正确");
    if (selected.some((c) => c.issue || cellScore(c) === null))
      throw new HttpError("所选作答包含待确认问题，请先填写分数及反馈");
    for (const cell of selected) {
      cell.confirmed = true;
      cell.protected = true;
    }
    addHistory(task, `教师确认 ${selected.length} 份作答`);
  }
  if (input.action === "rubric") {
    const old = task.questions.find((q) => q.id === input.question.id);
    if (!old) throw new HttpError("题目不存在", 404);
    const protectedCells = task.cells.filter(
      (c) => c.questionId === old.id && c.protected,
    );
    if (protectedCells.length && input.question.maxScore !== old.maxScore)
      throw new HttpError(
        "该题已有人工修改或确认的成绩，请保留原满分，避免改变已确认成绩口径",
      );
    const updated = {
      ...input.question,
      version: old.version + 1,
      source: "teacher" as const,
    };
    task.questions = task.questions.map((q) => (q.id === old.id ? updated : q));
    let count = 0;
    for (const c of task.cells.filter(
      (c) => c.questionId === old.id && !c.protected,
    )) {
      c.grade = null;
      c.attempts = 0;
      c.issue = c.answer.issue;
      c.finalScore = null;
      c.finalFeedback = "";
      count++;
    }
    if (count) {
      task.status = "queued";
      task.stage = "grading";
      task.progress = 50;
    }
    addHistory(
      task,
      `第${old.id}题标准更新至版本 ${updated.version}：重批 ${count} 份，保护 ${protectedCells.length} 份人工结果`,
    );
  }
  if (task.status !== "queued")
    task.status = task.cells.every((c) => c.confirmed) ? "completed" : "review";
  saveTask(task);
  return task;
}
