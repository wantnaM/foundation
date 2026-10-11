# PostgreSQL 数据库接入

数据库是项目公共能力，供以后重新开发的功能使用。本次没有添加用户、批改、模型配置等业务表，也没有把旧 SQLite 批改数据搬入 PostgreSQL。

## 先配置连接

在项目根目录创建 `.env.local`，参考 `.env.example` 填写自己的数据库地址、账号、密码和数据库名。此文件已被 Git 忽略，不要把真实连接串放进浏览器组件或提交到仓库。

```dotenv
DATABASE_URL=postgresql://foundation:your-password@127.0.0.1:5432/foundation
DATABASE_POOL_MAX=10
```

数据库及账号需要提前存在。密码含 `@`、`#`、`:` 等特殊字符时，需要 URL 编码。远程数据库按服务商要求在连接地址中设置 SSL，例如 `?sslmode=verify-full`；不要关闭证书检查。修改配置后重启网页服务。

## 检查连接

```powershell
pnpm db:check
pnpm db:test
```

第一条只检查真实连接，失败时返回失败退出码。第二条检查配置规则，并在配置存在时使用真实数据库验证参数化读写、事务提交与失败回滚；使用临时表或回滚的表，不保留测试业务数据。需要账号具备建表权限。没有配置时，真实连接测试会明确跳过，不会冒充验证成功。

启动页面后访问 `/api/ready`：数据库连接成功返回 200 和 `connected`；未配置或不可连接返回 503。接口不显示账号、地址、密码、查询内容或数据库原始报错。原 `/api/health` 继续只检查应用是否运行，数据库不可用时普通展示页面仍可打开。

## 代码在哪里

| 文件 | 用途 |
| --- | --- |
| [lib/server/db/config.ts](../lib/server/db/config.ts) | 读取并检查环境配置，限制连接数和等待时间 |
| [lib/server/db/index.ts](../lib/server/db/index.ts) | 复用数据库连接、执行参数化查询、提交或回滚事务 |
| [app/api/ready/route.ts](../app/api/ready/route.ts) | 提供数据库就绪检查 |
| [scripts/db-check.ts](../scripts/db-check.ts) | 从命令行检查真实连接 |
| [tests/db.test.ts](../tests/db.test.ts) | 验证配置、真实读写、事务和连接释放 |

所有数据库代码仅供服务端使用，不能导入浏览器组件。连接在首次数据库请求时创建；开发刷新复用连接池，每个进程默认最多 10 条连接。连接等待最多 5 秒、SQL 执行最多 10 秒，事务内闲置最多 10 秒。多个网页或后台进程的连接数会累加，应按部署规模调整。

业务开发时，用户输入通过查询参数传入，不能拼成 SQL；一组必须同时成功的修改放在事务里，并始终使用事务提供的同一条连接。驱动的原始错误可能包含数据，业务接口要统一处理后再返回给浏览器。

本次采用 `pg` 驱动，连接复用和事务处理依据 [node-postgres 连接池说明](https://node-postgres.com/features/pooling)及[事务说明](https://node-postgres.com/features/transactions)。后续有业务表时，再添加对应建表和版本升级文件；当前不预建批改业务结构。

## 旧批改的清理范围

旧批改页面、接口、教师登录、上传识别、任务后台、评分、审核、导出、备份脚本、类型和测试已删除；旧命令及环境配置示例同步清理。旧 `/app/grading` 和 `/api/grading/...` 地址应返回 404。

`.grading-data/` 中的历史文件以及 `文档/` 中的旧计划、截图和验收记录仅作为本地历史资料保留，不再由应用读取。旧批改不再运行，也没有迁入 PostgreSQL。公共 AI 基座及其原有本地用量文件机制仍保留，尚未改为数据库存储。
