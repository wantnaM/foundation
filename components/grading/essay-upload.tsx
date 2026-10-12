"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  Files,
  ImageIcon,
  Info,
  Merge,
  Plus,
  Scissors,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  essayAccept,
  fileKind,
  fileSize,
  type EssayFile,
  type EssayGroup,
} from "./essay-grading-config";

export function EssayFileIcon({ kind }: { kind: EssayFile["kind"] }) {
  const Icon = kind === "image" ? ImageIcon : FileText;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

function FilePreview({ file }: { file: EssayFile }) {
  const previewRef = useCallback(
    (node: HTMLImageElement | HTMLIFrameElement | null) => {
      if (!node || !file.file) return;
      const objectUrl = URL.createObjectURL(file.file);
      node.src = objectUrl;
      return () => URL.revokeObjectURL(objectUrl);
    },
    [file.file],
  );
  if (!file.file)
    return (
      <p className="py-8 text-center text-muted-foreground">
        这是示例文件。上传自己的作文后即可预览。
      </p>
    );
  if (file.kind === "document")
    return (
      <p className="py-8 text-center text-muted-foreground">
        已选择 Word 文档，正文预览将在文档解析接入后开放。
      </p>
    );
  if (file.kind === "pdf")
    return (
      <iframe
        ref={previewRef}
        title={file.name}
        className="h-[55dvh] w-full rounded-lg border"
      />
    );
  // Native images display temporary object URLs from files selected on this device.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={previewRef}
      alt={file.name}
      className="max-h-[60dvh] w-full rounded-lg object-contain"
    />
  );
}

export function EssayUpload({
  groups,
  onChange,
}: {
  groups: EssayGroup[];
  onChange: (groups: EssayGroup[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<EssayGroup | null>(null);
  const [previewFileId, setPreviewFileId] = useState("");
  const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);
  const selectedIds = selected.filter((id) =>
    groups.some((group) => group.id === id),
  );

  function addFiles(files: FileList | File[]) {
    const accepted: EssayGroup[] = [];
    const errors: string[] = [];
    const fingerprints = new Set(
      groups.flatMap((group) =>
        group.files.map(
          (item) => `${item.name}:${item.size}:${item.file?.lastModified}`,
        ),
      ),
    );
    for (const file of Array.from(files)) {
      const kind = fileKind(file.name);
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      if (!kind) {
        errors.push(`${file.name}：格式不支持`);
        continue;
      }
      if (file.size === 0 || file.size > 20 * 1024 * 1024) {
        errors.push(`${file.name}：文件需大于 0 且不超过 20 MB`);
        continue;
      }
      if (fingerprints.has(fingerprint)) {
        errors.push(`${file.name}：已在列表中`);
        continue;
      }
      if (totalFiles + accepted.length >= 100) {
        errors.push("每次最多选择 100 个文件");
        break;
      }
      fingerprints.add(fingerprint);
      accepted.push({
        id: crypto.randomUUID(),
        files: [
          {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            kind,
            file,
          },
        ],
      });
    }
    if (accepted.length) onChange([...groups, ...accepted]);
    setMessage(errors.join("；"));
  }

  function mergeSelected() {
    const merging = groups.filter((group) => selectedIds.includes(group.id));
    if (merging.length < 2) return;
    const first = merging[0];
    onChange(
      groups.flatMap((group) =>
        group.id === first.id
          ? [{ ...first, files: merging.flatMap((item) => item.files) }]
          : selectedIds.includes(group.id)
            ? []
            : [group],
      ),
    );
    setSelected([]);
  }

  function moveGroup(index: number, direction: number) {
    const next = [...groups];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    onChange(next);
  }

  function moveFile(index: number, direction: number) {
    if (!preview) return;
    const files = [...preview.files];
    [files[index], files[index + direction]] = [
      files[index + direction],
      files[index],
    ];
    const next = { ...preview, files };
    setPreview(next);
    onChange(groups.map((group) => (group.id === next.id ? next : group)));
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={essayAccept}
        className="sr-only"
        aria-label="选择作文文件"
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(
          "flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          dragging
            ? "border-primary bg-primary/8"
            : "border-input/60 bg-background/40 hover:border-primary hover:bg-primary/3",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Upload className="size-6" aria-hidden="true" />
        </span>
        <span className="font-medium">
          拖拽文件到这里，或<span className="text-primary">点击上传</span>
        </span>
        <span className="text-xs leading-5 text-muted-foreground">
          支持 JPG、PNG、WebP、Word、PDF · 单个文件不超过 20 MB · 最多 100 个
        </span>
      </button>
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        默认每个文件为一篇作文；同一篇的多张图片可勾选合并。PDF
        内多篇作文的拆分将在解析接入后开放。
      </p>
      {message ? (
        <Alert>
          <Info />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {groups.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              共{" "}
              <span className="font-medium text-foreground">
                {groups.length}
              </span>{" "}
              篇作文 · {totalFiles} 个文件
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={selectedIds.length < 2}
                onClick={mergeSelected}
              >
                <Merge data-icon="inline-start" />
                合并选中{selectedIds.length ? `（${selectedIds.length}）` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange([]);
                  setSelected([]);
                  setMessage("");
                }}
              >
                清空
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <Plus data-icon="inline-start" />
                继续添加
              </Button>
            </div>
          </div>
          <ul
            className="flex max-h-96 flex-col gap-2 overflow-y-auto p-0.5"
            aria-label="作文文件列表"
          >
            {groups.map((group, index) => (
              <li
                key={group.id}
                className="grid grid-cols-[1rem_2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border bg-background/40 p-3 sm:flex"
              >
                <Checkbox
                  aria-label={`选择作文 ${index + 1}`}
                  checked={selectedIds.includes(group.id)}
                  onCheckedChange={(checked) =>
                    setSelected((ids) =>
                      checked
                        ? [...ids, group.id]
                        : ids.filter((id) => id !== group.id),
                    )
                  }
                />
                <EssayFileIcon kind={group.files[0].kind} />
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-medium whitespace-nowrap">
                    作文 {String(index + 1).padStart(2, "0")}{" "}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {group.files.length} 个文件
                    </span>
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={group.files.map((file) => file.name).join("、")}
                  >
                    {group.files.map((file) => file.name).join("、")}
                  </p>
                </div>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  <Check data-icon="inline-start" />
                  已选择
                </Badge>
                <div className="col-span-2 col-start-2 flex shrink-0 items-center justify-end gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`上移作文 ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => moveGroup(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`下移作文 ${index + 1}`}
                    disabled={index === groups.length - 1}
                    onClick={() => moveGroup(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`预览作文 ${index + 1}`}
                    onClick={() => {
                      setPreview(group);
                      setPreviewFileId(group.files[0].id);
                    }}
                  >
                    预览<span className="sr-only">作文 {index + 1}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`移除作文 ${index + 1}`}
                    onClick={() =>
                      onChange(groups.filter((item) => item.id !== group.id))
                    }
                  >
                    <X />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>作文文件预览</DialogTitle>
            <DialogDescription>
              核对文件与顺序。每一组对应一篇作文；此阶段尚未识别正文。
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <>
              <ul className="flex flex-col gap-2">
                {preview.files.map((file, index) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-1 rounded-lg border p-2"
                  >
                    <Button
                      type="button"
                      variant={
                        previewFileId === file.id ? "secondary" : "ghost"
                      }
                      className="min-w-0 flex-1 justify-start"
                      onClick={() => setPreviewFileId(file.id)}
                    >
                      <span className="truncate">
                        {index + 1}. {file.name}
                      </span>
                    </Button>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {fileSize(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      aria-label={`上移文件 ${index + 1}`}
                      onClick={() => moveFile(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === preview.files.length - 1}
                      aria-label={`下移文件 ${index + 1}`}
                      onClick={() => moveFile(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </li>
                ))}
              </ul>
              <FilePreview
                key={previewFileId}
                file={
                  preview.files.find((file) => file.id === previewFileId) ??
                  preview.files[0]
                }
              />
              {preview.files.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onChange(
                      groups.flatMap((group) =>
                        group.id === preview.id
                          ? group.files.map((file) => ({
                              id: crypto.randomUUID(),
                              files: [file],
                            }))
                          : [group],
                      ),
                    );
                    setPreview(null);
                    setSelected([]);
                  }}
                >
                  <Scissors data-icon="inline-start" />
                  拆分为 {preview.files.length} 篇作文
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RequirementUpload({ mode }: { mode: "image" | "document" }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept={mode === "image" ? ".jpg,.jpeg,.png,.webp" : ".doc,.docx,.pdf"}
        aria-label="选择写作要求文件"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          if (!next) return;
          const kind = fileKind(next.name);
          if (
            !kind ||
            (mode === "image" ? kind !== "image" : kind === "image") ||
            next.size === 0 ||
            next.size > 20 * 1024 * 1024
          ) {
            setError("请选择正确格式的非空文件，大小不超过 20 MB。");
            return;
          }
          setFile(next);
          setError("");
        }}
      />
      <button
        type="button"
        className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input/60 p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => input.current?.click()}
      >
        {mode === "image" ? (
          <ImageIcon className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <Files className="size-5 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm">
          {file
            ? file.name
            : mode === "image"
              ? "上传题目或写作要求图片"
              : "上传包含写作要求的文档"}
        </span>
        <span className="text-xs text-muted-foreground">
          {mode === "image" ? "JPG、PNG、WebP" : "Word、PDF"} · 最大 20 MB
        </span>
      </button>
      {file ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            已选择 · {fileSize(file.size)}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowPreview(true)}
            >
              预览文件
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="移除写作要求文件"
              onClick={() => setFile(null)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : null}
      <Alert>
        <Info />
        <AlertDescription>
          {error ||
            "识别功能待接入。当前可选择和预览文件，请在下方手动填写或粘贴写作要求。"}
        </AlertDescription>
      </Alert>
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>写作要求文件</DialogTitle>
            <DialogDescription>
              仅在本机预览，尚未进行文字识别。
            </DialogDescription>
          </DialogHeader>
          {file ? (
            <FilePreview
              file={{
                id: "requirement",
                name: file.name,
                size: file.size,
                kind: fileKind(file.name)!,
                file,
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
