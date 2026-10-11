"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateModelPrice } from "@/lib/server/model-price-actions";
import type { ModelPrice } from "@/lib/model-prices";

export function ModelPriceEditor({
  provider,
  model,
  name,
  price,
  disabled,
}: {
  provider: string;
  model: string;
  name: string;
  price?: ModelPrice;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`${name} 价格设置`}
        >
          价格设置
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name} · 价格设置</DialogTitle>
          <DialogDescription>人民币／百万 Tokens</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                const result = await updateModelPrice({
                  provider,
                  model,
                  input: form.get("input"),
                  output: form.get("output"),
                  cacheHit: form.get("cacheHit"),
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                router.refresh();
              } catch {
                setError("价格保存失败，请稍后重试。");
              }
            });
          }}
          className="space-y-5"
        >
          {(
            [
              ["input", "输入价"],
              ["output", "输出价"],
              ["cacheHit", "缓存命中价"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`${id}-${key}`}>{label}</Label>
              <Input
                id={`${id}-${key}`}
                name={key}
                type="number"
                min="0"
                max="9999999999.999999"
                step="0.000001"
                required
                defaultValue={price?.[key] ?? ""}
                disabled={pending}
                placeholder="¥ 0.00"
              />
            </div>
          ))}
          {price?.source === "deepseek-official-peak" && (
            <p className="text-xs text-muted-foreground">
              已按 DeepSeek 官方高峰价设置；空闲时段的实际费用可能更低。
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
