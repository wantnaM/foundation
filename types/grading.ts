import { z } from "zod";

export const questionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(12000),
  reference: z.string().max(12000),
  maxScore: z.number().positive().max(1000),
  rubric: z.string().min(1).max(12000),
  kind: z.enum(["objective", "calculation", "subjective", "unsupported"]),
});
export type Question = z.infer<typeof questionSchema> & {
  version: number;
  source: "teacher" | "suggested";
};
export const regionSchema = z.object({
  fileId: z.string(),
  page: z.number().int().positive(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export const answerSchema = z.object({
  questionId: z.string(),
  text: z.string().max(12000),
  issue: z.string().max(1000),
  regions: z.array(regionSchema).max(8),
});
export type Answer = z.infer<typeof answerSchema> & { cropIds: string[] };
export const gradeSchema = z.object({
  score: z.number().nonnegative(),
  feedback: z.string().min(1).max(6000),
  evidence: z.string().max(6000),
  issue: z.string().max(1000),
  parts: z
    .array(
      z.object({
        label: z.string().max(300),
        score: z.number().nonnegative(),
        max: z.number().positive(),
      }),
    )
    .min(1)
    .max(30),
});
export type Grade = z.infer<typeof gradeSchema>;
export type Cell = {
  id: string;
  studentId: string;
  questionId: string;
  answer: Answer;
  grade: Grade | null;
  issue: string;
  confirmed: boolean;
  finalScore: number | null;
  finalFeedback: string;
  protected: boolean;
  rubricVersion: number;
  attempts: number;
};
export type Material = {
  id: string;
  name: string;
  mime: string;
  size: number;
  pages: number;
  hash: string;
  role: "paper" | "reference" | "student" | "crop";
  studentId?: string;
};
export type Student = {
  id: string;
  name: string;
  fileIds: string[];
  issue: string;
};
export type Task = {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  level: string;
  instructions: string;
  mode: "demo" | "live";
  status: "queued" | "processing" | "review" | "completed" | "failed";
  stage:
    "materials" | "questions" | "answers" | "grading" | "checking" | "done";
  progress: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  materials: Material[];
  students: Student[];
  questions: Question[];
  cells: Cell[];
  notices: string[];
  error: string;
  calls: number;
  parsed: Record<string, ParsedPage[]>;
  history: { at: string; message: string }[];
};
export type Teacher = { id: string; name: string };
export type ParsedPage = {
  fileId: string;
  page: number;
  imageId: string;
  blocks: { id: string; text: string; box: [number, number, number, number] }[];
};

export function cellScore(cell: Cell) {
  if (cell.issue && cell.finalScore === null && !cell.confirmed) return null;
  return cell.finalScore ?? cell.grade?.score ?? null;
}
export function studentSummary(task: Task, id: string) {
  const cells = task.cells.filter((c) => c.studentId === id);
  return {
    score:
      Math.round(cells.reduce((n, c) => n + (cellScore(c) ?? 0), 0) * 100) /
      100,
    pending: cells.filter((c) => !c.confirmed).length,
    issues: cells.filter((c) => c.issue && !c.confirmed).length,
    max: task.questions.reduce((n, q) => n + q.maxScore, 0),
  };
}
export function validateGrade(grade: Grade, question: Question) {
  const total = grade.parts.reduce((n, p) => n + p.score, 0);
  const max = grade.parts.reduce((n, p) => n + p.max, 0);
  if (
    grade.parts.some((p) => p.score > p.max) ||
    grade.score > question.maxScore ||
    Math.abs(total - grade.score) > 0.01 ||
    Math.abs(max - question.maxScore) > 0.01
  )
    return "评分合计或分值范围异常，需要教师确认";
  if (!grade.evidence.trim()) return "缺少作答依据，需要教师确认";
  return grade.issue;
}
