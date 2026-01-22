import fs from 'fs';
import path from 'path';
import { validatePath, safeJsonParse } from './validator.js';
import { copyFileOrDir } from '../lib/filesystem.js';
import { log } from './logger.js';

/**
 * 安全地复制文件，包含路径验证
 * @param {string} srcPath - 源文件路径
 * @param {string} destPath - 目标文件路径
 * @param {string} srcBaseDir - 源文件的基础目录（用于验证）
 * @param {string|null} destBaseDir - 目标文件的基础目录（用于验证，可选）
 * @returns {boolean} 成功返回 true
 * @throws {Error} 如果路径验证失败或复制失败
 */
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

/**
 * 安全地复制目录，包含路径验证
 * @param {string} srcPath - 源目录路径
 * @param {string} destPath - 目标目录路径
 * @param {string} srcBaseDir - 源目录的基础目录（用于验证）
 * @param {string|null} destBaseDir - 目标目录的基础目录（用于验证，可选）
 * @returns {boolean} 成功返回 true
 * @throws {Error} 如果路径验证失败或复制失败
 */
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

/**
 * 合并文件配置（commands、skills、agents、hooks）到目标目录
 * @param {string[]} selectedCommands - 选中的 commands 列表
 * @param {string[]} selectedSkills - 选中的 skills 列表
 * @param {string[]} selectedAgents - 选中的 agents 列表
 * @param {string[]} selectedHooks - 选中的 hooks 列表
 * @param {Object} sourceDirs - 源目录对象，包含 commandsDir、skillsDir、agentsDir、hooksDir
 * @param {string} claudeDir - 目标 .claude 目录路径
 * @param {string} srcBaseDir - 源基础目录（用于路径验证）
 * @returns {Object} 包含 addedItems、updatedItems、copiedItems 的对象
 * @throws {Error} 如果输入参数类型不正确
 */
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

/**
 * 合并 MCP 配置到目标目录
 * @param {string} mcpFile - 源 MCP 配置文件路径
 * @param {string} claudeDir - 目标 .claude 目录路径
 * @param {string[]} selectedMcpServers - 选中的 MCP 服务器列表
 * @param {boolean} selectAllMcp - 是否选择所有 MCP 服务器
 * @param {string} srcBaseDir - 源基础目录（用于路径验证）
 * @returns {string} 'updated' 或 'added'，表示操作类型
 */
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

/**
 * 合并 LSP 配置到目标目录
 * @param {string} lspFile - 源 LSP 配置文件路径
 * @param {string} claudeDir - 目标 .claude 目录路径
 * @param {string[]} selectedLspServices - 选中的 LSP 服务列表
 * @param {boolean} selectAllLsp - 是否选择所有 LSP 服务
 * @param {string} srcBaseDir - 源基础目录（用于路径验证）
 * @returns {string} 'updated' 或 'added'，表示操作类型
 */
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

/**
 * 检查操作是否需要用户确认（当本地已有配置时）
 * @param {Object} selection - 选择结果对象
 * @param {string} claudeDir - .claude 目录路径
 * @returns {string|null} 如果需要确认则返回确认消息，否则返回 null
 */
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
