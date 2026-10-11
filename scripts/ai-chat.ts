import { loadEnvConfig } from "@next/env";

// Scripts do not run inside Next.js, so explicitly load its normal .env files.
loadEnvConfig(process.cwd());

async function main() {
  const { chat } = await import("../lib/server/ai");
  const { resolveModel } = await import("../lib/server/resolve-model");
  const { AIConfigurationError } =
    await import("../lib/server/provider-config");
  const { BackendAIError, RequestStorageError } =
    await import("../lib/server/ai");
  const { closeDatabase } = await import("../lib/server/db");
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  try {
    if (args.length === 1 && args[0] === "--check") {
      const selected = resolveModel();
      console.log(`AI 配置已读取，当前模型：${selected.modelString}`);
      console.log(
        "此检查没有向模型发送请求，不验证密钥有效性。运行 pnpm ai:chat 进行真实调用。",
      );
      return;
    }
    const response = await chat({
      prompt: args.join(" ") || "请用一句中文介绍你自己。",
      source: "backend-cli",
    });
    console.log(response.text);
    console.log(
      `请求记录：${response.requestId}（已保存，可在 /ai/logs 查看）`,
    );
  } catch (error) {
    console.error(
      error instanceof AIConfigurationError ||
        error instanceof BackendAIError ||
        error instanceof RequestStorageError
        ? error.message
        : "AI 调用未完成，请检查服务端配置",
    );
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main();
