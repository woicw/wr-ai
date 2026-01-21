import { getOrigin } from "../config.js";
import { cloneOrUpdateRepo, getRepoDir } from "../github.js";
import { copyFileOrDir, ensureClaudeDir } from "../fileOps.js";
import { multiselect, select, log } from "@clack/prompts";
import ora from "ora";
import fs from "fs";
import path from "path";
import * as c from "yoctocolors";

// 需要排除的文件/文件夹
const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
// 默认配置来源
const DEFAULT_SOURCE = 'awesome-claude';

export async function handleInit() {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora("正在获取AI配置...").start();

  try {
    await cloneOrUpdateRepo(origin);
    const repoDir = getRepoDir(origin);

    // 读取根目录下的所有目录
    const items = fs.readdirSync(repoDir, { withFileTypes: true })
      .filter((item) => item.isDirectory() && !EXCLUDE_LIST.includes(item.name))
      .map((item) => item.name);

    if (items.length === 0) {
      spinner.fail("仓库中未找到可用配置");
      process.exit(1);
    }

    spinner.stop();

    // 确定配置来源
    let sourceDir;
    if (items.includes(DEFAULT_SOURCE)) {
      sourceDir = DEFAULT_SOURCE;
    } else {
      const result = await select({
        message: "请选择配置来源:",
        options: items.map((name) => ({ value: name, label: `📁 ${name}/` })),
      });

      if (typeof result === "symbol") {
        log.info("已取消");
        process.exit(0);
      }
      sourceDir = result;
    }

    const sourcePath = path.join(repoDir, sourceDir);
    const commandsDir = path.join(sourcePath, "commands");
    const skillsDir = path.join(sourcePath, "skills");

    // 获取 commands 列表
    const commands = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(".md", ""))
      : [];

    // 获取 skills 列表
    const skills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
      : [];

    if (commands.length === 0 && skills.length === 0) {
      log.warn("配置目录为空");
      process.exit(0);
    }

    // 构建选项：分组显示
    const options = [
      { value: '__all__', label: c.bold(c.magenta('⚡ ALL - 复制所有配置')), hint: c.dim('复制全部 commands 和 skills') },
    ];

    if (commands.length > 0) {
      options.push({ value: '__all_commands__', label: c.cyan('🔧 ALL Commands'), hint: c.dim(`全部 ${commands.length} 个`) });
      commands.forEach((cmd) => {
        options.push({ value: `cmd:${cmd}`, label: c.yellow(`   ○ ${cmd}`) });
      });
    }

    if (skills.length > 0) {
      options.push({ value: '__all_skills__', label: c.cyan('🧠 ALL Skills'), hint: c.dim(`全部 ${skills.length} 个`) });
      skills.forEach((skill) => {
        options.push({ value: `skill:${skill}`, label: c.green(`   ○ ${skill}`) });
      });
    }

    // 循环选择
    let selected = [];
    while (true) {
      const result = await multiselect({
        message: "请选择要添加的配置（空格选择，回车确认）:",
        options,
        required: false,
      });

      if (typeof result === "symbol") {
        log.info("已取消");
        process.exit(0);
      }

      selected = result;

      if (selected.length > 0) break;

      const action = await select({
        message: "未选择任何项，请选择操作:",
        options: [
          { value: "retry", label: "🔄 重新选择" },
          { value: "cancel", label: "❌ 取消" },
        ],
      });

      if (typeof action === "symbol" || action === "cancel") {
        log.info("已取消");
        process.exit(0);
      }
    }

    const cwd = process.cwd();
    const claudeDir = ensureClaudeDir(cwd);
    const copySpinner = ora("正在复制到 .claude/...").start();

    // 解析选择结果
    const copyAll = selected.includes('__all__');
    const copyAllCommands = copyAll || selected.includes('__all_commands__');
    const copyAllSkills = copyAll || selected.includes('__all_skills__');

    const selectedCommands = copyAllCommands
      ? commands
      : selected.filter((s) => s.startsWith('cmd:')).map((s) => s.replace('cmd:', ''));

    const selectedSkills = copyAllSkills
      ? skills
      : selected.filter((s) => s.startsWith('skill:')).map((s) => s.replace('skill:', ''));

    const copiedItems = [];

    // 复制 commands
    if (selectedCommands.length > 0) {
      const destDir = path.join(claudeDir, "commands");
      fs.mkdirSync(destDir, { recursive: true });
      for (const cmd of selectedCommands) {
        const srcPath = path.join(commandsDir, `${cmd}.md`);
        const destPath = path.join(destDir, `${cmd}.md`);
        fs.copyFileSync(srcPath, destPath);
        copiedItems.push(`commands/${cmd}.md`);
      }
    }

    // 复制 skills
    if (selectedSkills.length > 0) {
      const destDir = path.join(claudeDir, "skills");
      fs.mkdirSync(destDir, { recursive: true });
      for (const skill of selectedSkills) {
        const srcPath = path.join(skillsDir, skill);
        const destPath = path.join(destDir, skill);
        copyFileOrDir(srcPath, destPath);
        copiedItems.push(`skills/${skill}/`);
      }
    }

    // 输出结果
    let successMsg = `已复制 ${copiedItems.length} 个项目到 .claude/:\n`;
    if (copiedItems.length <= 10) {
      successMsg += copiedItems.map((f) => `  • ${f}`).join("\n");
    } else {
      successMsg += copiedItems.slice(0, 10).map((f) => `  • ${f}`).join("\n");
      successMsg += `\n  ... 还有 ${copiedItems.length - 10} 个`;
    }
    copySpinner.succeed(successMsg);

    // 更新 .gitignore
    const gitignorePath = path.join(cwd, '.gitignore');
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
