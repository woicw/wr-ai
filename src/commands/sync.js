import { checkbox } from '@inquirer/prompts';
import * as c from 'yoctocolors';
import ora from 'ora';
import { getOrigin, getPlatform, getLastSelection, saveLastSelection } from '../lib/config.js';
import { resolveTargetDirectories, isValidPlatformName, updateGitignore } from '../lib/filesystem.js';
import { ensureRemoteInCache, resolveSkillSource } from '../lib/installer.js';
import { resolveSource } from '../lib/source.js';
import { CACHE_DIR, MAX_DISPLAY_ITEMS } from '../utils/constants.js';
import { handleCancelError } from '../utils/error-handler.js';
import { log } from '../utils/logger.js';
import { syncSkillDirectoryFromPath } from '../utils/merger.js';
import { readManifestEntries } from '../utils/parser.js';

const ALL_SKILLS_VALUE = '__all_skills__';

export function resolveSkillsToSync(lastSelection, remoteSkills) {
  return (lastSelection?.skills || []).filter((skill) => remoteSkills.includes(skill));
}

export function normalizePromptSelection(selectedValues, remoteSkills) {
  if (selectedValues.includes(ALL_SKILLS_VALUE)) {
    return [...remoteSkills];
  }

  return selectedValues;
}

export function buildPromptChoices(remoteSkills) {
  return [
    {
      name: c.bold(c.cyan('⚡ 全部 skills')),
      value: ALL_SKILLS_VALUE,
      description: c.dim(`选择全部 ${remoteSkills.length} 个 skill`),
    },
    ...remoteSkills.map((skill) => ({
    name: c.green(skill),
    value: skill,
    description: c.dim(`skills/${skill}/`),
    })),
  ];
}

async function promptForSkills(remoteSkills) {
  if (remoteSkills.length === 0) {
    log.warn('远程仓库中没有可同步的 skills');
    process.exit(1);
  }

  const selectedValues = await checkbox({
    message: c.bold('请选择要同步的 skills:'),
    choices: buildPromptChoices(remoteSkills),
    loop: false,
  });

  const selectedSkills = normalizePromptSelection(selectedValues, remoteSkills);

  if (selectedSkills.length === 0) {
    log.warn('未选择任何 skill');
    process.exit(1);
  }

  return selectedSkills;
}

function buildSuccessMessage(selectedSkills, addedSkills, updatedSkills, targetPathPrefix) {
  let message = `已同步 ${selectedSkills.length} 个 skill 到 ${targetPathPrefix}/:\n`;

  if (addedSkills.length > 0) {
    message += c.green(`  新增: ${addedSkills.length} 个\n`);
  }

  if (updatedSkills.length > 0) {
    message += c.yellow(`  更新: ${updatedSkills.length} 个\n`);
  }

  const displaySkills = selectedSkills.slice(0, MAX_DISPLAY_ITEMS).map((skill) => `  • skills/${skill}/`);
  message += displaySkills.join('\n');

  if (selectedSkills.length > MAX_DISPLAY_ITEMS) {
    message += `\n  ... 还有 ${selectedSkills.length - MAX_DISPLAY_ITEMS} 个`;
  }

  return message;
}

/**
 * 同步上次选择的 skills，必要时回退到交互选择
 * @param {Object} options - 命令选项
 * @param {boolean} [options.global] - 是否同步全局配置
 * @param {string} [options.platform] - 指定平台目录
 */
export async function handleSync(options = {}) {
  const isGlobal = options.global || false;
  const lastSelection = getLastSelection(isGlobal);
  const origin = getOrigin();

  if (!origin) {
    log.error('请先使用 "wrs set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  if (options.platform && !isValidPlatformName(options.platform)) {
    log.error('平台名称只能包含字母、数字、连字符和下划线');
    process.exit(1);
  }

  const spinner = ora('正在同步 skills...').start();

  try {
    const { repoDir } = await resolveSource(origin, spinner);
    const entries = readManifestEntries(repoDir);
    const entryNames = entries.map((e) => e.name);

    let selectedSkills = resolveSkillsToSync(lastSelection, entryNames);

    if (selectedSkills.length === 0) {
      if ((lastSelection?.skills || []).length > 0) {
        log.warn('历史记录中的 skills 在远程仓库中已不存在，将改为手动选择');
      }

      selectedSkills = await promptForSkills(entryNames);
      saveLastSelection({ skills: selectedSkills }, isGlobal);
    } else {
      log.info(`将同步 ${selectedSkills.length} 个 skill（上次选择于 ${lastSelection.timestamp}）`);
    }

    const selectedEntryMap = new Map(entries.map((e) => [e.name, e]));
    const selectedEntries = selectedSkills
      .map((name) => selectedEntryMap.get(name))
      .filter(Boolean);

    const cacheDir = CACHE_DIR;
    const refresh = options.refresh === true;
    for (const entry of selectedEntries.filter((e) => !e.isLocal)) {
      await ensureRemoteInCache(entry, { cacheDir, refresh });
    }

    const targetDirs = resolveTargetDirectories({
      global: isGlobal,
      platform: options.platform,
      fallbackPlatform: getPlatform(),
      cwd: process.cwd(),
    });

    for (const target of targetDirs) {
      const syncSpinner = ora(`正在同步到 ${target.dirName}/...`).start();
      const addedSkills = [];
      const updatedSkills = [];

      for (const entry of selectedEntries) {
        const sourceDir = resolveSkillSource(entry, { cloneRoot: repoDir, cacheDir });
        const targetName = entry.installName ?? entry.name;
        const status = syncSkillDirectoryFromPath(sourceDir, targetName, target.claudeDir);
        if (status === 'updated') {
          updatedSkills.push(targetName);
        } else {
          addedSkills.push(targetName);
        }
      }

      syncSpinner.succeed(
        buildSuccessMessage(selectedSkills, addedSkills, updatedSkills, target.targetPathPrefix)
      );

      if (updateGitignore(process.cwd(), isGlobal, target.platform)) {
        log.info(`已添加 .${target.platform} 到 .gitignore`);
      }
    }
  } catch (error) {
    try {
      handleCancelError(error, spinner);
    } catch (handledError) {
      spinner.fail(`同步失败: ${handledError.message}`);
      if (handledError.stack) {
        log.error(`错误堆栈: ${handledError.stack}`);
      }
      process.exit(1);
    }
  }
}
