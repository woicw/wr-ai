import { getOrigin } from "../lib/config.js";
import { resolveSource } from "../lib/source.js";
import * as c from "yoctocolors";
import ora from "ora";
import { VALID_TYPES, normalizeType } from "../utils/constants.js";
import { log } from "../utils/logger.js";
import { readConfigLists } from "../utils/parser.js";

export async function handleList(type) {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  // 规范化并验证类型
  const selectedType = type ? normalizeType(type) : null;
  if (selectedType && !VALID_TYPES.includes(selectedType)) {
    log.error(`无效的类型: ${type}`);
    log.info(`支持的类型: ${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }

  const spinner = ora("正在获取配置列表...").start();

  try {
    const { sourceDir, sourcePath } = await resolveSource(origin, spinner);

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

    // 构建展示内容（默认展示全部，不再需要交互选择类型）
    const sections = [
      { type: 'command', items: commands, icon: '🔧', title: 'Commands', color: c.cyan, itemColor: c.yellow },
      { type: 'skill', items: skills, icon: '🧠', title: 'Skills', color: c.green, itemColor: c.green },
      { type: 'agent', items: agents, icon: '🤖', title: 'Agents', color: c.blue, itemColor: c.blue },
      { type: 'hook', items: hooks, icon: '🪝', title: 'Hooks', color: c.magenta, itemColor: c.magenta },
      { type: 'mcp', items: mcpServers, icon: '🔌', title: 'MCP Servers', color: c.red, itemColor: c.red, show: hasMcp },
      { type: 'lsp', items: lspServices, icon: '💻', title: 'LSP Services', color: c.yellow, itemColor: c.yellow, show: hasLsp },
    ];

    const lines = [];
    let hasPreviousSection = false;

    for (const section of sections) {
      // 跳过不匹配的类型
      if (selectedType && selectedType !== section.type) continue;
      // 跳过空的或不可用的
      if (section.show === false) continue;
      if (section.items.length === 0 && section.show === undefined) continue;

      if (hasPreviousSection) lines.push('');
      lines.push(c.bold(section.color(`${section.icon} ${section.title}`)) + ` (${section.items.length})`);
      lines.push('');
      section.items.forEach((item, i) => {
        const isLast = i === section.items.length - 1;
        const prefix = isLast ? '└─' : '├─';
        lines.push(prefix + ' ' + section.itemColor(item));
      });
      hasPreviousSection = true;
    }

    if (lines.length === 0) {
      log.info(selectedType ? `未找到 ${selectedType} 类型的配置` : "配置目录为空");
      return;
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
        error.name === 'ExitPromptError' ||
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
