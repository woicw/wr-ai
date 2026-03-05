// src/commands/sync.js
import { getOrigin, getPlatform, getLastSelection } from '../lib/config.js';
import { resolveTargetDirectories, isValidPlatformName, updateGitignore } from '../lib/filesystem.js';
import { resolveSource } from '../lib/source.js';
import * as c from 'yoctocolors';
import ora from 'ora';
import { MAX_DISPLAY_ITEMS, OPTION_VALUES } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { readConfigLists, parseSelection } from '../utils/parser.js';
import { mergeFileConfigs, mergeMcpConfig, mergeLspConfig } from '../utils/merger.js';
import { handleCancelError } from '../utils/error-handler.js';

/**
 * 同步上次选择的配置（无需重新选择）
 * @param {Object} options - 命令选项
 * @param {boolean} [options.global] - 是否同步全局配置
 * @param {string} [options.platform] - 指定平台目录
 */
export async function handleSync(options = {}) {
  const isGlobal = options.global || false;

  // 读取上次保存的选择
  const lastSelection = getLastSelection(isGlobal);
  if (!lastSelection) {
    log.error(isGlobal
      ? '未找到全局配置的历史选择，请先运行 "wr-ai init -g" 或 "wr-ai update -g"'
      : '未找到本地配置的历史选择，请先运行 "wr-ai init" 或 "wr-ai update"');
    process.exit(1);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在同步配置...').start();

  try {
    const { sourcePath, srcBaseDir } = await resolveSource(origin, spinner);

    // 读取配置列表
    const configLists = readConfigLists(sourcePath);
    const {
      commands, skills, agents, hooks,
      mcpServers, lspServices,
      hasMcp, hasLsp,
      mcpFile, lspFile,
      commandsDir, skillsDir, agentsDir, hooksDir,
    } = configLists;

    // 根据保存的选择构建 selected 数组
    const selected = [];

    for (const cmd of lastSelection.commands || []) {
      if (commands.includes(cmd)) selected.push(`${OPTION_VALUES.CMD_PREFIX}${cmd}`);
    }
    for (const skill of lastSelection.skills || []) {
      if (skills.includes(skill)) selected.push(`${OPTION_VALUES.SKILL_PREFIX}${skill}`);
    }
    for (const agent of lastSelection.agents || []) {
      if (agents.includes(agent)) selected.push(`${OPTION_VALUES.AGENT_PREFIX}${agent}`);
    }
    for (const hook of lastSelection.hooks || []) {
      if (hooks.includes(hook)) selected.push(`${OPTION_VALUES.HOOK_PREFIX}${hook}`);
    }
    for (const mcp of lastSelection.mcpServers || []) {
      if (mcpServers.includes(mcp)) selected.push(`${OPTION_VALUES.MCP_PREFIX}${mcp}`);
    }
    for (const lsp of lastSelection.lspServices || []) {
      if (lspServices.includes(lsp)) selected.push(`${OPTION_VALUES.LSP_PREFIX}${lsp}`);
    }

    if (selected.length === 0) {
      log.warn('上次选择的配置项在远程仓库中已不存在，请重新运行 "wr-ai init" 或 "wr-ai update"');
      process.exit(1);
    }

    // 显示将要同步的内容
    log.info(`将同步 ${selected.length} 个配置项（上次选择于 ${lastSelection.timestamp}）`);

    // 解析选择
    const selection = parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices);

    // 确定目标目录
    const fallbackPlatform = getPlatform();
    if (options.platform && !isValidPlatformName(options.platform)) {
      log.error('平台名称只能包含字母、数字、连字符和下划线');
      process.exit(1);
    }
    const targetDirs = resolveTargetDirectories({
      global: isGlobal,
      platform: options.platform,
      fallbackPlatform,
      cwd: process.cwd(),
    });

    // 执行合并
    for (const target of targetDirs) {
      const { platform, dirName, claudeDir, targetPathPrefix } = target;
      const syncSpinner = ora(`正在同步到 ${dirName}/...`).start();

      const fileResults = mergeFileConfigs(
        selection.selectedCommands,
        selection.selectedSkills,
        selection.selectedAgents,
        selection.selectedHooks,
        { commandsDir, skillsDir, agentsDir, hooksDir },
        claudeDir,
        srcBaseDir
      );

      const { addedItems, updatedItems, copiedItems } = fileResults;

      if (selection.selectMcp && hasMcp) {
        const status = mergeMcpConfig(mcpFile, claudeDir, selection.selectedMcpServers, selection.selectAllMcp, srcBaseDir);
        if (status === 'updated') updatedItems.push('.mcp.json');
        else addedItems.push('.mcp.json');
        copiedItems.push('.mcp.json');
      }

      if (selection.selectLsp && hasLsp) {
        const status = mergeLspConfig(lspFile, claudeDir, selection.selectedLspServices, selection.selectAllLsp, srcBaseDir);
        if (status === 'updated') updatedItems.push('.lsp.json');
        else addedItems.push('.lsp.json');
        copiedItems.push('.lsp.json');
      }

      const targetPath = `${targetPathPrefix}/`;
      let successMsg = `已同步 ${copiedItems.length} 个项目到 ${targetPath}:\n`;
      if (addedItems.length > 0) {
        successMsg += c.green(`  新增: ${addedItems.length} 个\n`);
      }
      if (updatedItems.length > 0) {
        successMsg += c.yellow(`  更新: ${updatedItems.length} 个\n`);
      }
      if (copiedItems.length <= MAX_DISPLAY_ITEMS) {
        successMsg += copiedItems.map((f) => `  • ${f}`).join('\n');
      } else {
        successMsg += copiedItems.slice(0, MAX_DISPLAY_ITEMS).map((f) => `  • ${f}`).join('\n');
        successMsg += `\n  ... 还有 ${copiedItems.length - MAX_DISPLAY_ITEMS} 个`;
      }
      syncSpinner.succeed(successMsg);

      if (!isGlobal && updateGitignore(process.cwd(), false, platform)) {
        log.info(`已添加 .${platform} 到 .gitignore`);
      }
    }
  } catch (error) {
    if (error.name === 'CancelError' || error.name === 'ExitPromptError' ||
        error.message?.includes('SIGINT') || error.message?.includes('cancel') ||
        error.message?.includes('取消') || error.message?.includes('操作已取消')) {
      spinner.stop();
      log.info('操作已取消');
      process.exit(0);
    }
    spinner.fail(`同步失败: ${error.message}`);
    if (error.stack) {
      log.error(`错误堆栈: ${error.stack}`);
    }
    process.exit(1);
  }
}
