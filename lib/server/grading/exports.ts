import "server-only";
import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import type { Task } from "@/types/grading";
import { cellScore, studentSummary } from "@/types/grading";

const safe = (value: string | number) =>
  `"${String(value)
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replace(/"/g, '""')}"`;
export function csvReport(task: Task) {
  const rows: (string | number)[][] = [
    [
      task.mode === "demo"
        ? "演示结果，不能用作真实成绩"
        : task.status === "completed"
          ? "教师确认成绩"
          : "预览，含未确认结果",
    ],
    [
      "学生",
      "已判得分",
      "满分",
      "待确认题数",
      ...task.questions.map((q) => `第${q.id}题`),
    ],
    ...task.students.map((s) => {
      const sum = studentSummary(task, s.id);
      return [
        s.name,
        sum.score,
        sum.max,
        sum.pending,
        ...task.questions.map((q) => {
          const c = task.cells.find(
            (c) => c.studentId === s.id && c.questionId === q.id,
          );
          return c
            ? c.issue && !c.confirmed
              ? "待确认"
              : (cellScore(c) ?? "待确认")
            : "待处理";
        }),
      ];
    }),
  ];
  return "\ufeff" + rows.map((row) => row.map(safe).join(",")).join("\r\n");
}
export async function pdfReport(task: Task) {
  const pdf = await PDFDocument.create();
  for (const student of task.students) {
    let surface = createCanvas(1240, 1754),
      ctx = surface.getContext("2d"),
      y = 70;
    const setup = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1240, 1754);
      ctx.fillStyle = "#26221e";
      ctx.font = '24px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    };
    setup();
    const flush = async () => {
      const image = await pdf.embedPng(surface.toBuffer("image/png"));
      pdf
        .addPage([620, 877])
        .drawImage(image, { x: 0, y: 0, width: 620, height: 877 });
    };
    const line = async (text: string) => {
      let chunk = "";
      for (const char of text + "\n") {
        if (char === "\n" || ctx.measureText(chunk + char).width > 1100) {
          if (y > 1670) {
            await flush();
            surface = createCanvas(1240, 1754);
            ctx = surface.getContext("2d");
            setup();
            y = 70;
          }
          ctx.fillText(chunk, 70, y);
          y += 38;
          chunk = char === "\n" ? "" : char;
        } else chunk += char;
      }
    };
    const sum = studentSummary(task, student.id);
    await line(`${task.title} · ${student.name}`);
    await line(
      task.mode === "demo"
        ? "演示反馈报告：不代表上传作业真实成绩"
        : task.status === "completed"
          ? "教师确认报告"
          : "预览报告：存在未确认结果",
    );
    await line(`已判得分 ${sum.score} / ${sum.max}；待确认 ${sum.pending} 题`);
    for (const q of task.questions) {
      const c = task.cells.find(
        (c) => c.studentId === student.id && c.questionId === q.id,
      );
      await line(
        `第 ${q.id} 题（满分 ${q.maxScore}）${q.source === "suggested" ? " · AI 建议评分标准" : ""}`,
      );
      await line(q.title);
      await line(`学生作答：${c?.answer.text || "请查看原稿"}`);
      await line(
        `得分：${c && !(c.issue && !c.confirmed) ? (cellScore(c) ?? "待确认") : "待确认"}；${c?.confirmed ? "已确认" : "未确认"}`,
      );
      await line(
        `反馈：${c?.finalFeedback || c?.grade?.feedback || c?.issue || "待处理"}`,
      );
      if (c?.issue && !c.confirmed) await line(`待确认原因：${c.issue}`);
      if (c && c.rubricVersion !== q.version)
        await line(
          `沿用人工结果，评分版本 ${c.rubricVersion}；当前标准版本 ${q.version}`,
        );
      y += 20;
    }
    await flush();
  }
  return pdf.save();
}
