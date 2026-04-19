import { getOrigin } from '../lib/config.js';
import { resolveSource } from '../lib/source.js';
import * as c from 'yoctocolors';
import ora from 'ora';
import { log } from '../utils/logger.js';
import { readSkillList } from '../utils/parser.js';
import { handleCancelError } from '../utils/error-handler.js';

export function formatSkillListOutput(sourceDir, skills) {
  const lines = [
    c.bold(`📦 ${sourceDir}`),
    '',
    c.bold(c.green(`🧠 Skills (${skills.length})`)),
    '',
  ];

  if (skills.length === 0) {
    lines.push(c.dim('暂无可用技能'));
  } else {
    skills.forEach((skill, index) => {
      const prefix = index === skills.length - 1 ? '└─' : '├─';
      lines.push(`${prefix} ${c.green(skill)}`);
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
    const { sourceDir, sourcePath } = await resolveSource(origin, spinner);
    const skills = readSkillList(sourcePath);

    if (skills.length === 0) {
      log.info('skills 目录为空');
      return;
    }

    console.log();
    console.log(formatSkillListOutput(sourceDir, skills));
  } catch (error) {
    handleCancelError(error, spinner);
    spinner.fail(`获取技能列表失败: ${error.message}`);
    process.exit(1);
  }
}
