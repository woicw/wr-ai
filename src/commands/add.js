import { getOrigin } from "../config.js";
import { cloneOrUpdateRepo, getRepoDir } from "../github.js";
import { copyFileOrDir, ensureClaudeDir, updateGitignore } from "../fileOps.js";
import { log } from "@clack/prompts";
import ora from "ora";
import fs from "fs";
import path from "path";

// 需要排除的文件/文件夹
const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
// 默认配置来源
const DEFAULT_SOURCE = 'awesome-claude';

export async function handleAdd(name) {
  if (!name) {
    log.error("请指定要添加的 command 或 skill 名称");
    process.exit(1);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora(`正在查找 "${name}"...`).start();

  try {
    await cloneOrUpdateRepo(origin);
    const repoDir = getRepoDir(origin);

    // 确定配置来源
    const items = fs.readdirSync(repoDir, { withFileTypes: true })
      .filter((item) => item.isDirectory() && !EXCLUDE_LIST.includes(item.name))
      .map((item) => item.name);

    const sourceDir = items.includes(DEFAULT_SOURCE) ? DEFAULT_SOURCE : items[0];
    if (!sourceDir) {
      spinner.fail("仓库中未找到可用配置");
      process.exit(1);
    }

    const sourcePath = path.join(repoDir, sourceDir);
    const cwd = process.cwd();
    const claudeDir = ensureClaudeDir(cwd);

    // 查找 command: commands/<name>.md
    const commandPath = path.join(sourcePath, "commands", `${name}.md`);
    if (fs.existsSync(commandPath)) {
      spinner.text = `正在添加 command: ${name}...`;
      const destDir = path.join(claudeDir, "commands");
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, `${name}.md`);
      fs.copyFileSync(commandPath, destPath);
      spinner.succeed(`已添加 command: ${name} → .claude/commands/${name}.md`);
      
      // 更新 .gitignore
      if (updateGitignore(cwd)) {
        log.info('已添加 .claude 到 .gitignore');
      }
      return;
    }

    // 查找 skill: skills/<name>/
    const skillPath = path.join(sourcePath, "skills", name);
    if (fs.existsSync(skillPath) && fs.statSync(skillPath).isDirectory()) {
      spinner.text = `正在添加 skill: ${name}...`;
      const destPath = path.join(claudeDir, "skills", name);
      copyFileOrDir(skillPath, destPath);
      spinner.succeed(`已添加 skill: ${name} → .claude/skills/${name}/`);
      
      // 更新 .gitignore
      if (updateGitignore(cwd)) {
        log.info('已添加 .claude 到 .gitignore');
      }
      return;
    }

    // 未找到
    spinner.fail(`未找到 "${name}"，请检查名称是否正确`);

    // 列出可用的 commands 和 skills
    const commandsDir = path.join(sourcePath, "commands");
    const skillsDir = path.join(sourcePath, "skills");

    const availableCommands = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(".md", ""))
      : [];

    const availableSkills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
      : [];

    if (availableCommands.length > 0) {
      console.log("\n可用的 commands:");
      availableCommands.forEach((c) => console.log(`  • ${c}`));
    }

    if (availableSkills.length > 0) {
      console.log("\n可用的 skills:");
      availableSkills.forEach((s) => console.log(`  • ${s}`));
    }

    process.exit(1);
  } catch (error) {
    spinner.fail(`添加失败: ${error.message}`);
    process.exit(1);
  }
}
