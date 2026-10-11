# Foundation · 通用全栈框架

基于 Next.js App Router、React、TypeScript、Tailwind CSS、shadcn/ui（Radix）和 Lucide。包含通用工程框架、智能体展示和教师 AI 批改工作台。

访问 `/` 跳转到 `/app`，`/app` 默认进入 `/app/dashboard`，智能体展示页位于 `/app/agent`。工作区页面通过 `app/(workspace)/app/layout.tsx` 共用布局，切换时保留侧栏状态。侧栏、顶部导航和右侧外框固定在视口内，仅 `WorkspaceContent` 内容区滚动。主导航包含 Dashboard、智能体；底部提供 Settings、Get Help、Search 和示例用户菜单，账户等入口保持模板占位，未接入认证或业务服务。

智能体页支持搜索、分类、排序、收藏与最近浏览，卡片进入 `/app/agent/[agentId]` 独立详情页。详情表单提供目标、主题（最多 2000 字）、示例填充、学生水平、生成模式和参考资料记录；草稿按智能体分别保存到浏览器，收藏和最近浏览也保存在本地。文件只在当前页面选择，刷新后需重新选择；网站和教材仅记录，尚未上传或解析。生成按钮仅校验表单，模型生成尚未接入。展示数据位于 `config/agents.ts`，表单配置位于 `config/agent-forms.ts`，共享侧栏位于 `components/layout/workspace-sidebar.tsx`。

## 开始使用

环境：Node.js >=22.19.0，pnpm 10。

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

默认访问 http://localhost:3000。端口被占用时可指定 `pnpm dev --port 3100`。本框架不需要环境变量；后续配置可参考 `.env.example`。

```powershell
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
pnpm start
```

`pnpm start` 运行生产构建，需要先执行 `pnpm build`。

## 目录

```text
app/                 页面、布局、加载/错误/404、API 路由
  api/health/        通用健康检查
  page.tsx           首页跳转到 /app
  (workspace)/       工作区路由组（不影响 URL）
    app/             /app 工作区父路由
      layout.tsx     共享侧栏和右侧内容容器
      page.tsx       默认跳转到 /app/dashboard
      dashboard/     Dashboard 模板页面（URL：/app/dashboard）
      agent/         智能体展示页面（URL：/app/agent）
        [agentId]/   智能体配置表单（URL：/app/agent/:agentId）
components/
  layout/            公共页面框架
  ui/                shadcn/ui 组件源码
config/              应用名称和导航等公共配置
hooks/               自定义 React Hooks、本地草稿存储
lib/
  client/            预留浏览器请求工具
  server/            服务端工具，使用 server-only 防止导入客户端
  utils.ts           cn 样式合并工具
types/               共享 TypeScript 类型
public/              静态资源
文档/                方案、搭建记录及浏览器验收截图
```

页面默认使用 Server Component，只有交互组件添加 `"use client"`。后端接口使用 Route Handler；敏感配置和服务端依赖放在 `lib/server/`，不要导入客户端组件。

## 添加组件

shadcn/ui 将组件源码写入 `components/ui/`，可以直接修改；配置在 `components.json`。

```powershell
pnpm dlx shadcn@4.21.4 add select
```

AI 批改入口为 `/app/grading`。默认使用演示识别与评分，真实上传、后台执行、教师审核、成绩导出和本地 SQLite 保存已接通；需要同时运行 `pnpm dev` 和 `pnpm grading:worker`。演示账户为 `teacher` / `demo-teacher`，另一隔离账户为 `teacher2` / `demo-teacher`。

启动、真实服务切换、部署与备份恢复见 [AI 批改运行说明](GRADING.md)。真实模式使用 PaddleOCR-VL 完整解析服务和兼容图片聊天接口的模型，填写 `.env.local` 后重启网页与后台即可切换；真实准确率需要另行使用教师样卷验收。

平台公共 AI 入口为 `/app/ai`，提供服务商配置、模型清单、阶段路由、调用日志和用量汇总；批改真实模型调用已使用公共服务，兼容原有配置。使用方法与数据维护见 [公共 AI 运行说明](AI-PLATFORM.md)。

参考：[Next.js 安装说明](https://nextjs.org/docs/app/getting-started/installation)、[shadcn/ui Next.js 安装说明](https://ui.shadcn.com/docs/installation/next)。
