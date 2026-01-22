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
