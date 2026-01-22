import fs from 'fs';
import path from 'path';
import * as c from 'yoctocolors';
import { select, checkbox } from '@inquirer/prompts';
import { copyFileOrDir } from '../fileOps.js';

// 常量定义
export const OPTION_VALUES = {
  ALL: '__all__',
  ALL_COMMANDS: '__all_commands__',
  ALL_SKILLS: '__all_skills__',
  ALL_AGENTS: '__all_agents__',
  ALL_HOOKS: '__all_hooks__',
  ALL_MCP: '__all_mcp__',
  ALL_LSP: '__all_lsp__',
  CMD_PREFIX: 'cmd:',
  SKILL_PREFIX: 'skill:',
  AGENT_PREFIX: 'agent:',
  HOOK_PREFIX: 'hook:',
  MCP_PREFIX: 'mcp:',
  LSP_PREFIX: 'lsp:',
  MCP_VALUE: 'mcp',
  LSP_VALUE: 'lsp',
};

export const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
export const DEFAULT_SOURCE = 'awesome-claude';
export const MAX_DISPLAY_ITEMS = 10;

// 日志函数
export const log = {
  info: (msg) => console.log(c.cyan('ℹ'), msg),
  warn: (msg) => console.log(c.yellow('⚠'), msg),
  error: (msg) => console.log(c.red('✖'), msg),
  success: (msg) => console.log(c.green('✔'), msg),
};

// 路径验证函数，防止路径遍历攻击
export function validatePath(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  // 确保解析后的路径在基础目录内（使用 path.sep 确保跨平台兼容）
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`路径遍历攻击检测: ${filePath} 不在 ${baseDir} 目录内`);
  }
  return resolved;
}

// 安全的 JSON 解析函数
export function safeJsonParse(filePath, defaultValue = {}, throwOnError = false) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    const errorMsg = `无法解析 JSON 文件 ${filePath}: ${e.message}`;
    log.warn(errorMsg);
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    return defaultValue;
  }
}

// 读取配置列表
export function readConfigLists(sourcePath) {
  const commandsDir = path.join(sourcePath, 'commands');
  const skillsDir = path.join(sourcePath, 'skills');
  const agentsDir = path.join(sourcePath, 'agents');
  const hooksDir = path.join(sourcePath, 'hooks');
  const mcpFile = path.join(sourcePath, '.mcp.json');
  const lspFile = path.join(sourcePath, '.lsp.json');

  const commands = fs.existsSync(commandsDir)
    ? fs.readdirSync(commandsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''))
    : [];

  const skills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
    : [];

  const agents = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''))
    : [];

  const hooks = fs.existsSync(hooksDir)
    ? fs.readdirSync(hooksDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
    : [];

  const mcpConfig = safeJsonParse(mcpFile, {});
  const lspConfig = safeJsonParse(lspFile, {});

  const mcpServers = mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object'
    ? Object.keys(mcpConfig.mcpServers)
    : [];
  const lspServices = typeof lspConfig === 'object' && lspConfig !== null
    ? Object.keys(lspConfig)
    : [];

  return {
    commands,
    skills,
    agents,
    hooks,
    mcpServers,
    lspServices,
    hasMcp: mcpServers.length > 0 || fs.existsSync(mcpFile),
    hasLsp: lspServices.length > 0 || fs.existsSync(lspFile),
    mcpFile,
    lspFile,
    commandsDir,
    skillsDir,
    agentsDir,
    hooksDir,
  };
}

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

// 解析选择结果
export function parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices) {
  // 输入验证
  if (!Array.isArray(selected)) {
    throw new Error('selected 必须是数组');
  }
  if (!Array.isArray(commands) || !Array.isArray(skills) || !Array.isArray(agents) || 
      !Array.isArray(hooks) || !Array.isArray(mcpServers) || !Array.isArray(lspServices)) {
    throw new Error('所有列表参数必须是数组类型');
  }
  
  const selectAll = selected.includes(OPTION_VALUES.ALL);
  const selectAllCommands = selectAll || selected.includes(OPTION_VALUES.ALL_COMMANDS);
  const selectAllSkills = selectAll || selected.includes(OPTION_VALUES.ALL_SKILLS);
  const selectAllAgents = selectAll || selected.includes(OPTION_VALUES.ALL_AGENTS);
  const selectAllHooks = selectAll || selected.includes(OPTION_VALUES.ALL_HOOKS);
  const selectAllMcp = selectAll || selected.includes(OPTION_VALUES.ALL_MCP);
  const selectAllLsp = selectAll || selected.includes(OPTION_VALUES.ALL_LSP);

  const selectedMcpServers = selectAllMcp
    ? mcpServers
    : selected.filter((s) => s.startsWith(OPTION_VALUES.MCP_PREFIX)).map((s) => s.replace(OPTION_VALUES.MCP_PREFIX, ''));
  const selectedLspServices = selectAllLsp
    ? lspServices
    : selected.filter((s) => s.startsWith(OPTION_VALUES.LSP_PREFIX)).map((s) => s.replace(OPTION_VALUES.LSP_PREFIX, ''));

  const selectMcp = selectAllMcp || selectedMcpServers.length > 0 || selected.includes(OPTION_VALUES.MCP_VALUE);
  const selectLsp = selectAllLsp || selectedLspServices.length > 0 || selected.includes(OPTION_VALUES.LSP_VALUE);

  const selectedCommands = selectAllCommands
    ? commands
    : selected.filter((s) => s.startsWith(OPTION_VALUES.CMD_PREFIX)).map((s) => s.replace(OPTION_VALUES.CMD_PREFIX, ''));

  const selectedSkills = selectAllSkills
    ? skills
    : selected.filter((s) => s.startsWith(OPTION_VALUES.SKILL_PREFIX)).map((s) => s.replace(OPTION_VALUES.SKILL_PREFIX, ''));

  const selectedAgents = selectAllAgents
    ? agents
    : selected.filter((s) => s.startsWith(OPTION_VALUES.AGENT_PREFIX)).map((s) => s.replace(OPTION_VALUES.AGENT_PREFIX, ''));

  const selectedHooks = selectAllHooks
    ? hooks
    : selected.filter((s) => s.startsWith(OPTION_VALUES.HOOK_PREFIX)).map((s) => s.replace(OPTION_VALUES.HOOK_PREFIX, ''));

  return {
    selectAll,
    selectAllCommands,
    selectAllSkills,
    selectAllAgents,
    selectAllHooks,
    selectAllMcp,
    selectAllLsp,
    selectMcp,
    selectLsp,
    selectedCommands,
    selectedSkills,
    selectedAgents,
    selectedHooks,
    selectedMcpServers,
    selectedLspServices,
  };
}

// 安全的文件复制
export function safeCopyFile(srcPath, destPath, srcBaseDir, destBaseDir = null) {
  try {
    // 验证源路径在源目录内
    validatePath(srcPath, srcBaseDir);
    
    // 验证目标路径在目标目录内（如果提供了目标目录）
    if (destBaseDir) {
      validatePath(destPath, destBaseDir);
    }
    
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    return true;
  } catch (error) {
    log.error(`复制文件失败: ${srcPath} -> ${destPath}`);
    log.error(`错误: ${error.message}`);
    throw error;
  }
}

// 安全的目录复制
export function safeCopyDir(srcPath, destPath, srcBaseDir, destBaseDir = null) {
  try {
    // 验证源路径在源目录内
    validatePath(srcPath, srcBaseDir);
    
    // 验证目标路径在目标目录内（如果提供了目标目录）
    if (destBaseDir) {
      validatePath(destPath, destBaseDir);
    }
    
    copyFileOrDir(srcPath, destPath);
    return true;
  } catch (error) {
    log.error(`复制目录失败: ${srcPath} -> ${destPath}`);
    log.error(`错误: ${error.message}`);
    throw error;
  }
}

// 合并文件配置
export function mergeFileConfigs(
  selectedCommands,
  selectedSkills,
  selectedAgents,
  selectedHooks,
  sourceDirs,
  claudeDir,
  srcBaseDir
) {
  // 输入验证
  if (!Array.isArray(selectedCommands) || !Array.isArray(selectedSkills) || 
      !Array.isArray(selectedAgents) || !Array.isArray(selectedHooks)) {
    throw new Error('选择项必须是数组类型');
  }
  
  const { commandsDir, skillsDir, agentsDir, hooksDir } = sourceDirs;
  const addedItems = [];
  const updatedItems = [];
  const copiedItems = [];
  const resolvedClaudeDir = path.resolve(claudeDir);

  // 合并 commands
  if (selectedCommands.length > 0) {
    const destDir = path.join(claudeDir, 'commands');
    fs.mkdirSync(destDir, { recursive: true });
    for (const cmd of selectedCommands) {
      const srcPath = path.join(commandsDir, `${cmd}.md`);
      const destPath = path.join(destDir, `${cmd}.md`);
      const exists = fs.existsSync(destPath);
      
      safeCopyFile(srcPath, destPath, srcBaseDir, resolvedClaudeDir);
      
      const item = path.join('commands', `${cmd}.md`);
      if (exists) {
        updatedItems.push(item);
      } else {
        addedItems.push(item);
      }
      copiedItems.push(item);
    }
  }

  // 合并 skills
  if (selectedSkills.length > 0) {
    const destDir = path.join(claudeDir, 'skills');
    fs.mkdirSync(destDir, { recursive: true });
    for (const skill of selectedSkills) {
      const srcPath = path.join(skillsDir, skill);
      const destPath = path.join(destDir, skill);
      const exists = fs.existsSync(destPath);
      
      safeCopyDir(srcPath, destPath, srcBaseDir, resolvedClaudeDir);
      
      const item = path.join('skills', `${skill}/`);
      if (exists) {
        updatedItems.push(item);
      } else {
        addedItems.push(item);
      }
      copiedItems.push(item);
    }
  }

  // 合并 agents
  if (selectedAgents.length > 0) {
    const destDir = path.join(claudeDir, 'agents');
    fs.mkdirSync(destDir, { recursive: true });
    for (const agent of selectedAgents) {
      const srcPath = path.join(agentsDir, `${agent}.md`);
      const destPath = path.join(destDir, `${agent}.md`);
      const exists = fs.existsSync(destPath);
      
      safeCopyFile(srcPath, destPath, srcBaseDir, resolvedClaudeDir);
      
      const item = path.join('agents', `${agent}.md`);
      if (exists) {
        updatedItems.push(item);
      } else {
        addedItems.push(item);
      }
      copiedItems.push(item);
    }
  }

  // 合并 hooks
  if (selectedHooks.length > 0) {
    const destDir = path.join(claudeDir, 'hooks');
    fs.mkdirSync(destDir, { recursive: true });
    for (const hook of selectedHooks) {
      const srcPath = path.join(hooksDir, `${hook}.json`);
      const destPath = path.join(destDir, `${hook}.json`);
      const exists = fs.existsSync(destPath);
      
      safeCopyFile(srcPath, destPath, srcBaseDir, resolvedClaudeDir);
      
      const item = path.join('hooks', `${hook}.json`);
      if (exists) {
        updatedItems.push(item);
      } else {
        addedItems.push(item);
      }
      copiedItems.push(item);
    }
  }

  return { addedItems, updatedItems, copiedItems };
}

// 合并 MCP 配置
export function mergeMcpConfig(
  mcpFile,
  claudeDir,
  selectedMcpServers,
  selectAllMcp,
  srcBaseDir
) {
  const destPath = path.join(claudeDir, '.mcp.json');
  const exists = fs.existsSync(destPath);
  const resolvedClaudeDir = path.resolve(claudeDir);

  // 验证源文件路径
  validatePath(mcpFile, srcBaseDir);
  // 验证目标路径
  validatePath(destPath, resolvedClaudeDir);

  const remoteConfig = safeJsonParse(mcpFile, {}, true);
  const localConfig = exists ? safeJsonParse(destPath, {}, true) : {};

  const serversToMerge = selectAllMcp || selectedMcpServers.length === 0
    ? (remoteConfig.mcpServers || {})
    : {};

  if (selectedMcpServers.length > 0) {
    selectedMcpServers.forEach((server) => {
      if (remoteConfig.mcpServers && remoteConfig.mcpServers[server]) {
        serversToMerge[server] = remoteConfig.mcpServers[server];
      }
    });
  }

  const mergedConfig = {
    mcpServers: {
      ...(localConfig.mcpServers || {}),
      ...serversToMerge,
    },
  };

  // 原子性写入：先写入临时文件，然后重命名
  const tempPath = destPath + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(mergedConfig, null, 2) + '\n');
    fs.renameSync(tempPath, destPath);
  } catch (error) {
    // 如果写入失败，尝试清理临时文件
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        // 忽略清理错误
      }
    }
    throw error;
  }

  return exists ? 'updated' : 'added';
}

// 合并 LSP 配置
export function mergeLspConfig(
  lspFile,
  claudeDir,
  selectedLspServices,
  selectAllLsp,
  srcBaseDir
) {
  const destPath = path.join(claudeDir, '.lsp.json');
  const exists = fs.existsSync(destPath);
  const resolvedClaudeDir = path.resolve(claudeDir);

  // 验证源文件路径
  validatePath(lspFile, srcBaseDir);
  // 验证目标路径
  validatePath(destPath, resolvedClaudeDir);

  const remoteConfig = safeJsonParse(lspFile, {}, true);
  const localConfig = exists ? safeJsonParse(destPath, {}, true) : {};

  const servicesToMerge = selectAllLsp || selectedLspServices.length === 0
    ? remoteConfig
    : {};

  if (selectedLspServices.length > 0) {
    selectedLspServices.forEach((service) => {
      if (remoteConfig[service]) {
        servicesToMerge[service] = remoteConfig[service];
      }
    });
  }

  const mergedConfig = {
    ...localConfig,
    ...servicesToMerge,
  };

  // 原子性写入：先写入临时文件，然后重命名
  const tempPath = destPath + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(mergedConfig, null, 2) + '\n');
    fs.renameSync(tempPath, destPath);
  } catch (error) {
    // 如果写入失败，尝试清理临时文件
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        // 忽略清理错误
      }
    }
    throw error;
  }

  return exists ? 'updated' : 'added';
}

// 检查是否需要确认
export function checkNeedConfirm(
  selection,
  claudeDir
) {
  const localCommandsDir = path.join(claudeDir, 'commands');
  const localSkillsDir = path.join(claudeDir, 'skills');
  const localAgentsDir = path.join(claudeDir, 'agents');
  const localHooksDir = path.join(claudeDir, 'hooks');
  const localMcpFile = path.join(claudeDir, '.mcp.json');
  const localLspFile = path.join(claudeDir, '.lsp.json');

  const hasLocalCommands = fs.existsSync(localCommandsDir) && fs.readdirSync(localCommandsDir).length > 0;
  const hasLocalSkills = fs.existsSync(localSkillsDir) && fs.readdirSync(localSkillsDir).length > 0;
  const hasLocalAgents = fs.existsSync(localAgentsDir) && fs.readdirSync(localAgentsDir).length > 0;
  const hasLocalHooks = fs.existsSync(localHooksDir) && fs.readdirSync(localHooksDir).length > 0;
  const hasLocalMcp = fs.existsSync(localMcpFile);
  const hasLocalLsp = fs.existsSync(localLspFile);

  const {
    selectAll,
    selectAllCommands,
    selectAllSkills,
    selectAllAgents,
    selectAllHooks,
    selectMcp,
    selectLsp,
  } = selection;

  if (selectAll && (hasLocalCommands || hasLocalSkills || hasLocalAgents || hasLocalHooks || hasLocalMcp || hasLocalLsp)) {
    return '此操作将合并远程配置到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
  }
  if (selectAllCommands && hasLocalCommands) {
    return '此操作将合并远程 commands 到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
  }
  if (selectAllSkills && hasLocalSkills) {
    return '此操作将合并远程 skills 到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
  }
  if (selectAllAgents && hasLocalAgents) {
    return '此操作将合并远程 agents 到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
  }
  if (selectAllHooks && hasLocalHooks) {
    return '此操作将合并远程 hooks 到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
  }
  if (selectMcp && hasLocalMcp) {
    return '此操作将合并远程 MCP 配置到本地（已存在的服务器配置会被覆盖），是否继续？';
  }
  if (selectLsp && hasLocalLsp) {
    return '此操作将合并远程 LSP 配置到本地（已存在的服务配置会被覆盖），是否继续？';
  }

  return null;
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
