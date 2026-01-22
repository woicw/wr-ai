import { getOrigin } from '../lib/config.js';
import { cloneOrUpdateRepo, getRepoDir } from '../lib/repository.js';
import { ensureClaudeDir, updateGitignore } from '../lib/filesystem.js';
import { select } from '@inquirer/prompts';
import * as c from 'yoctocolors';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { EXCLUDE_LIST, DEFAULT_SOURCE, MAX_DISPLAY_ITEMS } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { readConfigLists, parseSelection } from '../utils/parser.js';
import { buildOptions, selectConfigs, confirmAction } from '../utils/prompts.js';
import { mergeFileConfigs, mergeMcpConfig, mergeLspConfig, checkNeedConfirm } from '../utils/merger.js';

export async function handleInit() {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在获取AI配置...').start();

  try {
    await cloneOrUpdateRepo(origin);
    const repoDir = getRepoDir(origin);

    // 读取根目录下的所有目录
    const items = fs.readdirSync(repoDir, { withFileTypes: true })
      .filter((item) => item.isDirectory() && !EXCLUDE_LIST.includes(item.name))
      .map((item) => item.name);

    if (items.length === 0) {
      spinner.fail('仓库中未找到可用配置');
      process.exit(1);
    }

    spinner.stop();

    // 确定配置来源
    let sourceDir;
    if (items.includes(DEFAULT_SOURCE)) {
      sourceDir = DEFAULT_SOURCE;
    } else {
      try {
        sourceDir = await select({
          message: c.bold('请选择配置来源:'),
          choices: items.map((name) => ({
            name: c.cyan(`📁 ${name}`),
            value: name,
            description: c.dim(`配置目录: ${name}/`),
          })),
        });
      } catch (error) {
        log.info('已取消');
        process.exit(0);
      }
    }

    const sourcePath = path.join(repoDir, sourceDir);
    const srcBaseDir = path.resolve(sourcePath);

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
    const options = buildOptions(commands, skills, agents, hooks, mcpServers, lspServices, hasMcp, hasLsp, '复制');

    // 选择配置
    const selected = await selectConfigs(options, '请选择要添加的配置（空格选择，回车确认）:');

    const cwd = process.cwd();
    const claudeDir = ensureClaudeDir(cwd);

    // 解析选择结果
    const selection = parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices);

    // 检查是否需要确认
    const confirmMessage = checkNeedConfirm(selection, claudeDir);
    if (confirmMessage) {
      await confirmAction(confirmMessage);
    }

    const copySpinner = ora('正在合并到 .claude/...').start();

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

    const { addedItems, updatedItems, copiedItems } = fileResults;

    // 合并 MCP 配置
    if (selection.selectMcp && hasMcp) {
      const status = mergeMcpConfig(mcpFile, claudeDir, selection.selectedMcpServers, selection.selectAllMcp, srcBaseDir);
      if (status === 'updated') {
        updatedItems.push('.mcp.json');
      } else {
        addedItems.push('.mcp.json');
      }
      copiedItems.push('.mcp.json');
    }

    // 合并 LSP 配置
    if (selection.selectLsp && hasLsp) {
      const status = mergeLspConfig(lspFile, claudeDir, selection.selectedLspServices, selection.selectAllLsp, srcBaseDir);
      if (status === 'updated') {
        updatedItems.push('.lsp.json');
      } else {
        addedItems.push('.lsp.json');
      }
      copiedItems.push('.lsp.json');
    }

    // 输出结果
    let successMsg = `已合并 ${copiedItems.length} 个项目到 .claude/:\n`;
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
    copySpinner.succeed(successMsg);

    // 更新 .gitignore
    if (updateGitignore(cwd)) {
      log.info('已添加 .claude 到 .gitignore');
    }
  } catch (error) {
    // 检查是否是用户取消操作（Ctrl+C）
    if (error.name === 'ExitPromptError' ||
      error.name === 'CancelError' ||
      error.message?.includes('SIGINT') ||
      error.message?.includes('cancel') ||
      error.message?.includes('取消')) {
      spinner.stop();
      log.info('操作:初始化配置已取消，退出程序');
      process.exit(0);
    }

    spinner.fail(`初始化失败: ${error.message}`);
    if (error.stack) {
      log.error(`错误堆栈: ${error.stack}`);
    }
    log.error(`操作: 初始化配置`);
    process.exit(1);
  }
}
