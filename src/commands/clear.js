import fs from "fs";
import path from "path";
import os from "os";
import ora from "ora";
import { log } from "../utils/logger.js";

const WR_AI_DIR = path.join(os.homedir(), ".wr-ai");

export async function handleClear() {
  if (!fs.existsSync(WR_AI_DIR)) {
    log.info(".wr-ai 文件夹不存在，无需清理");
    return;
  }

  const spinner = ora("正在删除 .wr-ai 文件夹...").start();

  try {
    // 递归删除整个目录
    fs.rmSync(WR_AI_DIR, { recursive: true, force: true });
    spinner.succeed(".wr-ai 文件夹已删除");
  } catch (error) {
    spinner.fail(`删除失败: ${error.message}`);
    process.exit(1);
  }
}
