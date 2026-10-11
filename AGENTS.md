<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 项目约定

- 说明、计划和接入文档统一放在 `文档/` 目录，不放在项目根目录；工具需要的 `AGENTS.md` 规则文件保留原位。
- 当前阶段只建设通用项目框架；未获得业务开发要求前，不加入业务模块。
- 功能开发完成后，必须启动页面，在浏览器中实际操作完整流程并截图验收，确认无误才算完成。
- 页面默认使用 Server Component，客户端交互按需拆分；服务端工具放在 `lib/server/`，不得导入客户端组件。
