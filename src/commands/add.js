import path from 'node:path';
import ora from 'ora';
import { getOrigin, getPlatform } from '../lib/config.js';
import { resolveTargetDirectories, isValidPlatformName, updateGitignore } from '../lib/filesystem.js';
import { resolveSource } from '../lib/source.js';
import { log } from '../utils/logger.js';
import { readSkillList } from '../utils/parser.js';
import { syncSkillDirectory } from '../utils/merger.js';

function formatDestinations(targetDirs, relativePath) {
  return targetDirs
    .map((target) => `${target.targetPathPrefix}/${relativePath}`)
    .join(', ');
}

function afterAddTargets(isGlobal, targetDirs) {
  for (const target of targetDirs) {
    if (updateGitignore(process.cwd(), isGlobal, target.platform)) {
      log.info(`已添加 .${target.platform} 到 .gitignore`);
    }
  }
}

function listAvailableSkills(skills) {
  if (skills.length === 0) {
    return;
  }

  console.log('\n可用的 skills:');
  skills.forEach((skill) => console.log(`  • ${skill}`));
}

export function findSkillOrThrow(skills, name) {
  if (!skills.includes(name)) {
    throw new Error(`未找到 skill: ${name}`);
  }

  return name;
}

export async function handleAdd(name, options = {}) {
  if (!name) {
    log.error('请指定要添加的 skill 名称，格式: <name>');
    process.exit(1);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wrs set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora(`正在查找 "${name}"...`).start();

  try {
    const { sourcePath } = await resolveSource(origin, spinner);
    const skills = readSkillList(sourcePath);
    const skillName = findSkillOrThrow(skills, name);

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
      log.info(`检测到多个 AI 配置目录，将同步到: ${targetDirs.map((target) => target.dirName).join(', ')}`);
    }

    const skillsDir = path.join(sourcePath, 'skills');
    for (const target of targetDirs) {
      syncSkillDirectory(skillsDir, skillName, target.claudeDir);
    }

    spinner.succeed(`已添加 skill: ${skillName} → ${formatDestinations(targetDirs, `skills/${skillName}/`)}`);
    afterAddTargets(isGlobal, targetDirs);
  } catch (error) {
    if (
      error.name === 'CancelError' ||
      error.name === 'ExitPromptError' ||
      error.message?.includes('SIGINT') ||
      error.message?.includes('cancel') ||
      error.message?.includes('取消') ||
      error.message?.includes('操作已取消')
    ) {
      spinner.stop();
      log.info('操作已取消');
      process.exit(0);
    }

    spinner.fail(`添加失败: ${error.message}`);

    try {
      const { sourcePath } = await resolveSource(origin);
      listAvailableSkills(readSkillList(sourcePath));
    } catch {
      // Ignore follow-up listing failures after the main error is already reported.
    }

    process.exit(1);
  }
}
