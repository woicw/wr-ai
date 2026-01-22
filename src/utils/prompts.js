import { select, checkbox } from '@inquirer/prompts';
import * as c from 'yoctocolors';
import { OPTION_VALUES } from './constants.js';
import { log } from './logger.js';

// 构建选项列表
export function buildOptions(commands, skills, agents, hooks, mcpServers, lspServices, hasMcp, hasLsp, actionText) {
  const options = [
    {
      value: OPTION_VALUES.ALL,
      label: c.bold(c.magenta(`⚡ ALL - ${actionText}所有配置`)),
      hint: c.dim(actionText === '复制' ? '复制全部配置项' : '替换全部配置项'),
    },
  ];

  if (commands.length > 0) {
    options.push({
      value: OPTION_VALUES.ALL_COMMANDS,
      label: c.bold(c.cyan('🔧 ALL Commands')),
      hint: c.dim(`${commands.length} 个命令`),
    });
    commands.forEach((cmd) => {
      options.push({
        value: `${OPTION_VALUES.CMD_PREFIX}${cmd}`,
        label: c.dim('  └─ ') + c.yellow(cmd),
        hint: c.dim('命令'),
      });
    });
  }

  if (skills.length > 0) {
    options.push({
      value: OPTION_VALUES.ALL_SKILLS,
      label: c.bold(c.green('🧠 ALL Skills')),
      hint: c.dim(`${skills.length} 个技能`),
    });
    skills.forEach((skill) => {
      options.push({
        value: `${OPTION_VALUES.SKILL_PREFIX}${skill}`,
        label: c.dim('  └─ ') + c.green(skill),
        hint: c.dim('技能'),
      });
    });
  }

  if (agents.length > 0) {
    options.push({
      value: OPTION_VALUES.ALL_AGENTS,
      label: c.bold(c.blue('🤖 ALL Agents')),
      hint: c.dim(`${agents.length} 个代理`),
    });
    agents.forEach((agent) => {
      options.push({
        value: `${OPTION_VALUES.AGENT_PREFIX}${agent}`,
        label: c.dim('  └─ ') + c.blue(agent),
        hint: c.dim('代理'),
      });
    });
  }

  if (hooks.length > 0) {
    options.push({
      value: OPTION_VALUES.ALL_HOOKS,
      label: c.bold(c.magenta('🪝 ALL Hooks')),
      hint: c.dim(`${hooks.length} 个钩子`),
    });
    hooks.forEach((hook) => {
      options.push({
        value: `${OPTION_VALUES.HOOK_PREFIX}${hook}`,
        label: c.dim('  └─ ') + c.magenta(hook),
        hint: c.dim('钩子'),
      });
    });
  }

  if (hasMcp) {
    if (mcpServers.length > 0) {
      options.push({
        value: OPTION_VALUES.ALL_MCP,
        label: c.bold(c.red('🔌 ALL MCP Servers')),
        hint: c.dim(`${mcpServers.length} 个服务器`),
      });
      mcpServers.forEach((server) => {
        options.push({
          value: `${OPTION_VALUES.MCP_PREFIX}${server}`,
          label: c.dim('  └─ ') + c.red(server),
          hint: c.dim('MCP 服务器'),
        });
      });
    } else {
      options.push({
        value: OPTION_VALUES.MCP_VALUE,
        label: c.red('🔌 MCP 配置'),
        hint: c.dim('.mcp.json'),
      });
    }
  }

  if (hasLsp) {
    if (lspServices.length > 0) {
      options.push({
        value: OPTION_VALUES.ALL_LSP,
        label: c.bold(c.yellow('💻 ALL LSP Services')),
        hint: c.dim(`${lspServices.length} 个服务`),
      });
      lspServices.forEach((service) => {
        options.push({
          value: `${OPTION_VALUES.LSP_PREFIX}${service}`,
          label: c.dim('  └─ ') + c.yellow(service),
          hint: c.dim('LSP 服务'),
        });
      });
    } else {
      options.push({
        value: OPTION_VALUES.LSP_VALUE,
        label: c.yellow('💻 LSP 配置'),
        hint: c.dim('.lsp.json'),
      });
    }
  }

  return options;
}

// 选择配置
export async function selectConfigs(options, message) {
  // 输入验证
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error('选项列表不能为空');
  }
  
  const mappedChoices = options.map((opt) => ({
    name: opt.label,
    value: opt.value,
    description: opt.hint || '',
  }));

  let selected = [];
  while (true) {
    try {
      selected = await checkbox({
        message: c.bold(message),
        choices: mappedChoices,
        loop: false,
      });

      if (selected && selected.length > 0) break;

      const action = await select({
        message: c.yellow('未选择任何项，请选择操作:'),
        choices: [
          { name: c.cyan('🔄 重新选择'), value: 'retry', description: c.dim('返回选择列表') },
          { name: c.red('❌ 取消'), value: 'cancel', description: c.dim('退出操作') },
        ],
      });

      if (action === 'cancel') {
        log.info('已取消');
        process.exit(0);
      }
    } catch (error) {
      // 区分取消操作和真正的错误
      if (error.name === 'CancelError' || error.message?.includes('cancel') || error.message?.includes('取消')) {
        log.info('已取消');
        process.exit(0);
      }
      // 重新抛出真正的错误
      throw error;
    }
  }

  return selected;
}

// 确认对话框
export async function confirmAction(message) {
  try {
    const confirmResult = await select({
      message: c.yellow(message),
      choices: [
        { name: c.green('✅ 确认继续'), value: 'yes', description: c.dim('执行合并操作') },
        { name: c.red('❌ 取消'), value: 'no', description: c.dim('退出操作') },
      ],
    });

    if (confirmResult === 'no') {
      log.info('已取消');
      process.exit(0);
    }
  } catch (error) {
    // 区分取消操作和真正的错误
    if (error.name === 'CancelError' || error.message?.includes('cancel') || error.message?.includes('取消')) {
      log.info('已取消');
      process.exit(0);
    }
    // 重新抛出真正的错误
    throw error;
  }
}
