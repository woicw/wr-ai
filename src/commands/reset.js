import fs from 'fs';
import path from 'path';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { ensureClaudeDir } from '../lib/filesystem.js';
import { getPlatform } from '../lib/config.js';
import { log } from '../utils/logger.js';
import * as c from 'yoctocolors';

/**
 * 处理 reset 命令
 * @param {string} target - 要重置的文件夹或文件名
 * @param {Object} options - 命令选项
 * @param {boolean} options.global - 是否使用全局目录
 */
export async function handleReset(target, options = {}) {
  const { global: isGlobal = false } = options;

  if (!target) {
    log.error('请指定要重置的文件夹或文件名');
    log.info('支持的文件夹: commands, skills, agents, hooks');
    log.info('支持的文件: .mcp.json, .lsp.json');
    process.exit(1);
  }

  const platform = getPlatform();
  const claudeDir = ensureClaudeDir(isGlobal, platform);
  const dirName = `.${platform}`;
  const targetPathPrefix = isGlobal ? `~/${dirName}` : dirName;

  // 构建目标路径
  let targetPath;
  let targetType; // 'directory' 或 'file'
  let displayName;

  // 检查是否是配置文件（以 . 开头）
  if (target.startsWith('.')) {
    targetPath = path.join(claudeDir, target);
    targetType = 'file';
    displayName = target;
  } else {
    // 检查是否是支持的文件夹
    const validFolders = ['commands', 'skills', 'agents', 'hooks'];
    if (!validFolders.includes(target)) {
      log.error(`不支持的文件夹: ${target}`);
      log.info('支持的文件夹: commands, skills, agents, hooks');
      log.info('支持的文件: .mcp.json, .lsp.json');
      process.exit(1);
    }
    targetPath = path.join(claudeDir, target);
    targetType = 'directory';
    displayName = target;
  }

  // 检查目标是否存在
  if (!fs.existsSync(targetPath)) {
    log.info(`${displayName} 不存在于 ${targetPathPrefix}/，无需重置`);
    return;
  }

  // 确认操作
  const displayPath = isGlobal 
    ? `~/${dirName}/${displayName}`
    : `${dirName}/${displayName}`;
  
  const confirmed = await confirm({
    message: `确定要重置 ${c.yellow(displayName)} 吗？这将删除 ${c.cyan(displayPath)}`,
    default: false,
  });

  if (!confirmed) {
    log.info('已取消操作');
    return;
  }

  const spinner = ora(`正在重置 ${displayName}...`).start();

  try {
    const stat = fs.statSync(targetPath);
    
    if (stat.isDirectory()) {
      // 删除目录
      fs.rmSync(targetPath, { recursive: true, force: true });
      spinner.succeed(`已重置文件夹: ${displayName} → ${targetPathPrefix}/${displayName}`);
    } else if (stat.isFile()) {
      // 删除文件
      fs.unlinkSync(targetPath);
      spinner.succeed(`已重置文件: ${displayName} → ${targetPathPrefix}/${displayName}`);
    } else {
      spinner.fail(`未知的文件类型: ${displayName}`);
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`重置失败: ${error.message}`);
    process.exit(1);
  }
}
