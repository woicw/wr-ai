import fs from 'fs';
import path from 'path';
import { select } from '@inquirer/prompts';
import * as c from 'yoctocolors';
import { cloneOrUpdateRepo, getRepoDir } from './repository.js';
import { EXCLUDE_LIST, DEFAULT_SOURCE } from '../utils/constants.js';
import { log } from '../utils/logger.js';

/**
 * 从远程仓库获取并解析可用的配置源目录
 * @param {string} origin - Git 仓库 URL
 * @param {import('ora').Ora} [spinner] - 可选的 spinner 实例（会在交互前停止）
 * @returns {Promise<{repoDir: string, sourceDir: string, sourcePath: string, srcBaseDir: string}>}
 */
export async function resolveSource(origin, spinner) {
  await cloneOrUpdateRepo(origin);
  const repoDir = getRepoDir(origin);

  const items = fs.readdirSync(repoDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && !EXCLUDE_LIST.includes(item.name))
    .map((item) => item.name);

  if (items.length === 0) {
    if (spinner) spinner.fail('仓库中未找到可用配置');
    else log.error('仓库中未找到可用配置');
    process.exit(1);
  }

  if (spinner) spinner.stop();

  let sourceDir;
  if (items.includes(DEFAULT_SOURCE)) {
    sourceDir = DEFAULT_SOURCE;
  } else if (items.length === 1) {
    sourceDir = items[0];
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

  return { repoDir, sourceDir, sourcePath, srcBaseDir };
}
