export const essayGrades = [
  "一年级",
  "二年级",
  "三年级",
  "四年级",
  "五年级",
  "六年级",
  "七年级",
  "八年级",
  "九年级",
  "高一",
  "高二",
  "高三",
];
export const essayGenres = ["不限文体", "记叙文", "议论文", "说明文", "应用文"];

export type RubricDimension = {
  name: string;
  score: number;
  description: string;
};
export type EssayDraft = {
  title: string;
  requirements: string;
  grade: string;
  genre: string;
  fullScore: number;
  rubric: string;
  dimensions: RubricDimension[];
};

export function makeDimensions(
  genre: string,
  fullScore: number,
): RubricDimension[] {
  const items: [string, number, string][] = [
    ["审题与中心", 0.2, "符合题目与材料要求，中心或观点明确。"],
    genre === "议论文"
      ? ["论据与论证", 0.3, "论据贴切，分析充分，推理合理，能够支持观点。"]
      : ["内容与细节", 0.3, "内容具体充实，关键处有有效细节，能够支撑中心。"],
    ["结构与组织", 0.2, "层次清楚，详略得当，衔接自然，结构完整。"],
    ["语言与表达", 0.2, "语句通顺，用词准确，表达符合年级水平。"],
    ["书写与规范", 0.1, "正确使用汉字和标点；卷面评价需以清晰原图为依据。"],
  ];
  let allocated = 0;
  return items.map(([name, ratio, description], index) => {
    const score =
      index === items.length - 1
        ? fullScore - allocated
        : Math.floor(fullScore * ratio);
    allocated += score;
    return { name, score, description };
  });
}

export const initialEssayDraft: EssayDraft = {
  title: "",
  requirements: "",
  grade: "八年级",
  genre: "记叙文",
  fullScore: 50,
  rubric: "推荐量表",
  dimensions: makeDimensions("记叙文", 50),
};

export function isDimensions(value: unknown): value is RubricDimension[] {
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    value.every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        Number.isInteger(item.score) &&
        item.score >= 0 &&
        item.score <= 150,
    )
  );
}

export function isEssayDraft(value: unknown): value is EssayDraft {
  if (!value || typeof value !== "object") return false;
  const item = value as EssayDraft;
  return (
    typeof item.title === "string" &&
    item.title.length <= 100 &&
    typeof item.requirements === "string" &&
    item.requirements.length <= 5000 &&
    essayGrades.includes(item.grade) &&
    essayGenres.includes(item.genre) &&
    Number.isInteger(item.fullScore) &&
    item.fullScore >= 10 &&
    item.fullScore <= 150 &&
    ["推荐量表", "自定义量表"].includes(item.rubric) &&
    isDimensions(item.dimensions) &&
    item.dimensions.reduce((sum, dimension) => sum + dimension.score, 0) ===
      item.fullScore
  );
}

export type EssayFile = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "pdf" | "document";
  file?: File;
};
export type EssayGroup = { id: string; files: EssayFile[] };
export type EssayTask = {
  id: string;
  createdAt: string;
  draft: EssayDraft;
  groups: { id: string; files: Omit<EssayFile, "file">[] }[];
};
export const emptyEssayTasks: EssayTask[] = [];

export function isEssayTasks(value: unknown): value is EssayTask[] {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.createdAt === "string" &&
        Number.isFinite(Date.parse(task.createdAt)) &&
        isEssayDraft(task.draft) &&
        Array.isArray(task.groups) &&
        task.groups.length > 0 &&
        task.groups.every(
          (group: EssayTask["groups"][number]) =>
            group &&
            typeof group.id === "string" &&
            Array.isArray(group.files) &&
            group.files.length > 0 &&
            group.files.every(
              (file) =>
                file &&
                typeof file.id === "string" &&
                typeof file.name === "string" &&
                typeof file.size === "number" &&
                Number.isFinite(file.size) &&
                file.size >= 0 &&
                ["image", "pdf", "document"].includes(file.kind),
            ),
        ),
    )
  );
}

export function fileKind(name: string): EssayFile["kind"] | null {
  if (/\.(jpe?g|png|webp)$/i.test(name)) return "image";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.docx?$/i.test(name)) return "document";
  return null;
}
export const essayAccept = ".jpg,.jpeg,.png,.webp,.doc,.docx,.pdf";
export function fileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
