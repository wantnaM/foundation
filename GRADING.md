# AI 批改：运行、接入与验收

批改真实模型调用现已使用平台公共 AI 服务；可以在 `/app/ai` 配置模型与批改阶段路由，并查看调用日志和用量。旧批改环境变量继续兼容，OCR 独立配置；完整说明见 [公共 AI 能力](AI-PLATFORM.md)。

## 当前可以做什么

教师一次上传题目、参考答案、学生作业，系统后台完成处理，最后统一审核。支持按学生、题目与状态筛选、疑题改分、反馈修改、批量确认、评分标准调整、成绩 CSV 与学生反馈 PDF 导出。原文件保持原样，可查看单题截图和原稿。

演示模式下，识别、切题截图和建议评分来自固定三题样例；学生姓名与上传材料真实保存。演示只验证完整操作流程，不能用于真实学生成绩。真实服务接入流程已实现，并通过本地接口替身验证；尚未连接真实供应商验证识别率和评分准确率。

## 本地启动

要求 Node.js >= 22.19.0、pnpm 10，建议固定已验证的 Node 版本。SQLite 使用 Node 内置模块，出现 experimental 提示不表示启动失败。

在项目根目录运行：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

另开一个终端，同样在项目根目录运行：

```powershell
pnpm grading:worker
```

打开 `http://localhost:3000/app/grading`。演示账户 `teacher`、`teacher2` 的密码均为 `demo-teacher`；不同账户的任务、原稿、截图和导出分别隔离。侧栏原有的示例用户菜单仍是模板，实际批改账户显示在批改页顶部。

可以点击“使用演示作业”直接体验，也可以新建任务自行上传。仅启动网页而未启动后台时，任务会保持等待处理。关闭页面不会停止后台；后台意外退出后重新启动，系统会在旧任务占用到期后继续未完成步骤，最长约 90 秒。

## 上传与审核规则

- 支持实际可读取的 JPG、PNG、PDF；单文件最大 15 MB，每个 PDF 最多 20 页，每批最多 60 个文件、100 页、100 MB。
- 同一批使用同一套题目与标准；题目、答案和学生作业分别上传。
- 每个学生可提交 PDF 或多张图片；上传后填写学生姓名或编号，同名文件归为同一学生，重名学生必须加编号。
- 重复材料会拒绝提交；损坏、加密或超限文件需在上传阶段更换。
- 处理途中不要求教师确认。识别不清、缺答案、不支持的题型与评分冲突会进入最终疑题清单，其他作答继续处理。
- 待确认题保留空缺，不直接按零分算完整成绩；教师填写分数和反馈后可以确认。
- 批量确认只处理当前筛选范围内正常的未确认作答，先展示数量与范围。
- 教师修改或确认的结果受保护。统一修改评分标准只自动重批未保护结果；已有人工成绩时不能改变该题满分，避免成绩口径混淆。
- 未全部确认可导出预览；演示文件始终注明演示，真实任务全部确认后才是最终成绩。

## 替换环境变量接入真实服务

将 `.env.example` 复制为 `.env.local`，填写下面配置。网页和后台必须读取相同配置、使用同一数据目录；切换后重启两个进程，不需要改业务代码。

```dotenv
GRADING_MODE=live
GRADING_DATA_DIR=D:/grading-live-data
GRADING_OCR_URL=http://127.0.0.1:8080/layout-parsing
GRADING_OCR_API_KEY=
GRADING_AI_BASE_URL=https://your-provider.example/v1
GRADING_AI_API_KEY=replace-with-your-key
GRADING_AI_MODEL=replace-with-your-image-model
GRADING_ACCOUNTS='[{"id":"school-teacher-01","name":"教师","password":"replace-with-a-unique-long-password"}]'
GRADING_APP_ORIGIN=http://localhost:3000
GRADING_COOKIE_SECURE=false
```

真实教师账户密码至少 12 位，建议采用新的账户编号和独立数据目录，隔开演示数据。HTTPS 部署应将来源地址设为实际域名，并设 `GRADING_COOKIE_SECURE=true`。密钥只保留在服务器，不能使用 `NEXT_PUBLIC_` 前缀。

### OCR 服务要求

使用 PaddleOCR-VL 的完整页面解析服务 `/layout-parsing`，不是仅提供文字识别的接口，也不是单独的看图聊天服务。网页后台逐页发送 Base64 图片与 `fileType=1`，读取响应中 `result.layoutParsingResults[].prunedResult.parsing_res_list` 的文字和位置。坐标必须对应送入的页面图片，当前请求关闭服务端自动方向变化与扭曲校正，避免截图位置错位；图片上传方向在本地处理。

实际部署应核对 PaddleOCR 服务版本、模型和返回结构。接口结构不符合时会明确报错，不会偷偷回退演示。可选的 OCR 密钥作为 Bearer 请求头发送。

### AI 服务要求

基础地址需要包含供应商要求的版本路径（常见为 `/v1`），不含 `/chat/completions`。模型必须兼容该聊天接口、支持 Base64 图片输入，并按要求输出 JSON。仅文字模型或不同协议服务不能只替换地址后使用。

系统依次调用题目和答案整理、学生作答对应、按评分标准批改，程序检查题号、作答位置、分项合计和分数范围。单次请求最长 45 秒，临时故障最多重试两次，任务最多 500 次外部调用；处理记录显示实际调用次数。外部服务不支持请求去重时，进程中断仍可能产生重复费用。

当前每次模型请求最多附带 8 张图，适合先验证少页、清晰、同一套作业的样卷；长卷、复杂图形、多学科效果需要真实样卷验证后再扩大开放范围。服务可被调用不等于准确率已经达标。

已创建任务固定记录原运行模式。切换模式后请创建新任务；演示旧任务不会自动变成真实结果。

## 数据、部署与维护

默认数据目录 `.grading-data`，包含 `grading.sqlite`、运行时 WAL 文件和 `files/`，不能放在公开静态目录。数据与服务密钥已被 Git 忽略。第一版为单机部署，网页与后台共享本机持久磁盘；不适用于临时文件系统或多个独立服务器直接共享 SQLite 的部署方式。

开发部署可运行 `pnpm build` 后 `pnpm start`，另运行批改后台。项目保留原有 standalone 配置；正式打包部署应复制 `.next/static` 到 `.next/standalone/.next/static`、`public` 到 `.next/standalone/public`，运行 `node .next/standalone/server.js`。通过进程管理工具注入环境变量，并为网页与后台设置相同的绝对数据路径。后台仍应从安装依赖的完整项目运行 `pnpm grading:worker`；不要把独立网页包误认为已包含后台。

Linux 部署需要安装中文字体（例如 Noto Sans CJK），否则 PDF 中文可能无法正确显示。PDF 为可阅读的图片式报告，成绩分析使用 CSV。

网页健康检查 `/api/health` 仅检查网页服务；后台存活由进程管理工具监测，任务长时间等待时检查后台日志。不要向日志打印密钥或完整学生材料。

备份前停止上传和修改，确认没有正在执行的任务；建议停止网页与后台后运行：

```powershell
pnpm grading:backup
```

备份位于 `backups/日期时间/`，包含数据库快照和材料文件。恢复时保持网页与后台停止，将当前数据目录另存保留，再将备份里的 `grading.sqlite` 和 `files` 放入一个干净数据目录，更新 `GRADING_DATA_DIR`，启动并核对任务、成绩、原稿和导出。不要混用旧 WAL 文件与恢复数据库。

当前提供本地备份和上传失败材料清理；教师自助删除、按学校期限自动清理和多租户管理尚未开放。真实使用前由管理员确定材料保留期限，并通过备份归档与离线维护执行，不应直接手动删除单个任务的文件而保留成绩引用。

## 验证命令

```powershell
pnpm lint
pnpm typecheck
pnpm grading:test
pnpm build
```

`grading:test` 使用独立临时数据目录，覆盖演示流水线、分数规则、确认保护、重批、账户归属、后台租约恢复、文件检查、PDF 渲染和真实服务接口契约。真实接口契约测试使用本地服务替身，不调用付费外部服务。

启动演示网页与后台后，可执行 `node tests/grading-http.mjs`，自动生成测试图片，默认请求 `http://localhost:3100`；其他端口用 `GRADING_TEST_ORIGIN` 指定。该检查会创建一个明确标记的验收任务，验证真实 HTTP 上传、来源保护、跨账户访问、确认与导出。

OCR 接口结构参照 [PaddleOCR-VL 官方部署文档](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL.html) 核对；供应商改版或不同协议需要先验证兼容性。

浏览器验收截图和导出文件在 `文档/验收/AI批改/`；该目录沿用项目约定，不提交 Git。开发计划的真实样卷准确率、教师省时比例、费用和正式上线验收仍需接入真实服务后执行，不能由本次演示结果推断。
