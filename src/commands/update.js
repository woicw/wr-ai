import { getOrigin, getPlatform, saveLastSelection } from '../lib/config.js';
import { resolveTargetDirectories, isValidPlatformName, updateGitignore } from '../lib/filesystem.js';
import { resolveSource } from '../lib/source.js';
import * as c from 'yoctocolors';
import ora from 'ora';
import { MAX_DISPLAY_ITEMS } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { readConfigLists, parseSelection } from '../utils/parser.js';
import { buildOptions, selectConfigs, confirmAction } from '../utils/prompts.js';
import { mergeFileConfigs, mergeMcpConfig, mergeLspConfig, checkNeedConfirm } from '../utils/merger.js';
import { handleCancelError } from '../utils/error-handler.js';

export async function handleUpdate(options = {}) {
  // 如果指定了 --last，委托给 sync 的逻辑
  if (options.last) {
    const { handleSync } = await import('./sync.js');
    return handleSync(options);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在更新配置...').start();

  try {
    const { sourcePath, srcBaseDir } = await resolveSource(origin, spinner);

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
      mcpFile,
      lspFile,
      commandsDir,
      skillsDir,
      agentsDir,
      hooksDir,
    } = configLists;

    if (commands.length === 0 && skills.length === 0 && agents.length === 0 && hooks.length === 0 && !hasMcp && !hasLsp) {
      log.warn('配置目录为空');
      process.exit(0);
    }

    // 构建选项
    const configOptions = buildOptions(commands, skills, agents, hooks, mcpServers, lspServices, hasMcp, hasLsp, '更新');

    // 选择配置
    const selected = await selectConfigs(configOptions, '请选择要更新的配置（空格选择，回车确认）:');

    const isGlobal = options.global || false;
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
    if (targetDirs.length > 1) {
      log.info(`检测到多个 AI 配置目录，将同步到: ${targetDirs.map((t) => t.dirName).join(', ')}`);
    }

    // 解析选择结果
    const selection = parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices);

    // 检查是否需要确认（多目录时仅确认一次）
    let confirmMessage = null;
    for (const target of targetDirs) {
      confirmMessage = checkNeedConfirm(selection, target.claudeDir);
      if (confirmMessage) {
        break;
      }
    }
    if (confirmMessage) {
      if (targetDirs.length > 1) {
        await confirmAction(`检测到目标目录中已有本地配置，将执行批量合并（${targetDirs.map((t) => t.dirName).join(', ')}），是否继续？`);
      } else {
        await confirmAction(confirmMessage);
      }
    }

    for (const target of targetDirs) {
      const { platform, dirName, claudeDir, targetPathPrefix } = target;
      const updateSpinner = ora(`正在合并到 ${dirName}/...`).start();

      // 合并文件配置
      const fileResults = mergeFileConfigs(
        selection.selectedCommands,
        selection.selectedSkills,
        selection.selectedAgents,
        selection.selectedHooks,
        { commandsDir, skillsDir, agentsDir, hooksDir },
        claudeDir,
        srcBaseDir
      );

      const { addedItems, updatedItems } = fileResults;

      // 合并 MCP 配置
      if (selection.selectMcp && hasMcp) {
        const status = mergeMcpConfig(mcpFile, claudeDir, selection.selectedMcpServers, selection.selectAllMcp, srcBaseDir);
        if (status === 'updated') {
          updatedItems.push('.mcp.json');
        } else {
          addedItems.push('.mcp.json');
        }
      }

      // 合并 LSP 配置
      if (selection.selectLsp && hasLsp) {
        const status = mergeLspConfig(lspFile, claudeDir, selection.selectedLspServices, selection.selectAllLsp, srcBaseDir);
        if (status === 'updated') {
          updatedItems.push('.lsp.json');
        } else {
          addedItems.push('.lsp.json');
        }
      }

      // 输出结果
      const targetPath = `${targetPathPrefix}/`;
      const totalItems = updatedItems.length + addedItems.length;
      let successMsg = `已合并 ${totalItems} 个项目到 ${targetPath}:\n`;
      if (addedItems.length > 0) {
        successMsg += c.green(`  新增: ${addedItems.length} 个\n`);
      }
      if (updatedItems.length > 0) {
        successMsg += c.yellow(`  更新: ${updatedItems.length} 个\n`);
      }
      const allItems = [...addedItems, ...updatedItems];
      if (allItems.length <= MAX_DISPLAY_ITEMS) {
        successMsg += allItems.map((f) => `  • ${f}`).join('\n');
      } else {
        successMsg += allItems.slice(0, MAX_DISPLAY_ITEMS).map((f) => `  • ${f}`).join('\n');
        successMsg += `\n  ... 还有 ${allItems.length - MAX_DISPLAY_ITEMS} 个`;
      }
      updateSpinner.succeed(successMsg);

      // 更新 .gitignore（仅在非全局模式下）
      if (!isGlobal && updateGitignore(process.cwd(), false, platform)) {
        log.info(`已添加 .${platform} 到 .gitignore`);
      }
    }

    // 保存选择
    saveLastSelection({
      commands: selection.selectedCommands,
      skills: selection.selectedSkills,
      agents: selection.selectedAgents,
      hooks: selection.selectedHooks,
      mcpServers: selection.selectedMcpServers,
      lspServices: selection.selectedLspServices,
    }, isGlobal);
  } catch (error) {
    handleCancelError(error, spinner);

    spinner.fail(`更新失败: ${error.message}`);
    if (error.stack) {
      log.error(`错误堆栈: ${error.stack}`);
    }
    log.error(`操作: 更新配置`);
    process.exit(1);
  }
}
