import fs from "fs";
import path from "path";
import os from "os";
import * as c from "yoctocolors";

// 简单的 log 函数替代
const log = {
  info: (msg) => console.log(c.cyan('ℹ'), msg),
  warn: (msg) => console.log(c.yellow('⚠'), msg),
  error: (msg) => console.log(c.red('✖'), msg),
  success: (msg) => console.log(c.green('✔'), msg),
};
import ora from "ora";

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
