"use client";

import { useState } from "react";
import Link from "next/link";
import { WorkspaceContent } from "@/components/layout/workspace-content";
import { useStoredState, emptyIds, isIdList } from "@/hooks/use-stored-state";
import {
  ArrowDownUp,
  Bot,
  CalendarDays,
  History,
  Search,
  Star,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { agents, agentCategories } from "@/config/agents";
import { cn } from "cn";

export function AgentLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("所有类别");
  const [favorites, setFavorites] = useStoredState(
    "foundation:agent-favorites",
    emptyIds,
    isIdList,
  );
  const [visited] = useStoredState(
    "foundation:agent-visited",
    emptyIds,
    isIdList,
  );
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyRecent, setOnlyRecent] = useState(false);
  const [sorted, setSorted] = useState(false);
  const filtered = agents.filter(
    (agent) =>
      (category === "所有类别" || agent.category === category) &&
      `${agent.title} ${agent.description}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (!onlyFavorites || favorites.includes(agent.id)) &&
      (!onlyRecent || visited.includes(agent.id)),
  );
  const visible = sorted
    ? [...filtered].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
    : filtered;

  function resetFilters() {
    setQuery("");
    setCategory("所有类别");
    setOnlyFavorites(false);
    setOnlyRecent(false);
  }

  return (
    <>
      <SiteHeader
        title="智能体"
        actions={
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="搜索智能体"
              placeholder="搜索智能体……"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="清空搜索"
                  onClick={() => setQuery("")}
                >
                  <X />
                </Button>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        }
      />
      <WorkspaceContent>
        <section className="flex flex-col gap-6 px-4 py-4 md:py-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                aria-label="选择类别"
                className="w-32 rounded-full"
              >
                <SelectValue>{category}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {agentCategories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={sorted ? "secondary" : "outline"}
                  size="icon-lg"
                  className="rounded-full"
                  aria-label="按名称排序"
                  aria-pressed={sorted}
                  onClick={() => setSorted((value) => !value)}
                >
                  <ArrowDownUp />
                </Button>
              </TooltipTrigger>
              <TooltipContent>按名称排序</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={onlyRecent ? "secondary" : "outline"}
                  size="icon-lg"
                  className="rounded-full"
                  aria-label="最近浏览"
                  aria-pressed={onlyRecent}
                  onClick={() => setOnlyRecent((value) => !value)}
                >
                  <History />
                </Button>
              </TooltipTrigger>
              <TooltipContent>最近浏览</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={onlyFavorites ? "secondary" : "outline"}
                  size="icon-lg"
                  className="rounded-full"
                  aria-label="只看收藏"
                  aria-pressed={onlyFavorites}
                  onClick={() => setOnlyFavorites((value) => !value)}
                >
                  <Star />
                </Button>
              </TooltipTrigger>
              <TooltipContent>收藏的智能体</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="flex items-center gap-3 text-xl font-semibold sm:text-2xl">
              <CalendarDays className="size-6" aria-hidden="true" />
              课程与单元计划
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              完整的课程 / 单元模板和教学框架。
            </p>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            共 {visible.length} 个智能体
          </p>
          {visible.length ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((agent) => (
                <Card
                  key={agent.id}
                  className="relative h-full gap-3 rounded-2xl py-5 transition-shadow hover:shadow-md"
                >
                  <CardHeader className="px-5">
                    <div className="flex min-h-12 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-12 items-center justify-center rounded-2xl bg-popover text-2xl shadow-xs"
                      >
                        {agent.icon}
                      </span>
                      {"featured" in agent ? (
                        <Badge variant="outline">特色</Badge>
                      ) : null}
                    </div>
                    <CardAction>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`${favorites.includes(agent.id) ? "取消收藏" : "收藏"}${agent.title}`}
                        aria-pressed={favorites.includes(agent.id)}
                        onClick={() =>
                          setFavorites((current) =>
                            current.includes(agent.id)
                              ? current.filter((id) => id !== agent.id)
                              : [...current, agent.id],
                          )
                        }
                      >
                        <Star
                          className={cn(
                            favorites.includes(agent.id) && "fill-current",
                          )}
                        />
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="gap-2 px-5">
                    <CardTitle>
                      <Link
                        href={`/app/agent/${agent.id}`}
                        className="text-left after:absolute after:inset-x-5 after:bottom-5 after:top-20 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {agent.title}
                      </Link>
                    </CardTitle>
                    <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                      {agent.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Empty className="min-h-72 border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>没有找到匹配的智能体</EmptyTitle>
                <EmptyDescription>
                  {onlyFavorites
                    ? "先点击卡片右上角的星标收藏智能体。"
                    : onlyRecent
                      ? "打开任意智能体详情后，就会出现在这里。"
                      : "试试其他关键词，或调整筛选条件。"}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={resetFilters}>
                  重置筛选
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </section>
      </WorkspaceContent>
    </>
  );
}
