# Foundation · 通用全栈框架

基于 Next.js App Router、React、TypeScript、Tailwind CSS、shadcn/ui（Radix）和 Lucide。仅包含通用工程框架与 UI 示例，没有业务模块。

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
  components/        UI 示例页面（URL：/components）
components/
  layout/            公共页面框架
  examples/          可移除的组件交互示例
  ui/                shadcn/ui 组件源码
config/              应用名称和导航等公共配置
hooks/               预留自定义 React Hooks
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

按需增加业务目录或工作区包；当前不引入数据库、认证、模型 SDK、队列或多包构建。

参考：[Next.js 安装说明](https://nextjs.org/docs/app/getting-started/installation)、[shadcn/ui Next.js 安装说明](https://ui.shadcn.com/docs/installation/next)。
