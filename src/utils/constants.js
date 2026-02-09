import path from 'path';
import os from 'os';

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

// 模板目录路径
export const TEMPLATES_DIR = path.join(os.homedir(), '.wr-ai', 'templates');

// 有效类型列表
export const VALID_TYPES = ['command', 'skill', 'agent', 'hook', 'mcp', 'lsp'];

// 类型别名映射
const TYPE_ALIASES = {
  cmd: 'command',
  commands: 'command',
  skills: 'skill',
  agents: 'agent',
  hooks: 'hook',
};

/**
 * 规范化类型名称，支持别名
 * @param {string} type - 用户输入的类型
 * @returns {string} 标准化后的类型
 */
export function normalizeType(type) {
  if (!type) return type;
  const lower = type.toLowerCase();
  return TYPE_ALIASES[lower] || lower;
}
