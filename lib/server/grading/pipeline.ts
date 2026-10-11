import "server-only";
import type { Task, Answer } from "@/types/grading";
import { validateGrade } from "@/types/grading";
import { addHistory, saveTask } from "./store";
import { demoQuestions, demoAnswer, demoCrop, demoGrade } from "./demo";
import {
  recognize,
  extractQuestions,
  extractAnswers,
  gradeAnswer,
  ProviderError,
} from "./providers";
import { mode, serviceConfig } from "./config";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function retry<T>(
  task: Task,
  save: () => void,
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (task.calls >= 500)
      throw new ProviderError(
        "本任务达到 500 次服务调用上限，剩余材料需检查后再处理",
        false,
      );
    try {
      return await fn();
    } catch (error) {
      save();
      if (!(error instanceof ProviderError) || !error.retryable || attempt >= 2)
        throw error;
      addHistory(task, `服务暂时繁忙，自动重试 ${attempt + 1}/2`);
      save();
      await wait(1000 * 2 ** attempt);
    }
  }
}
export async function processTask(task: Task, lease: string) {
  const save = () => saveTask(task, lease);
  try {
    if (task.mode !== mode())
      throw new Error(
        "运行模式已经切换，请恢复原模式处理旧任务；新模式请新建任务",
      );
    if (task.mode === "live") serviceConfig();
    task.status = "processing";
    task.error = "";
    save();
    if (task.stage === "materials") {
      addHistory(task, "开始整理材料、检查文件与学生归属");
      task.progress = 10;
      task.stage = "questions";
      save();
      if (task.mode === "demo") await wait(600);
    }
    if (task.stage === "questions") {
      if (task.mode === "demo") {
        task.questions = structuredClone(demoQuestions);
        task.notices = [
          "演示模式：识别内容、单题截图和 AI 分数均来自固定样例，不代表上传材料的真实内容。",
        ];
      } else {
        for (const file of task.materials.filter(
          (m) => m.role === "paper" || m.role === "reference",
        )) {
          if (!task.parsed[file.id]) {
            task.parsed[file.id] = await retry(task, save, () =>
              recognize(task, file.id),
            );
            save();
          }
        }
        task.questions = await retry(task, save, () =>
          extractQuestions(task, Object.values(task.parsed).flat()),
        );
      }
      addHistory(task, `已建立 ${task.questions.length} 道题目的统一评分标准`);
      task.progress = 25;
      task.stage = "answers";
      save();
    }
    if (task.stage === "answers") {
      for (const [index, student] of task.students.entries()) {
        if (task.cells.some((c) => c.studentId === student.id)) continue;
        let answers: Answer[];
        try {
          if (task.mode === "demo") {
            answers = [];
            for (const q of task.questions) {
              const a = demoAnswer(index, q);
              const crop = await demoCrop(task, student.name, q, a.text);
              answers.push({ ...a, cropIds: [crop] });
            }
          } else {
            for (const id of student.fileIds) {
              if (!task.parsed[id]) {
                task.parsed[id] = await retry(task, save, () =>
                  recognize(task, id),
                );
                save();
              }
            }
            answers = await retry(task, save, () =>
              extractAnswers(
                task,
                student.fileIds.flatMap((id) => task.parsed[id] || []),
              ),
            );
          }
        } catch (error) {
          student.issue =
            error instanceof Error ? error.message : "作答识别未完成";
          answers = task.questions.map((q) => ({
            questionId: q.id,
            text: "",
            issue: student.issue,
            regions: [],
            cropIds: [],
          }));
          addHistory(
            task,
            `${student.name} 的材料已记录为待确认，继续其他作业`,
          );
        }
        task.cells.push(
          ...answers.map((answer) => ({
            id: `${student.id}:${answer.questionId}`,
            studentId: student.id,
            questionId: answer.questionId,
            answer,
            grade: null,
            issue: answer.issue,
            confirmed: false,
            finalScore: null,
            finalFeedback: "",
            protected: false,
            rubricVersion: 1,
            attempts: 0,
          })),
        );
        task.progress =
          25 + Math.round((25 * (index + 1)) / task.students.length);
        save();
      }
      task.stage = "grading";
      save();
    }
    if (task.stage === "grading") {
      for (const [index, cell] of task.cells.entries()) {
        if (cell.protected || cell.grade || cell.attempts >= 2) continue;
        const q = task.questions.find((q) => q.id === cell.questionId)!;
        cell.rubricVersion = q.version;
        if (
          cell.answer.issue ||
          q.kind === "unsupported" ||
          !q.reference.trim()
        ) {
          cell.issue =
            cell.answer.issue ||
            (q.kind === "unsupported"
              ? "该题型暂不支持自动评分"
              : "缺少参考答案，需教师评分");
          cell.attempts = 2;
          save();
          continue;
        }
        try {
          cell.attempts++;
          cell.grade =
            task.mode === "demo"
              ? demoGrade(task, cell.studentId, q)
              : await retry(task, save, () => gradeAnswer(task, q, cell));
          cell.issue = validateGrade(cell.grade, q);
          if (cell.issue && task.mode === "live") {
            cell.attempts++;
            cell.grade = await retry(task, save, () =>
              gradeAnswer(task, q, cell),
            );
            cell.issue = validateGrade(cell.grade, q);
          }
        } catch (error) {
          cell.issue =
            error instanceof Error ? error.message : "批改服务未完成";
          cell.attempts = 2;
        }
        task.progress = 50 + Math.round((40 * (index + 1)) / task.cells.length);
        save();
        if (task.mode === "demo") await wait(140);
      }
      task.stage = "checking";
      task.progress = 92;
      save();
    }
    if (task.stage === "checking") {
      if (task.cells.length !== task.students.length * task.questions.length)
        throw new Error("题目统计不一致，任务无法完成，请检查材料");
      task.status = task.cells.every((c) => c.confirmed)
        ? "completed"
        : "review";
      task.stage = "done";
      task.progress = 100;
      const issues = task.cells.filter((c) => c.issue && !c.confirmed).length;
      addHistory(
        task,
        `整批处理结束：${task.cells.length} 份单题作答，${issues} 项需教师确认`,
      );
      save();
    }
  } catch (error) {
    task.status = "failed";
    task.error = error instanceof Error ? error.message : "任务处理失败";
    addHistory(task, "任务未完成，可在结果页检查后重试");
    save();
  }
}
