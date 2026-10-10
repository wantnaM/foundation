"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe,
  GraduationCap,
  Info,
  X,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { readingLevels, type getAgentFormConfig } from "@/config/agent-forms";
import type { Agent } from "@/config/agents";
import { emptyIds, isIdList, useStoredState } from "@/hooks/use-stored-state";

type Draft = {
  goal: string;
  topic: string;
  readingLevel: string;
  mode: string;
  website: string;
  standard: string;
};
const initialDraft: Draft = {
  goal: "",
  topic: "",
  readingLevel: "九年级",
  mode: "快速",
  website: "",
  standard: "",
};
function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    Object.keys(initialDraft).every((key) => typeof draft[key] === "string") &&
    typeof draft.topic === "string" &&
    draft.topic.length <= 2000 &&
    readingLevels.includes(draft.readingLevel as string) &&
    ["快速", "深入"].includes(draft.mode as string)
  );
}

function FieldHint({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`${label}说明`}
        >
          <Info />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}

export function AgentConfigForm({
  agent,
  config,
}: {
  agent: Agent;
  config: ReturnType<typeof getAgentFormConfig>;
}) {
  const [draft, setDraft, restored] = useStoredState(
    `foundation:agent-draft:${agent.id}`,
    initialDraft,
    isDraft,
  );
  const [, setVisited] = useStoredState(
    "foundation:agent-visited",
    emptyIds,
    isIdList,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [sourceDialog, setSourceDialog] = useState<
    "website" | "standard" | null
  >(null);
  const [sourceValue, setSourceValue] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const goalRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVisited((current) =>
      [agent.id, ...current.filter((id) => id !== agent.id)].slice(0, 50),
    );
  }, [agent.id, setVisited]);

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSubmitted(false);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.goal.trim() && !draft.topic.trim()) {
      setError("请至少填写学习目标或主题中的一项。");
      goalRef.current?.focus();
      return;
    }
    setError("");
    setSubmitted(true);
  }

  function openSource(kind: "website" | "standard") {
    setSourceValue(draft[kind]);
    setSourceError("");
    setSourceDialog(kind);
  }

  function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceDialog) return;
    const value = sourceValue.trim();
    if (!value) {
      setSourceError("请输入参考资料。");
      return;
    }
    if (sourceDialog === "website") {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setSourceError("请输入以 http:// 或 https:// 开头的有效网址。");
        return;
      }
    }
    update({ [sourceDialog]: value });
    setSourceDialog(null);
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="sr-only">
            <CardTitle>课程需求</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-5 sm:px-7">
            <FieldGroup>
              <Field data-invalid={!!error}>
                <div className="flex items-center gap-1">
                  <FieldLabel htmlFor="learning-goal">学习目标</FieldLabel>
                  <FieldHint label="学习目标">
                    描述学生在学习后能够理解、完成或展示什么。学习目标与主题至少填写一项。
                  </FieldHint>
                </div>
                <Input
                  ref={goalRef}
                  id="learning-goal"
                  placeholder={config.goalPlaceholder}
                  value={draft.goal}
                  onChange={(e) => update({ goal: e.target.value })}
                  aria-invalid={!!error}
                  aria-describedby={error ? "request-error" : undefined}
                />
              </Field>
              <Field data-invalid={!!error}>
                <div className="flex items-center gap-1">
                  <FieldLabel htmlFor="lesson-topic">主题或主要思想</FieldLabel>
                  <FieldHint label="主题">
                    补充课程主题、课时、活动要求或其他背景信息，最多 2000 字。
                  </FieldHint>
                </div>
                <div className="relative">
                  <Textarea
                    id="lesson-topic"
                    className="min-h-44 field-sizing-fixed pb-9 sm:min-h-52"
                    placeholder={config.topicPlaceholder}
                    maxLength={2000}
                    value={draft.topic}
                    onChange={(e) =>
                      update({ topic: e.target.value.slice(0, 2000) })
                    }
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? "request-error topic-count" : "topic-count"
                    }
                  />
                  <span
                    id="topic-count"
                    className="pointer-events-none absolute right-3 bottom-3 text-xs text-muted-foreground"
                  >
                    {draft.topic.length}/2000
                  </span>
                </div>
                {error ? (
                  <FieldError id="request-error">{error}</FieldError>
                ) : null}
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  aria-label="选择参考文件"
                  onChange={(e) => {
                    setFiles((current) => [
                      ...current,
                      ...Array.from(e.target.files ?? []),
                    ]);
                    setSubmitted(false);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <FileText data-icon="inline-start" />
                  文件
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => openSource("website")}
                >
                  <Globe data-icon="inline-start" />
                  网站
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => openSource("standard")}
                >
                  <GraduationCap data-icon="inline-start" />
                  教材
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => update(config.example)}
                >
                  使用示例
                </Button>
              </div>
            </div>
            {files.length || draft.website || draft.standard ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <Badge
                      key={`${file.name}-${index}`}
                      variant="secondary"
                      className="max-w-full gap-1"
                    >
                      <span className="truncate">{file.name}</span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`移除文件${file.name}`}
                        onClick={() => {
                          setFiles((current) =>
                            current.filter((_, i) => i !== index),
                          );
                          setSubmitted(false);
                        }}
                      >
                        <X />
                      </Button>
                    </Badge>
                  ))}
                  {(["website", "standard"] as const).map((kind) =>
                    draft[kind] ? (
                      <Badge
                        key={kind}
                        variant="secondary"
                        className="max-w-full gap-1"
                      >
                        <span className="truncate">
                          {kind === "website" ? "网站" : "教材"}：{draft[kind]}
                        </span>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`移除${kind === "website" ? "网站" : "教材"}`}
                          onClick={() => update({ [kind]: "" })}
                        >
                          <X />
                        </Button>
                      </Badge>
                    ) : null,
                  )}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  参考资料仅在本地记录，尚未上传或解析。刷新后需重新选择文件。
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="sr-only">
            <CardTitle>适用水平</CardTitle>
          </CardHeader>
          <CardContent className="px-5 sm:px-7">
            <Field>
              <FieldLabel htmlFor="reading-level">学生水平</FieldLabel>
              {restored ? (
                <Select
                  value={draft.readingLevel}
                  onValueChange={(readingLevel) => {
                    if (readingLevels.includes(readingLevel))
                      update({ readingLevel });
                  }}
                >
                  <SelectTrigger id="reading-level" className="w-full">
                    <SelectValue>{draft.readingLevel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {readingLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-9 w-full" />
              )}
            </Field>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          {restored ? (
            <Select
              value={draft.mode}
              onValueChange={(mode) => {
                if (["快速", "深入"].includes(mode)) update({ mode });
              }}
            >
              <SelectTrigger aria-label="生成模式" className="w-full sm:w-32">
                <Zap />
                <SelectValue>
                  {draft.mode === "深入" ? "思考" : draft.mode}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="快速">快速</SelectItem>
                  <SelectItem value="深入">思考</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-9 w-full sm:w-32" />
          )}
          <Button type="submit" className="w-full sm:flex-1">
            生成
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <FieldDescription className="text-center">
          AI会犯错。在课堂使用前务必复习内容
        </FieldDescription>
        {submitted ? (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>填写内容已通过校验</AlertTitle>
            <AlertDescription>
              已保留当前草稿。生成服务尚未接入，暂未生成教学计划。
            </AlertDescription>
          </Alert>
        ) : null}
      </form>
      <Dialog
        open={sourceDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSourceDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sourceDialog === "website" ? "添加参考网站" : "添加教材"}
            </DialogTitle>
            <DialogDescription>
              记录参考资料，内容解析将在后续接入。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={saveSource}
            className="flex flex-col gap-4"
            noValidate
          >
            <Field data-invalid={!!sourceError}>
              <FieldLabel htmlFor="reference-source">
                {sourceDialog === "website" ? "网站地址" : "教材内容"}
              </FieldLabel>
              {sourceDialog === "website" ? (
                <Input
                  id="reference-source"
                  type="url"
                  placeholder="https://example.com"
                  value={sourceValue}
                  onChange={(e) => {
                    setSourceValue(e.target.value);
                    setSourceError("");
                  }}
                  aria-invalid={!!sourceError}
                  aria-describedby={sourceError ? "source-error" : undefined}
                />
              ) : (
                <Textarea
                  id="reference-source"
                  placeholder="输入教材名称、章节或相关内容"
                  maxLength={2000}
                  value={sourceValue}
                  onChange={(e) => {
                    setSourceValue(e.target.value);
                    setSourceError("");
                  }}
                  aria-invalid={!!sourceError}
                  aria-describedby={sourceError ? "source-error" : undefined}
                />
              )}
              {sourceError ? (
                <FieldError id="source-error">{sourceError}</FieldError>
              ) : null}
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSourceDialog(null)}
              >
                取消
              </Button>
              <Button type="submit">保存参考资料</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
