export const agentCategories = [
  "所有类别",
  "课程规划",
  "教学设计",
  "学习活动",
] as const;
export const agents = [
  {
    id: "montessori",
    icon: "🧩",
    title: "蒙特梭利教学计划",
    category: "课程规划",
    description:
      "制作符合蒙特梭利风格的教学计划，包含动手操作任务、简单材料和教师准备指导。",
    featured: true,
  },
  {
    id: "5e",
    icon: "🌐",
    title: "5E 教学计划",
    category: "课程规划",
    description:
      "制定结构化的 5E 课程计划，包含引入、探索、解释、拓展和评价的学习体验。",
  },
  {
    id: "ubd",
    icon: "🎯",
    title: "向后设计（UbD）组织器",
    category: "教学设计",
    description:
      "制定包含明确目标、真实评估和探究驱动学习体验的 UbD 单元计划。",
  },
  {
    id: "gagne",
    icon: "🪜",
    title: "加涅的九大教学事件",
    category: "教学设计",
    description: "利用加涅的九大教学活动，为每个教学阶段制定清晰的课程计划。",
  },
  {
    id: "hunter",
    icon: "🧱",
    title: "亨特模型 · 精通学习",
    category: "教学设计",
    description: "创建结构化课程计划，涵盖示范、指导练习、检查理解和课堂总结。",
  },
  {
    id: "seed",
    icon: "🌱",
    title: "课程种子",
    category: "课程规划",
    description:
      "汇集目标、直接教学、练习、团队活动和形成性评估，从一个想法开始设计课程。",
  },
  {
    id: "pbl",
    icon: "💡",
    title: "基于项目的学习（PBL）规划工具",
    category: "学习活动",
    description:
      "制定结构化的 PBL 计划，结合探究式学习、真实世界联系和学生主导的项目。",
  },
  {
    id: "spark",
    icon: "⚡",
    title: "SPARK 课程",
    category: "学习活动",
    description:
      "制定应用现实问题解决、创造力和以人为本学习体验的 SPARK 课程计划。",
  },
  {
    id: "student",
    icon: "👩‍🏫",
    title: "以学生为中心的方法",
    category: "学习活动",
    description:
      "创建以学生为中心的学习框架，包含积极参与、自主性和有结构的进展。",
  },
  {
    id: "unit",
    icon: "📚",
    title: "单元规划",
    category: "课程规划",
    description:
      "设计一个结构化、基于研究的单元计划，包含明确的目标和循序渐进的学习活动。",
  },
  {
    id: "udl",
    icon: "🌍",
    title: "通用学习设计（UDL）规划器",
    category: "教学设计",
    description:
      "为所有学习者创建包容的课程计划，提供多种参与、表达和展示学习成果的方式。",
  },
] as const;
export type Agent = (typeof agents)[number];
