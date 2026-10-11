import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { randomUUID } = await import("node:crypto");
  const { claimTask, heartbeat, releaseTask, db } =
    await import("../lib/server/grading/store");
  const { processTask } = await import("../lib/server/grading/pipeline");
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  db();
  console.log("批改后台已启动，等待任务。关闭网页不会停止处理。");
  while (!stopping) {
    const lease = randomUUID();
    const task = claimTask(lease);
    if (!task) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    const timer = setInterval(() => {
      heartbeat(task.id, lease);
    }, 15000);
    try {
      await processTask(task, lease);
    } catch (error) {
      console.error(
        "任务执行结束但保存失败",
        error instanceof Error ? error.message : "未知错误",
      );
    } finally {
      clearInterval(timer);
      releaseTask(task.id, lease);
    }
  }
  console.log("后台已安全退出。");
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "后台启动失败");
  process.exitCode = 1;
});
