import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EssayGradingCard() {
  return (
    <Card className="relative h-full gap-3 rounded-2xl py-5 transition-shadow hover:shadow-md">
      <CardHeader className="px-5">
        <div className="flex min-h-12 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-2xl bg-popover text-2xl shadow-xs"
          >
            📝
          </span>
        </div>
      </CardHeader>
      <CardContent className="gap-2 px-5">
        <CardTitle>
          <Link
            href="/app/grading/chinese-essay"
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-ring"
          >
            语文作文批改
          </Link>
        </CardTitle>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          根据作文题目与评分标准，分析内容、结构和语言，提供评分、原文批注与修改建议。
        </p>
      </CardContent>
    </Card>
  );
}
