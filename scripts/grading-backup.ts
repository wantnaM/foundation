import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { dataDir } = await import("../lib/server/grading/config");
  const { db } = await import("../lib/server/grading/store");
  const { mkdir, cp, writeFile } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const { backup } = await import("node:sqlite");
  const dir = path.resolve(
    "backups",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await mkdir(dir, { recursive: true });
  await backup(db(), path.join(dir, "grading.sqlite"));
  try {
    await cp(path.join(dataDir(), "files"), path.join(dir, "files"), {
      recursive: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeFile(
    path.join(dir, "README.txt"),
    "备份完成。请在停止网页服务与批改后台后，将本目录 grading.sqlite 和 files 恢复到 GRADING_DATA_DIR。请在无任务运行、无修改和上传时备份，保证数据库与文件一致。\n",
  );
  console.log(`备份位置：${dir}`);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "备份失败");
  process.exitCode = 1;
});
