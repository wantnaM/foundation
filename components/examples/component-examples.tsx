"use client";

import { useState } from "react";
import { Check, Ellipsis, Info, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ComponentExamples() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="mt-9 grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>按钮与反馈</CardTitle>
          <CardDescription>统一操作样式，清晰表达状态。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setMessage("按钮交互正常。")}>
              <Plus />
              主要按钮
            </Button>
            <Button
              variant="outline"
              onClick={() => setMessage("次要按钮交互正常。")}
            >
              次要按钮
            </Button>
            <Button disabled>禁用状态</Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="组件提示">
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent>支持键盘焦点与鼠标悬停</TooltipContent>
            </Tooltip>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Badge>默认标签</Badge>
            <Badge variant="secondary">次要标签</Badge>
            <Badge variant="outline">轮廓标签</Badge>
          </div>
          <div
            className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {message ? (
              <>
                <Check className="size-4 text-emerald-700" />
                {message}
              </>
            ) : (
              "点击按钮查看反馈。"
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>弹窗与菜单</CardTitle>
          <CardDescription>基于 Radix 的焦点管理和键盘交互。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">打开示例弹窗</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>一切准备就绪</DialogTitle>
                  <DialogDescription>
                    这是一个通用弹窗示例。按 Esc 或点击关闭按钮即可返回。
                  </DialogDescription>
                </DialogHeader>
                <p className="py-3 text-sm text-muted-foreground">
                  在这里放置需要用户关注的内容。
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button>知道了</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="更多操作" size="icon">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => setMessage("已选择菜单项目一。")}
                >
                  示例项目一
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setMessage("已选择菜单项目二。")}
                >
                  示例项目二
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="example-switch">示例开关</Label>
              <p className="mt-1.5 text-xs text-muted-foreground">
                当前状态：{enabled ? "已开启" : "已关闭"}
              </p>
            </div>
            <Switch
              id="example-switch"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>基础表单</CardTitle>
          <CardDescription>输入、标签和文本区域的组合。</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(`表单已演示提交：${name.trim()}。数据未保存。`);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="example-name">名称</Label>
              <Input
                id="example-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="输入一个示例名称"
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="example-description">描述</Label>
              <Textarea
                id="example-description"
                placeholder="补充一些说明（可选）"
                maxLength={500}
              />
            </div>
            <Button type="submit" variant="outline">
              演示提交
            </Button>
            <p className="text-xs text-muted-foreground">
              仅在当前页面展示反馈，刷新后恢复初始状态。
            </p>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>内容与状态</CardTitle>
          <CardDescription>标签页、表格及加载占位。</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">表格示例</TabsTrigger>
              <TabsTrigger value="loading">加载占位</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="mt-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>组件</TableHead>
                    <TableHead className="text-right">用途</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Button", "操作入口"],
                    ["Dialog", "弹窗交互"],
                    ["Table", "结构化展示"],
                  ].map(([component, purpose]) => (
                    <TableRow key={component}>
                      <TableCell className="font-mono text-xs">
                        {component}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {purpose}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="loading" className="mt-6 space-y-3">
              <p className="mb-4 text-xs text-muted-foreground">
                以下为静态 Skeleton 样式示例。
              </p>
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-20 w-full" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
