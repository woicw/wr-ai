import { getOrigin } from "../lib/config.js";
import { cloneOrUpdateRepo, getRepoDir } from "../lib/repository.js";
import { select } from "@inquirer/prompts";
import * as c from "yoctocolors";
import ora from "ora";
import fs from "fs";
import path from "path";
import { EXCLUDE_LIST, DEFAULT_SOURCE } from "../utils/constants.js";
import { log } from "../utils/logger.js";

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
      try {
        sourceDir = await select({
          message: "请选择配置来源:",
          choices: items.map((name) => ({
            name: name,
            value: name,
            description: c.cyan(`📁 ${name}/`),
          })),
        });
      } catch (error) {
        log.info("已取消");
        process.exit(0);
      }
    }

    const sourcePath = path.join(repoDir, sourceDir);
    const commandsDir = path.join(sourcePath, "commands");
    const skillsDir = path.join(sourcePath, "skills");
    const agentsDir = path.join(sourcePath, "agents");
    const hooksDir = path.join(sourcePath, "hooks");
    const mcpFile = path.join(sourcePath, ".mcp.json");
    const lspFile = path.join(sourcePath, ".lsp.json");

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

    // 获取 agents 列表
    const agents = fs.existsSync(agentsDir)
      ? fs.readdirSync(agentsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(".md", ""))
      : [];

    // 获取 hooks 列表
    const hooks = fs.existsSync(hooksDir)
      ? fs.readdirSync(hooksDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
      : [];

    // 解析 mcp 和 lsp 文件
    let mcpServers = [];
    let lspServices = [];

    if (fs.existsSync(mcpFile)) {
      try {
        const mcpContent = fs.readFileSync(mcpFile, 'utf-8');
        const mcpConfig = JSON.parse(mcpContent);
        if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
          mcpServers = Object.keys(mcpConfig.mcpServers);
        }
      } catch (e) {
        log.warn(`无法解析 MCP 配置: ${e.message}`);
      }
    }

    if (fs.existsSync(lspFile)) {
      try {
        const lspContent = fs.readFileSync(lspFile, 'utf-8');
        const lspConfig = JSON.parse(lspContent);
        if (typeof lspConfig === 'object') {
          lspServices = Object.keys(lspConfig);
        }
      } catch (e) {
        log.warn(`无法解析 LSP 配置: ${e.message}`);
      }
    }

    const hasMcp = mcpServers.length > 0;
    const hasLsp = lspServices.length > 0;

    if (commands.length === 0 && skills.length === 0 && agents.length === 0 && hooks.length === 0 && !hasMcp && !hasLsp) {
      log.info("配置目录为空");
      return;
    }

    // 构建展示内容
    const lines = [];
    let hasPreviousSection = false;

    if (commands.length > 0) {
      lines.push(c.bold(c.cyan('🔧 Commands')) + ' ' + `(${commands.length})`);
      lines.push('');
      commands.forEach((cmd, i) => {
        const isLast = i === commands.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.yellow(cmd));
      });
      hasPreviousSection = true;
    }

    if (skills.length > 0) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.cyan('🧠 Skills')) + ' ' + `(${skills.length})`);
      lines.push('');
      skills.forEach((skill, i) => {
        const isLast = i === skills.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.green(skill));
      });
      hasPreviousSection = true;
    }

    if (agents.length > 0) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.blue('🤖 Agents')) + ' ' + `(${agents.length})`);
      lines.push('');
      agents.forEach((agent, i) => {
        const isLast = i === agents.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.blue(agent));
      });
      hasPreviousSection = true;
    }

    if (hooks.length > 0) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.magenta('🪝 Hooks')) + ' ' + `(${hooks.length})`);
      lines.push('');
      hooks.forEach((hook, i) => {
        const isLast = i === hooks.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.magenta(hook));
      });
      hasPreviousSection = true;
    }

    if (hasMcp) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.red('🔌 MCP Servers')) + ' ' + `(${mcpServers.length})`);
      lines.push('');
      mcpServers.forEach((server, i) => {
        const isLast = i === mcpServers.length - 1 && !hasLsp;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.red(server));
      });
      hasPreviousSection = true;
    }

    if (hasLsp) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.red('💻 LSP Services')) + ' ' + `(${lspServices.length})`);
      lines.push('');
      lspServices.forEach((service, i) => {
        const isLast = i === lspServices.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.red(service));
      });
      hasPreviousSection = true;
    }

    console.log();
    console.log(c.bold(`📦 ${sourceDir}`));
    console.log();
    console.log(lines.join('\n'));

    // 使用提示
    console.log();
    console.log('  使用方式:');
    console.log('    wr-ai add <name>  ' + '添加指定配置（command/skill/agent/hook/mcp/lsp）');
    console.log('    wr-ai init        ' + '交互式选择添加');
    console.log();

  } catch (error) {
    spinner.fail(`获取配置列表失败: ${error.message}`);
    process.exit(1);
  }
}
