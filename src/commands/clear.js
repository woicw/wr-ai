import fs from "fs";
import path from "path";
import os from "os";
import ora from "ora";
import { confirm } from "@inquirer/prompts";
import * as c from "yoctocolors";
import { log } from "../utils/logger.js";

const WR_AI_DIR = path.join(os.homedir(), ".wr-ai");

export async function handleClear(options = {}) {
  if (!fs.existsSync(WR_AI_DIR)) {
    log.info(".wr-ai 文件夹不存在，无需清理");
    return;
  }

  // 除非 --yes，否则需要确认
  if (!options.yes) {
    try {
      const confirmed = await confirm({
        message: `确定要删除 ${c.yellow("~/.wr-ai/")} 吗？这将清除所有配置和模板缓存`,
        default: false,
      });
      if (!confirmed) {
        log.info("已取消操作");
        return;
      }
    } catch (error) {
      log.info("已取消");
      process.exit(0);
    }
  }

  const spinner = ora("正在删除 .wr-ai 文件夹...").start();

  try {
    fs.rmSync(WR_AI_DIR, { recursive: true, force: true });
    spinner.succeed(".wr-ai 文件夹已删除");
  } catch (error) {
    spinner.fail(`删除失败: ${error.message}`);
    process.exit(1);
  }
}
