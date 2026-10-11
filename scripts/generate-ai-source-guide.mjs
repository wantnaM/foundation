import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chapters = [
  {
    title: "一、先看一份真实的配置示例",
    file: "ai.config.example.json",
    language: "json",
    explanation:
      "这份示例说明服务商、模型、默认模型和阶段分配如何放在一起。里面的地址、模型编号是占位内容，不能直接用于真实服务；密钥只填写环境变量名称，不填写密钥正文。",
    focus:
      "先找到服务商列表，再找到它下面的模型列表，最后看默认模型和批改阶段分配。当前示例让默认测试走演示模型，让真实批改指向需要你补充的实际模型。",
  },
  {
    title: "二、配置管理与模型清单的完整源码",
    file: "lib/server/ai/config.ts",
    language: "typescript",
    explanation:
      "这个文件负责检查配置、读取配置、保存配置，以及根据任务阶段选择模型。模型清单是配置的一部分，因此两项能力在同一个文件中实现。",
    focus:
      "按顺序观察：允许填写什么 → 配置之间是否对应 → 默认演示内容 → 从哪里读取 → 如何保存 → 当前任务选谁。看到以斜杠开头的说明文字可以先读，它们是给人看的注释。",
    landmarks: [
      ["模型清单可以登记哪些信息", "const modelSchema"],
      ["服务商需要哪些连接设置", "const providerSchema"],
      ["检查模型编号、默认模型和路由是否有效", "export const aiConfigSchema"],
      ["读取配置：部署环境优先，其次本地文件", "export function readAIConfig"],
      ["检查后保存配置到本地文件", "export function saveAIConfig"],
      ["为当前任务选择服务商与模型", "export function resolveAI"],
      [
        "提供给管理页面的信息，不包含密钥正文",
        "export function publicAIConfig",
      ],
    ],
  },
  {
    title: "三、统一调用的完整源码",
    file: "lib/server/ai/service.ts",
    language: "typescript",
    explanation:
      "这是业务请求 AI 的公共窗口。它连接配置选择、模型请求、结果检查和调用记录；不同业务不用分别编写这些重复工作。",
    focus:
      "先看请求开始前如何检查并登记，再看实际请求与结果处理，最后看普通文字、固定格式数据和逐步输出三种入口。这里有重复出现的请求设置，是为了让完整回复与逐步回复遵守一致的规则。",
    landmarks: [
      ["准备调用并登记一条处理中记录", "function prepare"],
      ["结束时登记状态、耗时、用量与估算费用", "  const finish ="],
      ["连接不同服务商", "  const connection ="],
      ["请求模型并检查结果", "async function execute"],
      ["普通文字回复入口", "export const generateAI ="],
      [
        "固定格式结果入口：批改需要这种结果",
        "export async function generateAIJson",
      ],
      ["逐步输出文字入口：适合聊天", "export async function* streamAI"],
    ],
  },
  {
    title: "四、日志与用量统计的完整源码",
    file: "lib/server/ai/store.ts",
    language: "typescript",
    explanation:
      "日志是每一次调用的明细，用量统计是对这些明细进行汇总。两者共用一张数据库表，模型调用文件负责写入，这个文件负责建立数据库与查询。",
    focus:
      "先看数据库登记了哪些信息，再找最近 100 条记录、累计数字和分类汇总三个部分。查询语句暂时不必逐字理解，只需分清它是在查单笔记录，还是在合计多笔记录。",
    landmarks: [
      ["建立日志数据库", "export function aiDB"],
      ["读取明细与累计、分类汇总", "export function aiReport"],
    ],
  },
  {
    title: "五、页面操作如何进入后台：完整接口源码",
    file: "app/api/ai-admin/route.ts",
    language: "typescript",
    explanation:
      "页面点击保存或测试时，会向这个接口发出请求。接口先检查权限和填写内容，然后调用前面介绍的配置或 AI 服务。读取管理页内容也经过它。",
    focus:
      "上半部分读取模型信息和用量；下半部分处理登录、退出、保存配置和测试模型。页面本身不直接读取密钥，也不直接连接供应商。",
  },
  {
    title: "六、谁能操作管理中心：完整权限源码",
    file: "lib/server/ai/admin.ts",
    language: "typescript",
    explanation:
      "这个文件负责管理员身份。公共 AI 设置属于平台管理权限，教师登录不能自动获得查看全平台配置和用量的权限。",
    focus:
      "关注开发演示密码与正式密码的区别、登录状态检查、错误尝试限制，以及退出时如何清除浏览器凭证。加密细节目前可以跳过。",
  },
  {
    title: "七、批改业务怎样使用公共能力",
    file: "lib/server/grading/providers.ts",
    language: "typescript",
    explanation:
      "这是现有批改模块的真实源码。前半部分把批改任务与图片整理后交给公共 AI 服务；后半部分分别组织题目整理、作答提取和评分要求。OCR 仍是独立识别接口。",
    focus:
      "对照上面的统一调用：公共层负责连接、记录和通用结果检查，批改层负责题目、答案、评分要求及作答位置等业务内容。不要把 OCR 接口请求与语言模型请求当成同一件事。",
    landmarks: [
      ["整理批改材料并接入公共 AI 服务", "export async function modelJson"],
      ["OCR 识别：独立文档服务", "export async function recognize"],
      [
        "把题目与参考答案整理成题目列表",
        "export async function extractQuestions",
      ],
      ["提取学生作答并对应题目", "export async function extractAnswers"],
      ["把本题评分要求交给公共服务", "export async function gradeAnswer"],
    ],
  },
];
const appendix = [
  ["管理页入口", "app/(workspace)/app/ai/page.tsx", "tsx"],
  ["管理页面完整界面与按钮操作", "components/ai/ai-console.tsx", "tsx"],
  [
    "公共能力自动检查：用本地模拟服务验证真实 SDK",
    "tests/ai.test.ts",
    "typescript",
  ],
  ["管理接口检查", "tests/ai-http.mjs", "javascript"],
  ["环境配置示例：没有真实密码或密钥", ".env.example", "dotenv"],
];
const link = (file, line) =>
  `/${path.join(root, file).replaceAll("\\", "/")}${line ? `:${line}` : ""}`;
const parts = [
  "# 公共 AI：中文讲解与项目源码对照\n",
  "这是当前 Foundation 项目的实际源码快照，供你在一份文档里对照学习，不是另写的简化示例，也不是 OpenMAIC 的源码。代码原样展示，讲解放在代码外，避免学习资料与实际实现不一致。\n",
  "阅读顺序：先看每章的中文说明，再看定位表，最后读对应代码；一开始不需要看懂全部语法。点击原文件链接可打开当前运行的源码，那里可能包含文档生成后新增的修改。\n",
  "每个代码块保留原文件的顺序与行数，第一行就是原文件第一行；定位表中的行号对应原文件，不是本文档的行号。\n",
  "**源码快照不会自动随业务代码更新。** 代码变化后，在项目目录运行 `node scripts/generate-ai-source-guide.mjs` 可以重新生成本文档；修改本文档里的代码块不会改变系统功能。\n",
  "概念解释见 [代码导读](./AI-CODE-GUIDE.md)，接入步骤见 [运行说明](./AI-PLATFORM.md)。\n",
  "## 一次操作的完整路径\n",
  "管理页面 → 管理接口 → 配置选择 → 统一模型调用 → 记录日志与用量 → 管理页面展示结果。\n",
  "批改调用从批改模块直接进入公共服务，不需要先点击管理页。固定格式检查只能确认回复的数据格式符合要求，不能保证评分内容正确。\n",
];
for (const chapter of chapters) {
  const source = await readFile(path.join(root, chapter.file), "utf8");
  const lines = source.split(/\r?\n/);
  parts.push(
    `## ${chapter.title}\n`,
    `${chapter.explanation}\n`,
    `**读这一段时关注：** ${chapter.focus}\n`,
    `原文件：[${chapter.file}](${link(chapter.file)})，共 ${source.trimEnd().split(/\r?\n/).length} 行。\n`,
  );
  if (chapter.landmarks) {
    parts.push("| 这段代码负责什么 | 原文件位置 |\n| --- | --- |\n");
    for (const [label, marker] of chapter.landmarks) {
      const index = lines.findIndex((line) => line.startsWith(marker));
      if (index < 0)
        throw new Error(
          `Cannot find source landmark: ${chapter.file} ${marker}`,
        );
      parts.push(
        `| ${label} | [第 ${index + 1} 行](${link(chapter.file, index + 1)}) |\n`,
      );
    }
  }
  parts.push(`\n\`\`\`${chapter.language}\n${source.trimEnd()}\n\`\`\`\n`);
}
parts.push(
  "## 附录：页面与验证源码\n",
  "这些文件同样来自当前项目。初学可以先跳过，理解主流程后再展开阅读。\n",
);
for (const [title, file, language] of appendix) {
  const source = await readFile(path.join(root, file), "utf8");
  parts.push(
    `### ${title}\n`,
    `原文件：[${file}](${link(file)})。\n`,
    `<details>\n<summary>展开完整源码</summary>\n\n\`\`\`${language}\n${source.trimEnd()}\n\`\`\`\n\n</details>\n`,
  );
}
parts.push(
  "## 学完以后，可以自己回答的五个问题\n",
  "1. 修改模型选择为什么不一定需要修改批改业务？\n2. 配置里为什么只保存密钥的环境变量名称？\n3. 调用失败为什么仍可能产生用量？\n4. 日志和用量统计为什么能共用同一份数据？\n5. 为什么返回了符合格式的分数，仍然需要验证评分准确性？\n",
  "本文档由项目中的生成脚本读取明确列出的源码文件制作，没有读取真实环境配置、用户作业或运行数据库。\n",
);
await writeFile(
  path.join(root, "AI-SOURCE-WALKTHROUGH.md"),
  parts.join("\n"),
  "utf8",
);
console.log(
  "已生成 AI-SOURCE-WALKTHROUGH.md，包含 7 个主流程文件和 5 个页面、测试与配置附录。",
);
