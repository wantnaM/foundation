"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  FileText,
  Check,
  LoaderCircle,
  UploadCloud,
  ClipboardCheck,
  Download,
  LogOut,
  AlertCircle,
} from "lucide-react";
import type { Task, Teacher, Cell, Question } from "@/types/grading";
import { cellScore, studentSummary } from "@/types/grading";

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response
    .json()
    .catch(() => ({ error: "服务暂时不可用，请稍后重试" }));
  if (!response.ok) throw new Error(body.error || "操作失败，请重试");
  return body;
}
const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const statusLabel = {
  queued: "等待处理",
  processing: "自动批改中",
  review: "待教师审核",
  completed: "已全部确认",
  failed: "处理未完成",
};
const stages = {
  materials: "整理材料",
  questions: "识别题目与答案",
  answers: "对应学生作答",
  grading: "逐题预批改",
  checking: "检查与汇总",
  done: "处理结束",
};
const date = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function LogoutButton({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="grading-account">
      <span>{teacher.name}</span>
      <button
        className="grading-button ghost"
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              await api("/api/grading/logout", json({}));
              router.replace("/app/grading");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
      >
        <LogOut size={15} />
        退出
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
export function LoginPanel({ mode }: { mode: "demo" | "live" }) {
  const [id, setId] = useState(mode === "demo" ? "teacher" : ""),
    [password, setPassword] = useState(mode === "demo" ? "demo-teacher" : ""),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <div className="grading-login">
      <div>
        <p className="grading-eyebrow">给教学留出更多时间</p>
        <h2>
          把重复的批改，
          <br />
          交给你的助教。
        </h2>
        <p className="grading-muted">
          一次上传，自动处理。你只需在最后审核、确认。
        </p>
        <div className="grading-login-flow">
          <span>上传材料</span>
          <ArrowRight size={18} />
          <span>自动预批改</span>
          <ArrowRight size={18} />
          <span>集中审核</span>
        </div>
      </div>
      <form
        className="grading-panel"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            try {
              await api("/api/grading/login", json({ id, password }));
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          });
        }}
      >
        <h3>登录批改工作台</h3>
        <label>
          教师账户
          <input
            className="grading-input"
            name="username"
            autoComplete="username"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <label>
          密码
          <input
            className="grading-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === "demo" && (
          <p className="grading-hint">
            演示账户 teacher / teacher2
            <br />
            密码均为 demo-teacher；两个账户的作业独立保存。
          </p>
        )}
        {error && (
          <p className="grading-error" role="alert">
            {error}
          </p>
        )}
        <button className="grading-button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}
          进入工作台
        </button>
      </form>
    </div>
  );
}
export function TaskList({
  initial,
  mode,
}: {
  initial: Task[];
  mode: "demo" | "live";
}) {
  const [tasks, setTasks] = useState(initial),
    [error, setError] = useState(""),
    [busy, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      api("/api/grading")
        .then((data) => setTasks(data.tasks))
        .catch((e) => setError(e.message));
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  function demo() {
    start(async () => {
      try {
        const form = new FormData();
        form.set("title", "五年级数学 · 计算与应用");
        form.set("subject", "数学");
        form.set("level", "五年级");
        form.set("demo", "true");
        const { task } = await api("/api/grading/tasks", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: form,
        });
        router.push(`/app/grading/${task.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }
  const pending = tasks.filter((t) => t.status === "review").length;
  return (
    <>
      <div className="grading-title-row">
        <div>
          <p className="grading-eyebrow">教师工作台</p>
          <h1>让批改轻一点。</h1>
          <p className="grading-muted">
            上传整班作业，自动预批改，最后一次集中审核。
          </p>
        </div>
        <Link className="grading-button primary" href="/app/grading/new">
          <Plus size={18} />
          新建批改
        </Link>
      </div>
      <div className="grading-summary">
        <div>
          <strong>{tasks.length}</strong>
          <span>批改任务</span>
        </div>
        <div>
          <strong>{pending}</strong>
          <span>等待你审核</span>
        </div>
        <div>
          <strong>
            {tasks.filter((t) => t.status === "completed").length}
          </strong>
          <span>已全部确认</span>
        </div>
      </div>
      {mode === "demo" && (
        <div className="grading-demo">
          <div>
            <strong>先体验完整流程</strong>
            <p>
              内置 3 位学生、3 道题，包含典型错误和疑题。识别与评分为演示数据。
            </p>
          </div>
          <button className="grading-button" disabled={busy} onClick={demo}>
            {busy ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <ClipboardCheck size={16} />
            )}
            使用演示作业
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="grading-error">
          {error}
        </p>
      )}
      <div className="grading-section-heading">
        <h2>最近的批改</h2>
        <span className="grading-muted">自动保存 · 随时继续</span>
      </div>
      {!tasks.length ? (
        <div className="grading-empty">
          <FileText size={40} />
          <h3>从第一份作业开始</h3>
          <p>准备题目、参考答案和学生作业，剩下的交给助教。</p>
          <Link href="/app/grading/new" className="grading-button">
            上传作业
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grading-task-list">
          {tasks.map((task) => (
            <Link
              className="grading-task-row"
              href={`/app/grading/${task.id}`}
              key={task.id}
            >
              <div className="grading-task-icon">
                <ClipboardCheck size={23} />
              </div>
              <div className="grading-task-info">
                <h3>
                  {task.title}
                  {task.mode === "demo" && (
                    <span className="grading-tag">演示</span>
                  )}
                </h3>
                <p>
                  {task.level} · {task.subject} · {task.students.length} 位学生
                  · {date(task.createdAt)}
                </p>
              </div>
              <div className="grading-task-status">
                <span className={`grading-status ${task.status}`}>
                  {statusLabel[task.status]}
                </span>
                <small>
                  {task.status === "processing"
                    ? `${task.progress}%`
                    : task.cells.length
                      ? `${task.cells.filter((c) => c.issue && !c.confirmed).length} 项待确认`
                      : "材料已保存"}
                </small>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
function UploadField({
  title,
  hint,
  files,
  onChange,
}: {
  title: string;
  hint: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="grading-upload">
      <label>
        <UploadCloud size={24} />
        <strong>{title}</strong>
        <span>{hint}</span>
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,application/pdf"
          aria-label={title}
          onChange={(e) => onChange(Array.from(e.target.files || []))}
        />
      </label>
      {files.length > 0 && (
        <ul>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <FileText size={14} />
              <span>{f.name}</span>
              <small>{(f.size / 1024).toFixed(0)} KB</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function NewTask({ mode }: { mode: "demo" | "live" }) {
  const [paper, setPaper] = useState<File[]>([]),
    [reference, setReference] = useState<File[]>([]),
    [students, setStudents] = useState<File[]>([]),
    [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState(""),
    [busy, start] = useTransition();
  const router = useRouter();
  const [requestKey] = useState(() => crypto.randomUUID());
  return (
    <>
      <Link className="grading-back" href="/app/grading">
        <ArrowLeft size={16} />
        全部批改
      </Link>
      <p className="grading-eyebrow">新的批改任务</p>
      <h1>
        材料一次上传，
        <br className="sm:hidden" />
        批改自动完成。
      </h1>
      <p className="grading-muted">
        中途无需确认。识别不清或评分有疑问的题，会在最后统一列出。
      </p>
      {mode === "demo" && (
        <div className="grading-notice">
          当前为演示模式：文件会真实保存，但识别、作答截图及分数来自固定样例，不代表文件内容。
        </div>
      )}
      <form
        className="grading-new-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setError("");
          if (!paper.length || !reference.length || !students.length) {
            setError("请分别上传题目、参考答案和学生作业");
            return;
          }
          paper.forEach((f) => form.append("paper", f));
          reference.forEach((f) => form.append("reference", f));
          students.forEach((f) => form.append("student", f));
          form.set("studentNames", JSON.stringify(names));
          start(async () => {
            try {
              const { task } = await api("/api/grading/tasks", {
                method: "POST",
                headers: { "Idempotency-Key": requestKey },
                body: form,
              });
              router.push(`/app/grading/${task.id}`);
            } catch (e) {
              setError((e as Error).message);
            }
          });
        }}
      >
        <section className="grading-panel">
          <div className="grading-section-heading">
            <h2>
              <span className="grading-step">1</span>作业信息
            </h2>
            <small>同一任务使用同一套题目与标准</small>
          </div>
          <label>
            作业名称
            <input
              name="title"
              className="grading-input"
              placeholder="例如：五年级数学 · 第三单元练习"
              required
              maxLength={100}
            />
          </label>
          <div className="grading-form-grid">
            <label>
              学科
              <select name="subject" className="grading-input">
                <option>数学</option>
                <option>英语</option>
                <option>语文</option>
                <option>物理</option>
                <option>化学</option>
              </select>
            </label>
            <label>
              年级
              <input
                name="level"
                className="grading-input"
                placeholder="例如：五年级"
                required
                maxLength={40}
              />
            </label>
          </div>
          <label>
            评分要求（选填）
            <textarea
              className="grading-input"
              name="instructions"
              rows={3}
              maxLength={12000}
              placeholder="例如：满分 100 分；计算题保留步骤分。也可将分值和评分要求放在参考答案中。"
            />
          </label>
          <p className="grading-hint">
            未提供评分细则时，AI 会为整班生成统一建议标准，并在最终审核时注明。
          </p>
        </section>
        <section className="grading-panel">
          <div className="grading-section-heading">
            <h2>
              <span className="grading-step">2</span>题目与参考答案
            </h2>
          </div>
          <div className="grading-form-grid">
            <UploadField
              title="上传题目"
              hint="空白卷或完整题目"
              files={paper}
              onChange={setPaper}
            />
            <UploadField
              title="上传参考答案"
              hint="包含分值和评分点更好"
              files={reference}
              onChange={setReference}
            />
          </div>
        </section>
        <section className="grading-panel">
          <div className="grading-section-heading">
            <h2>
              <span className="grading-step">3</span>学生作业
            </h2>
            <small>同名文件分组为同一位学生</small>
          </div>
          <UploadField
            title="批量上传学生作业"
            hint="每位学生一个 PDF，或多张照片"
            files={students}
            onChange={(files) => {
              setStudents(files);
              setNames(
                files.map((f) =>
                  f.name
                    .replace(/\.[^.]+$/, "")
                    .replace(/[-_ ](?:第?\d+页?|page\d+)$/i, ""),
                ),
              );
            }}
          />
          {students.length > 0 && (
            <div className="grading-student-files">
              {students.map((file, i) => (
                <label key={i}>
                  <span>{file.name}</span>
                  <input
                    aria-label={`${file.name} 的学生姓名或编号`}
                    className="grading-input"
                    value={names[i] || ""}
                    required
                    maxLength={80}
                    onChange={(e) =>
                      setNames((prev) =>
                        prev.map((n, j) => (j === i ? e.target.value : n)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <p className="grading-hint">
            支持 JPG、PNG、PDF。单文件不超过 15 MB；每批最多 60 个文件、100
            页、100 MB。姓名相同会归为同一位学生；重名请加编号。
          </p>
        </section>
        {error && (
          <p role="alert" className="grading-error">
            {error}
          </p>
        )}
        <div className="grading-submit-row">
          <span>
            {students.length
              ? `${new Set(names).size} 位学生 · ${students.length} 份文件`
              : "材料保存后，关闭页面也会继续处理"}
          </span>
          <button className="grading-button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            开始自动批改
          </button>
        </div>
      </form>
    </>
  );
}
function ReviewCard({
  task,
  cell,
  onAction,
  busy,
}: {
  task: Task;
  cell: Cell;
  onAction: (body: unknown) => Promise<void>;
  busy: boolean;
}) {
  const q = task.questions.find((q) => q.id === cell.questionId)!;
  const s = task.students.find((s) => s.id === cell.studentId)!;
  const [score, setScore] = useState(String(cellScore(cell) ?? "")),
    [feedback, setFeedback] = useState(
      cell.finalFeedback || cell.grade?.feedback || "",
    );
  return (
    <article className="grading-review-card">
      <div className="grading-section-heading">
        <h3>
          {s.name}
          <span className="grading-muted"> / 第 {q.id} 题</span>
        </h3>
        <span
          className={`grading-status ${cell.confirmed ? "completed" : cell.issue ? "review" : "queued"}`}
        >
          {cell.confirmed ? "已确认" : cell.issue ? "待确认" : "待审核"}
        </span>
      </div>
      <p className="grading-question">{q.title}</p>
      <div className="grading-review-columns">
        <div>
          <p className="grading-eyebrow">学生作答</p>
          {cell.answer.cropIds.map((id) => (
            <a
              key={id}
              href={`/api/grading/tasks/${task.id}/files/${id}`}
              target="_blank"
              rel="noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="grading-answer-image"
                alt={`${s.name} 第${q.id}题${task.mode === "demo" ? "演示" : ""}作答截图`}
                src={`/api/grading/tasks/${task.id}/files/${id}`}
              />
            </a>
          ))}
          <p className="grading-answer-text">
            {cell.answer.text || "未获得可靠识别结果，请查看原稿。"}
          </p>
          <div className="grading-originals">
            {s.fileIds.map((id) => (
              <a
                key={id}
                target="_blank"
                rel="noreferrer"
                href={`/api/grading/tasks/${task.id}/files/${id}`}
              >
                <FileText size={14} />
                查看原稿
              </a>
            ))}
          </div>
          <details>
            <summary>
              参考答案与评分标准{q.source === "suggested" ? "（AI 建议）" : ""}
            </summary>
            <p>{q.reference || "缺少参考答案"}</p>
            <p>{q.rubric}</p>
          </details>
        </div>
        <div>
          <p className="grading-eyebrow">批改建议</p>
          {cell.issue && !cell.confirmed && (
            <p className="grading-issue">
              <AlertCircle size={17} />
              {cell.issue}
            </p>
          )}
          <p>{cell.grade?.feedback || "请核对原稿后填写得分和反馈。"}</p>
          {cell.grade && (
            <>
              <p className="grading-evidence">依据：{cell.grade.evidence}</p>
              <ul className="grading-parts">
                {cell.grade.parts.map((p, i) => (
                  <li key={i}>
                    <span>{p.label}</span>
                    <strong>
                      {p.score} / {p.max}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          {cell.rubricVersion !== q.version && (
            <p className="grading-hint">
              保留人工结果（评分版本 {cell.rubricVersion}），当前标准版本{" "}
              {q.version}。
            </p>
          )}
          <form
            className="grading-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void onAction({
                action: "edit",
                revision: task.revision,
                cellId: cell.id,
                score: Number(score),
                feedback,
                confirm: true,
              });
            }}
          >
            <div className="grading-score-row">
              <label>
                教师得分
                <input
                  className="grading-input"
                  aria-label={`${s.name} 第${q.id}题教师得分`}
                  type="number"
                  required
                  min={0}
                  max={q.maxScore}
                  step="0.01"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </label>
              <span>/ {q.maxScore} 分</span>
            </div>
            <label>
              给学生的反馈
              <textarea
                className="grading-input"
                aria-label={`${s.name} 第${q.id}题反馈`}
                required
                maxLength={6000}
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
            <button className="grading-button primary" disabled={busy}>
              <Check size={16} />
              {cell.confirmed ? "保存修改并确认" : "保存并确认本题"}
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
function RubricEditor({
  task,
  q,
  busy,
  onAction,
}: {
  task: Task;
  q: Question;
  busy: boolean;
  onAction: (body: unknown) => Promise<void>;
}) {
  const [rubric, setRubric] = useState(q.rubric),
    [reference, setReference] = useState(q.reference),
    [max, setMax] = useState(q.maxScore);
  const affected = task.cells.filter(
    (c) => c.questionId === q.id && !c.protected,
  ).length;
  return (
    <details className="grading-rubric">
      <summary>
        第 {q.id} 题 · {q.maxScore} 分 ·{" "}
        {q.source === "suggested" ? "AI 建议标准" : "教师评分标准"}
      </summary>
      <p>{q.title}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onAction({
            action: "rubric",
            revision: task.revision,
            question: { ...q, reference, rubric, maxScore: max },
          });
        }}
      >
        <label>
          参考答案
          <textarea
            className="grading-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            rows={2}
          />
        </label>
        <label>
          评分标准
          <textarea
            className="grading-input"
            required
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            rows={3}
          />
        </label>
        <label>
          满分
          <input
            className="grading-input"
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            required
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
          />
        </label>
        <p className="grading-hint">
          将重批 {affected} 份作答，保护 {task.students.length - affected}{" "}
          份人工修改或确认的结果。已有人工结果时不能改变满分。
        </p>
        <button className="grading-button" disabled={busy || !affected}>
          应用标准并重批 {affected} 份
        </button>
      </form>
    </details>
  );
}
export function TaskDetail({ initial }: { initial: Task }) {
  const [task, setTask] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [student, setStudent] = useState("all"),
    [question, setQuestion] = useState("all"),
    [filter, setFilter] = useState("all"),
    [batch, setBatch] = useState(false);
  const running = task.status === "queued" || task.status === "processing";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      api(`/api/grading/tasks/${task.id}`)
        .then((data) => {
          setTask(data.task);
          setError("");
        })
        .catch((e) => setError(e.message));
    }, 1500);
    return () => clearInterval(timer);
  }, [task.id, running]);
  async function action(body: unknown) {
    setError("");
    setBusy(true);
    try {
      const data = await api(`/api/grading/tasks/${task.id}`, json(body));
      setTask(data.task);
      setBatch(false);
    } catch (e) {
      setError((e as Error).message);
      try {
        const data = await api(`/api/grading/tasks/${task.id}`);
        setTask(data.task);
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  const visible = task.cells.filter(
    (c) =>
      (student === "all" || c.studentId === student) &&
      (question === "all" || c.questionId === question) &&
      (filter === "all" ||
        (filter === "issues" && c.issue && !c.confirmed) ||
        (filter === "pending" && !c.confirmed) ||
        (filter === "confirmed" && c.confirmed)),
  );
  const confirmable = visible.filter(
    (c) => !c.confirmed && !c.issue && cellScore(c) !== null,
  );
  const issues = task.cells.filter((c) => c.issue && !c.confirmed).length,
    confirmed = task.cells.filter((c) => c.confirmed).length;
  return (
    <>
      <Link className="grading-back" href="/app/grading">
        <ArrowLeft size={16} />
        全部批改
      </Link>
      <div className="grading-title-row">
        <div>
          <p className="grading-eyebrow">
            {task.level} · {task.subject} · {task.students.length} 位学生
          </p>
          <h1 className="grading-task-title">{task.title}</h1>
          <p className="grading-muted">
            {date(task.createdAt)} 创建 · 自动保存
          </p>
        </div>
        <span className={`grading-status ${task.status}`}>
          {statusLabel[task.status]}
        </span>
      </div>
      {task.mode === "demo" && (
        <div className="grading-notice">
          演示任务：识别、单题截图和建议分数来自固定样例，不代表上传材料的真实内容；导出也会注明演示。
        </div>
      )}
      {error && (
        <p role="alert" className="grading-error">
          {error}
        </p>
      )}
      {running ? (
        <div className="grading-processing" aria-live="polite">
          <LoaderCircle size={36} className="animate-spin" />
          <h2>{stages[task.stage]}</h2>
          <p>无需中途确认，你可以离开此页面，后台会继续处理。</p>
          <div
            className="grading-progress"
            role="progressbar"
            aria-label="批改进度"
            aria-valuenow={task.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${task.progress}%` }} />
          </div>
          <strong>{task.progress}%</strong>
          <p className="grading-hint">
            若长时间停留在等待处理，请确认批改后台已启动。
          </p>
        </div>
      ) : task.status === "failed" ? (
        <div className="grading-empty">
          <AlertCircle size={36} />
          <h2>本次处理未完成</h2>
          <p>{task.error}</p>
          <p>已经完成的步骤会保留，重试将继续未完成步骤。</p>
          <button
            disabled={busy}
            className="grading-button"
            onClick={() =>
              void action({ action: "retry", revision: task.revision })
            }
          >
            继续处理
          </button>
        </div>
      ) : (
        <>
          <div className="grading-summary">
            <div>
              <strong>{task.cells.length}</strong>
              <span>单题作答</span>
            </div>
            <button onClick={() => setFilter("issues")}>
              <strong>{issues}</strong>
              <span>需要你确认</span>
            </button>
            <div>
              <strong>
                {confirmed}
                <small> / {task.cells.length}</small>
              </strong>
              <span>已确认</span>
            </div>
          </div>
          {task.notices
            .filter((n) => !n.startsWith("演示模式"))
            .map((n, i) => (
              <p key={i} className="grading-notice">
                {n}
              </p>
            ))}
          <div className="grading-section-heading">
            <h2>最终审核</h2>
            <div className="grading-export">
              <a
                className="grading-button"
                href={`/api/grading/tasks/${task.id}/export?format=csv`}
              >
                <Download size={15} />
                成绩表
              </a>
              <a
                className="grading-button"
                href={`/api/grading/tasks/${task.id}/export?format=pdf`}
              >
                <Download size={15} />
                反馈 PDF
              </a>
            </div>
          </div>
          <p className="grading-hint">
            {task.status === "completed"
              ? "全部作答已确认，可以导出最终结果。"
              : "未全部确认时，导出会标记为预览；待确认题不会当作零分记入完整成绩。"}
          </p>
          <details className="grading-panel grading-results">
            <summary>查看全班成绩预览与讲评摘要</summary>
            <div className="grading-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>学生</th>
                    <th>已判得分 / 满分</th>
                    <th>未确认</th>
                    <th>疑题</th>
                  </tr>
                </thead>
                <tbody>
                  {task.students.map((s) => {
                    const summary = studentSummary(task, s.id);
                    return (
                      <tr key={s.id}>
                        <td>
                          <button
                            className="grading-text-button"
                            onClick={() => {
                              setStudent(s.id);
                              setFilter("all");
                            }}
                          >
                            {s.name}
                          </button>
                        </td>
                        <td>
                          {summary.score} / {summary.max}
                          {summary.pending > 0 ? "（预览）" : ""}
                        </td>
                        <td>{summary.pending}</td>
                        <td>{summary.issues}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <h3>讲评关注点</h3>
            {task.questions.map((q) => {
              const wrong = task.cells.filter(
                (c) =>
                  c.questionId === q.id &&
                  !c.issue &&
                  cellScore(c) !== null &&
                  cellScore(c)! < q.maxScore,
              );
              return (
                <p key={q.id}>
                  第 {q.id} 题：{wrong.length} 份作答有扣分。
                  {wrong[0]?.finalFeedback ||
                    wrong[0]?.grade?.feedback ||
                    "暂无明确扣分问题。"}
                </p>
              );
            })}
          </details>
          <div className="grading-filters">
            <label>
              学生
              <select
                className="grading-input"
                value={student}
                onChange={(e) => {
                  setStudent(e.target.value);
                  setBatch(false);
                }}
              >
                <option value="all">全部学生</option>
                {task.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              题目
              <select
                className="grading-input"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setBatch(false);
                }}
              >
                <option value="all">全部题目</option>
                {task.questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    第 {q.id} 题
                  </option>
                ))}
              </select>
            </label>
            <label>
              状态
              <select
                className="grading-input"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setBatch(false);
                }}
              >
                <option value="all">全部作答</option>
                <option value="issues">待确认问题</option>
                <option value="pending">尚未确认</option>
                <option value="confirmed">已确认</option>
              </select>
            </label>
            <button
              className="grading-button"
              disabled={busy || !confirmable.length}
              onClick={() => setBatch(!batch)}
            >
              <Check size={16} />
              批量确认 {confirmable.length} 份
            </button>
          </div>
          {batch && (
            <div className="grading-demo">
              <div>
                <strong>
                  确认当前筛选范围内 {confirmable.length} 份常规作答？
                </strong>
                <p>不会确认疑题；确认后会保护这些结果，重批不自动覆盖。</p>
              </div>
              <button
                className="grading-button primary"
                disabled={busy}
                onClick={() =>
                  void action({
                    action: "confirm",
                    revision: task.revision,
                    cellIds: confirmable.map((c) => c.id),
                  })
                }
              >
                确认这 {confirmable.length} 份
              </button>
            </div>
          )}
          {visible.length ? (
            visible.map((cell) => (
              <ReviewCard
                key={`${cell.id}:${task.revision}`}
                task={task}
                cell={cell}
                busy={busy}
                onAction={action}
              />
            ))
          ) : (
            <div className="grading-empty">
              <Check size={32} />
              <h3>当前范围没有作答</h3>
              <p>可切换学生、题目或审核状态。</p>
            </div>
          )}
          <details className="grading-panel">
            <summary>统一调整评分标准</summary>
            <p className="grading-hint">
              修改后自动重批尚未人工处理的作答，保护已有人工结果。
            </p>
            {task.questions.map((q) => (
              <RubricEditor
                key={`${q.id}:${q.version}`}
                task={task}
                q={q}
                busy={busy}
                onAction={action}
              />
            ))}
          </details>
        </>
      )}
      <details className="grading-history">
        <summary>
          处理记录与材料（
          {task.materials.filter((m) => m.role !== "crop").length} 份）
        </summary>
        <ul>
          {task.history.map((h, i) => (
            <li key={i}>
              <time>{date(h.at)}</time>
              {h.message}
            </li>
          ))}
        </ul>
        <div className="grading-originals">
          {task.materials
            .filter((m) => m.role !== "crop")
            .map((m) => (
              <a
                key={m.id}
                target="_blank"
                rel="noreferrer"
                href={`/api/grading/tasks/${task.id}/files/${m.id}`}
              >
                {m.name} · {m.pages} 页
              </a>
            ))}
        </div>
      </details>
    </>
  );
}
