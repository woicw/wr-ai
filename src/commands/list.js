import { getOrigin } from "../lib/config.js";
import { cloneOrUpdateRepo, getRepoDir } from "../lib/repository.js";
import { select } from "@inquirer/prompts";
import * as c from "yoctocolors";
import ora from "ora";
import fs from "fs";
import path from "path";
import { EXCLUDE_LIST, DEFAULT_SOURCE } from "../utils/constants.js";
import { log } from "../utils/logger.js";
import { readConfigLists } from "../utils/parser.js";
import { selectType } from "../utils/prompts.js";

export async function handleList(type) {
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
    
    // 读取配置列表
    const configLists = readConfigLists(sourcePath);
    const {
      commands,
      skills,
      agents,
      hooks,
      mcpServers,
      lspServices,
      hasMcp,
      hasLsp,
    } = configLists;

    if (commands.length === 0 && skills.length === 0 && agents.length === 0 && hooks.length === 0 && !hasMcp && !hasLsp) {
      log.info("配置目录为空");
      return;
    }

    // 如果未指定类型，让用户选择类型
    let selectedType = type;
    if (!selectedType) {
      selectedType = await selectType(configLists);
      // selectedType 可能为 null（全部类型）或具体的类型字符串
    }

    // 验证类型
    const validTypes = ['command', 'skill', 'agent', 'hook', 'mcp', 'lsp'];
    if (selectedType && !validTypes.includes(selectedType)) {
      log.error(`无效的类型: ${selectedType}`);
      log.info(`支持的类型: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    // 构建展示内容
    const lines = [];
    let hasPreviousSection = false;

    if ((!selectedType || selectedType === 'command') && commands.length > 0) {
      lines.push(c.bold(c.cyan('🔧 Commands')) + ' ' + `(${commands.length})`);
      lines.push('');
      commands.forEach((cmd, i) => {
        const isLast = i === commands.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.yellow(cmd));
      });
      hasPreviousSection = true;
    }

    if ((!selectedType || selectedType === 'skill') && skills.length > 0) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.green('🧠 Skills')) + ' ' + `(${skills.length})`);
      lines.push('');
      skills.forEach((skill, i) => {
        const isLast = i === skills.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.green(skill));
      });
      hasPreviousSection = true;
    }

    if ((!selectedType || selectedType === 'agent') && agents.length > 0) {
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

    if ((!selectedType || selectedType === 'hook') && hooks.length > 0) {
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

    if ((!selectedType || selectedType === 'mcp') && hasMcp) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.red('🔌 MCP Servers')) + ' ' + `(${mcpServers.length})`);
      lines.push('');
      mcpServers.forEach((server, i) => {
        const isLast = i === mcpServers.length - 1 && (!hasLsp || selectedType === 'mcp');
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.red(server));
      });
      hasPreviousSection = true;
    }

    if ((!selectedType || selectedType === 'lsp') && hasLsp) {
      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(c.yellow('💻 LSP Services')) + ' ' + `(${lspServices.length})`);
      lines.push('');
      lspServices.forEach((service, i) => {
        const isLast = i === lspServices.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + c.yellow(service));
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
    console.log('    wr-ai add <name>           ' + '添加指定配置（command/skill/agent/hook/mcp/lsp）');
    console.log('    wr-ai init [type]          ' + '交互式选择添加（可选类型：command/skill/agent/hook/mcp/lsp）');
    console.log('    wr-ai list [type]          ' + '列出可用配置（可选类型：command/skill/agent/hook/mcp/lsp）');
    console.log();

  } catch (error) {
    // 检查是否是用户取消操作（Ctrl+C）
    if (error.name === 'CancelError' ||
        error.message?.includes('SIGINT') ||
        error.message?.includes('cancel') ||
        error.message?.includes('取消') ||
        error.message?.includes('操作已取消')) {
      spinner.stop();
      log.info('操作已取消');
      process.exit(0);
    }

    spinner.fail(`获取配置列表失败: ${error.message}`);
    process.exit(1);
  }
}
