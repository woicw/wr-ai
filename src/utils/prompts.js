import { select, checkbox } from '@inquirer/prompts';
import * as c from 'yoctocolors';
import { OPTION_VALUES } from './constants.js';
import { log } from './logger.js';
import { handleCancelError } from './error-handler.js';

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
      handleCancelError(error, null);
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

/**
 * 选择配置类型
 * @param {Object} configLists - 配置列表对象
 * @returns {Promise<string|null>} 选择的类型，如果选择全部则返回 null
 */
export async function selectType(configLists) {
  const { commands, skills, agents, hooks, hasMcp, hasLsp } = configLists;
  
  const choices = [];
  
  if (commands.length > 0) {
    choices.push({
      name: c.cyan('🔧 Commands'),
      value: 'command',
      description: c.dim(`${commands.length} 个命令`),
    });
  }
  
  if (skills.length > 0) {
    choices.push({
      name: c.green('🧠 Skills'),
      value: 'skill',
      description: c.dim(`${skills.length} 个技能`),
    });
  }
  
  if (agents.length > 0) {
    choices.push({
      name: c.blue('🤖 Agents'),
      value: 'agent',
      description: c.dim(`${agents.length} 个代理`),
    });
  }
  
  if (hooks.length > 0) {
    choices.push({
      name: c.magenta('🪝 Hooks'),
      value: 'hook',
      description: c.dim(`${hooks.length} 个钩子`),
    });
  }
  
  if (hasMcp) {
    choices.push({
      name: c.red('🔌 MCP'),
      value: 'mcp',
      description: c.dim('MCP 服务器配置'),
    });
  }
  
  if (hasLsp) {
    choices.push({
      name: c.yellow('💻 LSP'),
      value: 'lsp',
      description: c.dim('LSP 服务配置'),
    });
  }
  
  choices.push({
    name: c.magenta('⚡ 全部类型'),
    value: 'all',
    description: c.dim('显示所有类型的配置'),
  });
  
  if (choices.length === 0) {
    return null;
  }
  
  try {
    const selected = await select({
      message: c.bold('请选择配置类型:'),
      choices,
    });
    
    // 如果选择"全部类型"，返回 null 表示不过滤
    return selected === 'all' ? null : selected;
  } catch (error) {
    if (error.name === 'CancelError' || error.message?.includes('cancel') || error.message?.includes('取消')) {
      log.info('已取消');
      process.exit(0);
    }
    throw error;
  }
}

/**
 * 根据类型过滤选项
 * @param {Array} options - 选项列表
 * @param {string|null} type - 类型（command/skill/agent/hook/mcp/lsp），null 表示全部
 * @returns {Array} 过滤后的选项列表
 */
export function filterOptionsByType(options, type) {
  if (!type) {
    return options;
  }
  
  const typePrefixMap = {
    command: OPTION_VALUES.CMD_PREFIX,
    skill: OPTION_VALUES.SKILL_PREFIX,
    agent: OPTION_VALUES.AGENT_PREFIX,
    hook: OPTION_VALUES.HOOK_PREFIX,
    mcp: OPTION_VALUES.MCP_PREFIX,
    lsp: OPTION_VALUES.LSP_PREFIX,
  };
  
  const allOptionMap = {
    command: OPTION_VALUES.ALL_COMMANDS,
    skill: OPTION_VALUES.ALL_SKILLS,
    agent: OPTION_VALUES.ALL_AGENTS,
    hook: OPTION_VALUES.ALL_HOOKS,
    mcp: OPTION_VALUES.ALL_MCP,
    lsp: OPTION_VALUES.ALL_LSP,
  };
  
  const prefix = typePrefixMap[type];
  const allOption = allOptionMap[type];
  const valueOption = type === 'mcp' ? OPTION_VALUES.MCP_VALUE : (type === 'lsp' ? OPTION_VALUES.LSP_VALUE : null);
  
  if (!prefix && !allOption && !valueOption) {
    return options;
  }
  
  return options.filter((opt) => {
    const value = opt.value;
    // 保留 ALL 选项
    if (value === OPTION_VALUES.ALL) {
      return true;
    }
    // 保留对应类型的 ALL 选项
    if (allOption && value === allOption) {
      return true;
    }
    // 保留对应类型的值选项（mcp/lsp）
    if (valueOption && value === valueOption) {
      return true;
    }
    // 保留对应类型的前缀选项
    if (prefix && value.startsWith(prefix)) {
      return true;
    }
    return false;
  });
}
