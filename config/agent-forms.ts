import type { Agent } from "@/config/agents";

export const readingLevels = [
  "学前儿童",
  "一年级",
  "二年级",
  "三年级",
  "四年级",
  "五年级",
  "六年级",
  "七年级",
  "八年级",
  "九年级",
  "高中",
  "成人学习者",
];

export function getAgentFormConfig(agent: Agent) {
  return {
    goalPlaceholder: "学生将通过观察和分类环境需求，了解植物的基本需求。",
    topicPlaceholder: "示例：利用真实植物探索根、茎、叶及其功能",
    example: {
      goal: "学生能够观察并辨认植物的根、茎和叶，描述它们的作用，并记录植物生长需要的条件。",
      topic: `以“认识身边的植物”为主题，${agent.description}安排观察真实植物、部位配对和种植记录活动，关注学生的自主探索与合作交流。`,
      readingLevel: "三年级",
    },
  };
}
