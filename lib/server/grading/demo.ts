import "server-only";
import sharp from "sharp";
import type { Question, Grade, Task, Answer } from "@/types/grading";
import { putFile } from "./files";

export const demoQuestions: Question[] = [
  {
    id: "1",
    title: "计算：2.5 × 4 = ?",
    reference: "10",
    maxScore: 2,
    rubric: "计算结果正确得 2 分，错误得 0 分。",
    kind: "objective",
    version: 1,
    source: "teacher",
  },
  {
    id: "2",
    title: "计算：3/4 + 1/2，写出过程。",
    reference: "3/4 + 2/4 = 5/4",
    maxScore: 4,
    rubric: "正确通分 2 分，计算结果正确 2 分。",
    kind: "calculation",
    version: 1,
    source: "teacher",
  },
  {
    id: "3",
    title: "长方形长 8 厘米，宽 5 厘米，求周长并写出单位。",
    reference: "（8 + 5）× 2 = 26 厘米",
    maxScore: 4,
    rubric: "列式正确 2 分，计算正确 1 分，单位正确 1 分。",
    kind: "subjective",
    version: 1,
    source: "teacher",
  },
];
export function demoAnswer(
  index: number,
  q: Question,
): Omit<Answer, "cropIds"> {
  const answers = [
    ["10", "3/4 + 2/4 = 5/4", "(8 + 5) × 2 = 26 厘米"],
    ["10", "3/4 + 1/2 = 4/6", "8 × 5 = 40 平方厘米"],
    ["1?（笔迹模糊）", "3/4 + 2/4 = 5/4", "(8 + 5) × 2 = 26"],
  ];
  const qi = demoQuestions.findIndex((x) => x.id === q.id);
  return {
    questionId: q.id,
    text: answers[index % 3][qi],
    issue:
      index % 3 === 2 && qi === 0
        ? "演示疑题：数字笔迹模糊，自动复核后仍需教师确认"
        : "",
    regions: [],
  };
}
export function demoGrade(task: Task, studentId: string, q: Question): Grade {
  const index = task.students.findIndex((s) => s.id === studentId) % 3;
  let ratio = 1,
    feedback = "作答符合评分要求。",
    evidence = demoAnswer(index, q).text,
    issue = "";
  if (index === 1 && q.id === "2") {
    ratio = 0;
    feedback = "分数相加应先通分，不能分别将分子、分母直接相加。";
  }
  if (index === 1 && q.id === "3") {
    ratio = 0;
    feedback = "题目求周长，作答使用了面积公式。";
  }
  if (index === 2 && q.id === "3") {
    ratio = 0.75;
    feedback = "列式及计算正确，遗漏单位。";
  }
  if (index === 2 && q.id === "1") {
    ratio = 0;
    issue = "演示疑题：需教师核对数字";
    feedback = "笔迹不清，暂不计入完整成绩。";
    evidence = "数字存在识别歧义";
  }
  const score = Math.round(q.maxScore * ratio * 100) / 100;
  return {
    score,
    feedback,
    evidence,
    issue,
    parts: [
      { label: "按当前评分标准综合评价（演示）", score, max: q.maxScore },
    ],
  };
}
export async function demoCrop(
  task: Task,
  student: string,
  q: Question,
  text: string,
) {
  const escape = (s: string) =>
    s.replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="230"><rect width="1000" height="230" fill="#faf8f1"/><path d="M30 105H970 M30 160H970 M30 215H970" stroke="#ddd6c8"/><g font-family="Microsoft YaHei, sans-serif" fill="#403a31"><text x="35" y="44" font-size="20">演示作答截图 · ${escape(student)} · 第 ${q.id} 题</text><text x="35" y="90" font-size="21">${escape(q.title)}</text><text x="50" y="151" font-size="28">${escape(text)}</text><text x="35" y="206" font-size="17" fill="#8b6d50">仅用于验证审核流程，不代表上传文件的识别结果</text></g></svg>`;
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
  const file = await putFile(task.id, bytes, `演示第${q.id}题.png`, "crop");
  task.materials.push(file);
  return file.id;
}
