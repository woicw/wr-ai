import fs from 'fs';
import path from 'path';
import { safeJsonParse } from './validator.js';
import { OPTION_VALUES } from './constants.js';

/**
 * 读取配置源目录中的所有配置列表
 * @param {string} sourcePath - 配置源目录路径
 * @returns {Object} 包含 commands、skills、agents、hooks、mcpServers、lspServices 等配置的对象
 */
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

/**
 * 解析用户选择的配置项
 * @param {string[]} selected - 用户选择的选项值数组
 * @param {string[]} commands - 可用的 commands 列表
 * @param {string[]} skills - 可用的 skills 列表
 * @param {string[]} agents - 可用的 agents 列表
 * @param {string[]} hooks - 可用的 hooks 列表
 * @param {string[]} mcpServers - 可用的 MCP 服务器列表
 * @param {string[]} lspServices - 可用的 LSP 服务列表
 * @returns {Object} 解析后的选择结果对象
 * @throws {Error} 如果输入参数类型不正确
 */
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
