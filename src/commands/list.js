import { getOrigin } from "../config.js";
import { listTemplates } from "../github.js";
import * as c from "@clack/prompts";
import ora from "ora";

export async function handleList() {
  const origin = getOrigin();
  if (!origin) {
    c.log.error('请先使用 "wr-ai set origin <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora("正在获取模板列表...").start();

  try {
    const templates = await listTemplates(origin);
    spinner.stop();

    if (templates.length === 0) {
      c.log.info("未找到任何模板");
      return;
    }

    c.log.info(`找到 ${templates.length} 个模板:`);
    templates.forEach((template, index) => {
      console.log(`  ${index + 1}. ${template}`);
    });
  } catch (error) {
    spinner.fail(`获取模板列表失败: ${error.message}`);
    process.exit(1);
  }
}
