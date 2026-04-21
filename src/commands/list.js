import { getOrigin } from '../lib/config.js';
import { resolveSource } from '../lib/source.js';
import * as c from 'yoctocolors';
import ora from 'ora';
import { log } from '../utils/logger.js';
import { readManifestEntries } from '../utils/parser.js';
import { classifyBySource } from '../lib/manifest.js';
import { handleCancelError } from '../utils/error-handler.js';

export function formatManifestListOutput(sourceDir, entries) {
  const { local, remote } = classifyBySource(entries);
  const lines = [
    c.bold(`📦 ${sourceDir}`),
    '',
    c.bold(c.green(`Local (${local.length})`)),
  ];
  if (local.length === 0) {
    lines.push(c.dim('  (none)'));
  } else {
    local.forEach((entry, idx) => {
      const prefix = idx === local.length - 1 ? '└─' : '├─';
      lines.push(`${prefix} ${c.green(entry.name)}`);
    });
  }
  lines.push('', c.bold(c.cyan(`Remote (${remote.length})`)));
  if (remote.length === 0) {
    lines.push(c.dim('  (none)'));
  } else {
    remote.forEach((entry, idx) => {
      const prefix = idx === remote.length - 1 ? '└─' : '├─';
      lines.push(`${prefix} ${c.cyan(entry.name)}  ${c.dim(`← ${entry.source}`)}`);
    });
  }
  lines.push(
    '',
    '  使用方式:',
    '    wrs add <name>            添加指定技能',
    '    wrs list                  列出可用技能',
    ''
  );
  return lines.join('\n');
}

export async function handleList() {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wrs set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在获取技能列表...').start();

  try {
    const { sourceDir, repoDir } = await resolveSource(origin, spinner);
    const entries = readManifestEntries(repoDir);

    if (entries.length === 0) {
      log.info('manifest 为空');
      return;
    }

    console.log();
    console.log(formatManifestListOutput(sourceDir, entries));
  } catch (error) {
    handleCancelError(error, spinner);
    spinner.fail(`获取技能列表失败: ${error.message}`);
    process.exit(1);
  }
}
