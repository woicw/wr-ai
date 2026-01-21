import { getOrigin } from "../config.js";
import { cloneOrUpdateRepo, getTemplatesDir } from "../github.js";
import { copyDirectory, ensureClaudeDir } from "../fileOps.js";
import { select, log } from "@clack/prompts";
import ora from "ora";
import fs from "fs";
import path from "path";

export async function handleInit(templateName) {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set origin <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora("正在获取模板...").start();

  try {
    // 克隆或更新仓库
    await cloneOrUpdateRepo(origin);

    // 获取模板目录
    const templatesDir = getTemplatesDir(origin);

    // 读取所有模板
    const templates = fs.readdirSync(templatesDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name);

    if (templates.length === 0) {
      spinner.fail("未找到任何模板");
      process.exit(1);
    }

    spinner.stop();

    // 确定要使用的模板
    let selectedTemplate;
    if (templateName) {
      if (!templates.includes(templateName)) {
        log.error(`模板 "${templateName}" 不存在`);
        process.exit(1);
      }
      selectedTemplate = templateName;
    } else {
      // 弹出选择界面
      const result = await select({
        message: "请选择要使用的模板:",
        options: templates.map((template) => ({
          value: template,
          label: template,
        })),
      });

      if (typeof result === "symbol") {
        // 用户取消了选择
        log.info("已取消");
        process.exit(0);
      }

      selectedTemplate = result;
    }

    const copySpinner = ora(`正在复制模板 "${selectedTemplate}"...`).start();

    // 创建 .claude 目录
    const claudeDir = ensureClaudeDir();

    // 复制模板到 .claude
    const templatePath = path.join(templatesDir, selectedTemplate);
    copyDirectory(templatePath, claudeDir);

    copySpinner.succeed(`模板 "${selectedTemplate}" 已复制到 .claude 目录`);

    // 检测并更新 .gitignore
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.claude')) {
        fs.appendFileSync(gitignorePath, '\n.claude\n');
        log.info('已添加 .claude 到 .gitignore');
      }
    }
  } catch (error) {
    spinner.fail(`初始化失败: ${error.message}`);
    process.exit(1);
  }
}