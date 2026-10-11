"use server";
import { revalidatePath } from "next/cache";
import { saveModelPrice } from "./model-prices";

export async function updateModelPrice(value: unknown) {
  try {
    await saveModelPrice(value);
  } catch (error) {
    const message =
      error instanceof Error &&
      [
        "请输入非负价格，最多保留六位小数。",
        "模型不存在，请刷新后重试。",
      ].includes(error.message)
        ? error.message
        : "价格保存失败，请稍后重试。";
    return { error: message };
  }
  revalidatePath("/ai/models");
  return { error: null };
}
