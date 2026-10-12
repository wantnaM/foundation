"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  ImageIcon,
  Info,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoredState } from "@/hooks/use-stored-state";
import { EssayUpload, RequirementUpload } from "./essay-upload";
import {
  emptyEssayTasks,
  essayGenres,
  essayGrades,
  initialEssayDraft,
  isEssayDraft,
  isEssayTasks,
  makeDimensions,
  type EssayDraft,
  type EssayGroup,
  type EssayTask,
  type RubricDimension,
} from "./essay-grading-config";

function StepCard({
  step,
  title,
  description,
  action,
  children,
}: {
  step: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-5 rounded-2xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
            aria-hidden="true"
          >
            {step}
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2>{title}</h2>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RubricEditor({
  draft,
  onSave,
  open,
  onOpenChange,
}: {
  draft: EssayDraft;
  onSave: (dimensions: RubricDimension[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dimensions, setDimensions] = useState(draft.dimensions);
  const total = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const valid =
    dimensions.every(
      (item) => Number.isInteger(item.score) && item.score >= 0,
    ) && total === draft.fullScore;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>评价量表</DialogTitle>
          <DialogDescription>
            设置每个维度的分值与评价依据。各项分值之和需等于满分{" "}
            {draft.fullScore} 分。
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {dimensions.map((dimension, index) => (
            <Field key={dimension.name} className="gap-2">
              <div className="flex items-center justify-between gap-4">
                <FieldLabel htmlFor={`dimension-${index}`}>
                  {dimension.name}
                </FieldLabel>
                <Input
                  id={`dimension-${index}`}
                  type="number"
                  min={0}
                  max={draft.fullScore}
                  value={Number.isNaN(dimension.score) ? "" : dimension.score}
                  className="w-20"
                  onChange={(event) =>
                    setDimensions((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, score: event.target.valueAsNumber }
                          : item,
                      ),
                    )
                  }
                />
              </div>
              <Textarea
                aria-label={`${dimension.name}评价依据`}
                value={dimension.description}
                maxLength={500}
                rows={2}
                className="min-h-16"
                onChange={(event) =>
                  setDimensions((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </Field>
          ))}
        </FieldGroup>
        <p className="text-sm" aria-live="polite">
          当前合计{" "}
          <span className="font-semibold text-primary">
            {Number.isFinite(total) ? total : "—"}
          </span>{" "}
          / {draft.fullScore} 分{!valid ? "，请调整分值后保存。" : ""}
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDimensions(makeDimensions(draft.genre, draft.fullScore))
            }
          >
            <RotateCcw data-icon="inline-start" />
            恢复推荐
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => {
              onSave(dimensions);
              onOpenChange(false);
            }}
          >
            <Check data-icon="inline-start" />
            保存量表
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function taskTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function EssayHistory({
  tasks,
  onRestore,
  onDelete,
}: {
  tasks: EssayTask[];
  onRestore: (draft: EssayDraft) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState<EssayTask | null>(null);
  const [deleting, setDeleting] = useState<EssayTask | null>(null);
  const matches = tasks.filter((task) =>
    task.draft.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const visible = showAll ? matches : matches.slice(0, 5);
  return (
    <>
      <Card className="gap-4 rounded-2xl" id="essay-history">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2>历史记录</h2>
            </CardTitle>
            <CardDescription>本机保存的批改任务</CardDescription>
          </div>
          <div className="flex max-w-full items-center gap-2">
            <InputGroup className="w-44 sm:w-52">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="搜索批改历史"
                placeholder="搜索作文题目"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShowAll(false);
                }}
              />
            </InputGroup>
            {matches.length > 5 ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "收起" : "查看全部"}
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {visible.length ? (
            <>
              <ul
                className="flex flex-col gap-3 sm:hidden"
                aria-label="历史任务列表"
              >
                {visible.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                  >
                    <p className="break-all font-medium">{task.draft.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.draft.grade} · {task.draft.genre} ·{" "}
                      {task.draft.fullScore} 分 · {task.groups.length} 篇
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">待接入批改</Badge>
                      <span className="text-xs text-muted-foreground">
                        {taskTime(task.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        aria-label={`查看任务 ${task.draft.title}`}
                        onClick={() => setActive(task)}
                      >
                        查看任务
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`删除任务 ${task.draft.title}`}
                        onClick={() => setDeleting(task)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>批改任务</TableHead>
                      <TableHead>作文数量</TableHead>
                      <TableHead>保存时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <FileText
                              className="size-5 shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex min-w-0 flex-col gap-1">
                              <span
                                className="max-w-56 truncate font-medium"
                                title={task.draft.title}
                              >
                                {task.draft.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {task.draft.grade} · {task.draft.genre} ·{" "}
                                {task.draft.fullScore} 分
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{task.groups.length} 篇</TableCell>
                        <TableCell className="text-muted-foreground">
                          {taskTime(task.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">待接入批改</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              aria-label={`查看任务 ${task.draft.title}`}
                              onClick={() => setActive(task)}
                            >
                              查看任务
                              <ChevronRight data-icon="inline-end" />
                              <span className="sr-only">
                                {task.draft.title}
                              </span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`删除任务 ${task.draft.title}`}
                              onClick={() => setDeleting(task)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <Empty className="py-9">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History />
                </EmptyMedia>
                <EmptyTitle>
                  {search ? "没有找到相关任务" : "每一次进步，都值得留下"}
                </EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "换个关键词试试，或清空搜索查看全部。"
                    : "保存批改任务后，可在这里查看写作要求、评价标准和作文清单。"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={!!active}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{active?.draft.title}</DialogTitle>
            <DialogDescription>本地任务记录 · 待接入批改</DialogDescription>
          </DialogHeader>
          {active ? (
            <>
              <p className="text-sm text-muted-foreground">
                {active.draft.grade} · {active.draft.genre} ·{" "}
                {active.draft.fullScore} 分 · {active.groups.length} 篇作文
              </p>
              <p className="whitespace-pre-wrap text-sm leading-7">
                {active.draft.requirements}
              </p>
              <div className="flex flex-wrap gap-2">
                {active.draft.dimensions.map((item) => (
                  <Badge
                    key={item.name}
                    variant="outline"
                    title={item.description}
                  >
                    {item.name} {item.score}
                  </Badge>
                ))}
              </div>
              <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {active.groups.map((group, index) => (
                  <li key={group.id} className="rounded-lg border p-3 text-sm">
                    <p className="mb-1 font-medium">作文 {index + 1}</p>
                    <p className="break-all text-xs leading-5 text-muted-foreground">
                      {group.files.map((file) => file.name).join("、")}
                    </p>
                  </li>
                ))}
              </ul>
              <Alert>
                <Info />
                <AlertDescription>
                  记录仅保存要求、标准和文件清单，不保存文件原件。复用设置后请重新选择作文文件；尚未生成评分或批注。
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    onRestore(active.draft);
                    setActive(null);
                  }}
                >
                  复用写作要求与标准
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除本地任务？</DialogTitle>
            <DialogDescription>
              将删除“{deleting?.draft.title}”的记录，此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (deleting) onDelete(deleting.id);
                setDeleting(null);
              }}
            >
              删除记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EssayGradingWorkspace() {
  const [draft, setDraft, restored] = useStoredState(
    "foundation:essay-draft:v1",
    initialEssayDraft,
    isEssayDraft,
  );
  const [tasks, setTasks] = useStoredState(
    "foundation:essay-tasks:v1",
    emptyEssayTasks,
    isEssayTasks,
  );
  const [groups, setGroups] = useState<EssayGroup[]>([]);
  const [mode, setMode] = useState("manual");
  const [rubricOpen, setRubricOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState("");
  const [scoreInput, setScoreInput] = useState<string | null>(null);
  const currentScore = scoreInput ?? String(draft.fullScore);
  const scoreValid =
    /^\d+$/.test(currentScore) &&
    Number(currentScore) >= 10 &&
    Number(currentScore) <= 150;
  const titleMissing = attempted && !draft.title.trim();
  const requirementsMissing = attempted && !draft.requirements.trim();

  function updateDraft(patch: Partial<EssayDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice("");
  }

  function updateScore(value: string) {
    setScoreInput(value);
    const fullScore = Number(value);
    if (/^\d+$/.test(value) && fullScore >= 10 && fullScore <= 150) {
      updateDraft({
        fullScore,
        rubric: "推荐量表",
        dimensions: makeDimensions(draft.genre, fullScore),
      });
    }
  }

  function fillExample() {
    setDraft({
      ...initialEssayDraft,
      title: "那一刻，我长大了",
      requirements:
        "写一件让你感受到成长的事，写清事情的经过，写出真实感受。\n要求：记叙文，不少于600字，题目自拟。",
    });
    setScoreInput(null);
    setMode("manual");
    setAttempted(false);
    setNotice(
      "已填入示例写作要求与标准。请上传自己的作文，体验批量文件整理。 ",
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setNotice("");
    if (!draft.title.trim()) {
      document.getElementById("essay-title")?.focus();
      return;
    }
    if (!draft.requirements.trim()) {
      document.getElementById("essay-requirements")?.focus();
      return;
    }
    if (!scoreValid) {
      document.getElementById("essay-full-score")?.focus();
      return;
    }
    if (!groups.length) {
      document
        .getElementById("essay-upload-section")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmissionOpen(true);
  }

  function saveTask() {
    const task: EssayTask = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      draft: {
        ...draft,
        title: draft.title.trim(),
        requirements: draft.requirements.trim(),
      },
      groups: groups.map((group) => ({
        id: group.id,
        files: group.files.map(({ id, name, size, kind }) => ({
          id,
          name,
          size,
          kind,
        })),
      })),
    };
    setTasks((current) => [task, ...current].slice(0, 50));
    setSubmissionOpen(false);
    setGroups([]);
    setAttempted(false);
    setNotice(
      `已保存 ${task.groups.length} 篇作文的本地任务。尚未进行 AI 批改，可在历史记录查看任务。`,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <StepCard
          step="01"
          title="写作要求"
          description="明确题目与要求，本批作文共用同一标准。"
          action={
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={fillExample}
              disabled={!restored}
            >
              <Sparkles data-icon="inline-start" />
              体验示例
            </Button>
          }
        >
          <Tabs value={mode} onValueChange={setMode} className="gap-4">
            <TabsList variant="line">
              <TabsTrigger value="manual">
                <ClipboardList data-icon="inline-start" />
                手动输入
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImageIcon data-icon="inline-start" />
                图片识别
              </TabsTrigger>
              <TabsTrigger value="document">
                <FileText data-icon="inline-start" />
                文档识别
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
              <p className="text-xs leading-5 text-muted-foreground">
                填写或粘贴本次作文题目、材料与写作要求。
              </p>
            </TabsContent>
            <TabsContent value="image">
              <RequirementUpload mode="image" />
            </TabsContent>
            <TabsContent value="document">
              <RequirementUpload mode="document" />
            </TabsContent>
          </Tabs>
          <FieldGroup className="mt-1 gap-4">
            <Field data-invalid={titleMissing}>
              <FieldLabel htmlFor="essay-title">
                作文题目
                <span className="text-primary" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <Input
                id="essay-title"
                placeholder="例如：那一刻，我长大了"
                maxLength={100}
                value={draft.title}
                disabled={!restored}
                aria-invalid={titleMissing}
                onChange={(event) => updateDraft({ title: event.target.value })}
              />
              {titleMissing ? <FieldError>请填写作文题目。</FieldError> : null}
            </Field>
            <Field data-invalid={requirementsMissing}>
              <FieldLabel htmlFor="essay-requirements">
                写作材料与要求
                <span className="text-primary" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <Textarea
                id="essay-requirements"
                placeholder="输入题目材料、写作要求、字数要求等，帮助准确判断作文是否符合题意。"
                className="min-h-28 resize-y"
                maxLength={5000}
                rows={4}
                value={draft.requirements}
                disabled={!restored}
                aria-invalid={requirementsMissing}
                onChange={(event) =>
                  updateDraft({ requirements: event.target.value })
                }
              />
              <div className="flex items-start justify-between gap-3">
                <FieldDescription>
                  建议包含写作任务、字数及特殊要求。
                </FieldDescription>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {draft.requirements.length} / 5000
                </span>
              </div>
              {requirementsMissing ? (
                <FieldError>请填写写作材料与要求。</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
        </StepCard>

        <StepCard
          step="02"
          title="批改标准"
          description="按年级与文体选择量表，也可以调整各维度分值。"
        >
          <FieldGroup className="grid grid-cols-2 gap-4 md:grid-cols-[1fr_0.8fr_1fr_1.4fr]">
            <Field>
              <FieldLabel htmlFor="essay-grade">年级</FieldLabel>
              <Select
                value={draft.grade}
                disabled={!restored}
                onValueChange={(grade) => {
                  if (essayGrades.includes(grade)) updateDraft({ grade });
                }}
              >
                <SelectTrigger id="essay-grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {essayGrades.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={!scoreValid}>
              <FieldLabel htmlFor="essay-full-score">满分</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="essay-full-score"
                  type="number"
                  min={10}
                  max={150}
                  step={1}
                  value={currentScore}
                  disabled={!restored}
                  aria-invalid={!scoreValid}
                  onChange={(event) => updateScore(event.target.value)}
                />
                <InputGroupAddon align="inline-end">分</InputGroupAddon>
              </InputGroup>
              {!scoreValid ? (
                <FieldError>请输入 10—150 的整数。</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="essay-genre">文体</FieldLabel>
              <Select
                value={draft.genre}
                disabled={!restored}
                onValueChange={(genre) => {
                  if (!essayGenres.includes(genre)) return;
                  updateDraft({
                    genre,
                    rubric: "推荐量表",
                    dimensions: makeDimensions(genre, draft.fullScore),
                  });
                }}
              >
                <SelectTrigger id="essay-genre" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {essayGenres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="essay-rubric">评价量表</FieldLabel>
              <Select
                value={draft.rubric}
                disabled={!restored}
                onValueChange={(rubric) => {
                  if (rubric === "自定义量表") setRubricOpen(true);
                  else if (rubric === "推荐量表")
                    updateDraft({
                      rubric: "推荐量表",
                      dimensions: makeDimensions(draft.genre, draft.fullScore),
                    });
                }}
              >
                <SelectTrigger id="essay-rubric" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="推荐量表">
                      {draft.genre === "不限文体" ? "通用" : draft.genre}
                      推荐量表
                    </SelectItem>
                    <SelectItem value="自定义量表">自定义量表</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-primary/5 px-4 py-2">
            <p className="text-xs leading-6 text-muted-foreground">
              {draft.dimensions
                .map((item) => `${item.name} ${item.score}`)
                .join("　·　")}
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={!restored || !scoreValid}
              onClick={() => setRubricOpen(true)}
            >
              查看 / 调整
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            当前为可调整的基础量表。改变满分或文体时，会重新生成推荐分值。
          </p>
        </StepCard>

        <div id="essay-upload-section">
          <StepCard
            step="03"
            title="批量上传作文"
            description="上传学生作文，核对文件，并将同一篇的多页内容归为一组。"
          >
            <EssayUpload
              groups={groups}
              onChange={(next) => {
                setGroups(next);
                setNotice("");
              }}
            />
            {attempted && !groups.length ? (
              <FieldError>请至少选择一份作文文件。</FieldError>
            ) : null}
          </StepCard>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={!restored}
          >
            开始批量批改{groups.length ? `（${groups.length} 篇）` : ""}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            前端预览 · 识别与批改服务待接入，文件仅在本机选择和预览。
          </p>
        </div>
        {notice ? (
          <Alert role="status">
            <Info />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
      </form>
      <EssayHistory
        tasks={tasks}
        onRestore={(saved) => {
          setDraft(saved);
          setScoreInput(null);
          setAttempted(false);
          setNotice(
            "已复用写作要求与标准。作文清单保留当前选择，请核对或重新上传。",
          );
          document
            .getElementById("essay-title")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onDelete={(id) =>
          setTasks((current) => current.filter((task) => task.id !== id))
        }
      />
      <p className="pb-2 text-center text-xs text-muted-foreground">
        写作要求与标准自动保存 · 本地历史最多保留 50 条任务
      </p>

      {rubricOpen ? (
        <RubricEditor
          draft={draft}
          open={rubricOpen}
          onOpenChange={setRubricOpen}
          onSave={(dimensions) =>
            updateDraft({ rubric: "自定义量表", dimensions })
          }
        />
      ) : null}
      <Dialog open={submissionOpen} onOpenChange={setSubmissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批改任务已准备好</DialogTitle>
            <DialogDescription>
              当前为前端预览，AI 识别与批改服务尚未接入。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="font-medium">{draft.title}</p>
            <p className="text-sm text-muted-foreground">
              {draft.grade} · {draft.genre} · 满分 {draft.fullScore} 分
            </p>
            <p className="text-sm">
              共 {groups.length} 篇作文，
              {groups.reduce((sum, group) => sum + group.files.length, 0)}{" "}
              个文件
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            可以将要求、标准和文件清单保存到本地历史。文件原件不会保存，当前不会生成分数或批注。
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmissionOpen(false)}
            >
              继续编辑
            </Button>
            <Button type="button" onClick={saveTask}>
              保存本地任务
              <ArrowRight data-icon="inline-end" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
