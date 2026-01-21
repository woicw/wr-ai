import { getOrigin } from "../config.js";
import { cloneOrUpdateRepo, getRepoDir } from "../github.js";
import { select, log, note } from "@clack/prompts";
import ora from "ora";
import fs from "fs";
import path from "path";
import * as c from "yoctocolors";

// 需要排除的文件/文件夹
const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
// 默认配置来源
const DEFAULT_SOURCE = 'awesome-claude';

export async function handleList() {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora("正在获取配置列表...").start();

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
      log.info("配置目录为空");
      return;
    }

    // 构建展示内容
    const lines = [];

    if (commands.length > 0) {
      lines.push(c.bold(c.cyan('🔧 Commands')) + c.dim(` (${commands.length})`));
      lines.push('');
      commands.forEach((cmd, i) => {
        const isLast = i === commands.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(c.dim(prefix) + ' ' + c.yellow(cmd));
      });
    }

    if (skills.length > 0) {
      if (commands.length > 0) lines.push('');
      lines.push(c.bold(c.cyan('🧠 Skills')) + c.dim(` (${skills.length})`));
      lines.push('');
      skills.forEach((skill, i) => {
        const isLast = i === skills.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(c.dim(prefix) + ' ' + c.green(skill));
      });
    }

    note(lines.join('\n'), `📦 ${sourceDir}`);

    // 使用提示
    console.log();
    console.log(c.dim('  使用方式:'));
    console.log(c.dim('    wr-ai add <name>  ') + c.dim('添加指定 command 或 skill'));
    console.log(c.dim('    wr-ai init        ') + c.dim('交互式选择添加'));
    console.log();

  } catch (error) {
    spinner.fail(`获取配置列表失败: ${error.message}`);
    process.exit(1);
  }
}
