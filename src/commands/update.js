import { getOrigin } from '../config.js';
import { cloneOrUpdateRepo, getRepoDir } from '../github.js';
import { copyFileOrDir, ensureClaudeDir, updateGitignore } from '../fileOps.js';
import { select, multiselect, log } from '@clack/prompts';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import * as c from 'yoctocolors';

// 需要排除的文件/文件夹
const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
// 默认配置来源
const DEFAULT_SOURCE = 'awesome-claude';

export async function handleUpdate() {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在更新配置...').start();

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
      const result = await select({
        message: '请选择配置来源:',
        options: items.map((name) => ({ value: name, label: `📁 ${name}/` })),
      });

      if (typeof result === 'symbol') {
        log.info('已取消');
        process.exit(0);
      }
      sourceDir = result;
    }

    const sourcePath = path.join(repoDir, sourceDir);
    const commandsDir = path.join(sourcePath, 'commands');
    const skillsDir = path.join(sourcePath, 'skills');

    // 获取 commands 列表
    const commands = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))
      : [];

    // 获取 skills 列表
    const skills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
      : [];

    if (commands.length === 0 && skills.length === 0) {
      log.warn('配置目录为空');
      process.exit(0);
    }

    // 构建选项：分组显示
    const options = [
      { value: '__all__', label: c.bold(c.magenta('⚡ ALL - 更新所有配置')), hint: c.dim('替换全部 commands 和 skills') },
    ];

    if (commands.length > 0) {
      options.push({ value: '__all_commands__', label: c.cyan('🔧 ALL Commands'), hint: c.dim(`全部 ${commands.length} 个`) });
      commands.forEach((cmd) => {
        options.push({ value: `cmd:${cmd}`, label: c.yellow(`   ○ ${cmd}`) });
      });
    }

    if (skills.length > 0) {
      options.push({ value: '__all_skills__', label: c.cyan('🧠 ALL Skills'), hint: c.dim(`全部 ${skills.length} 个`) });
      skills.forEach((skill) => {
        options.push({ value: `skill:${skill}`, label: c.green(`   ○ ${skill}`) });
      });
    }

    // 循环选择
    let selected = [];
    while (true) {
      const result = await multiselect({
        message: '请选择要更新的配置（空格选择，回车确认）:',
        options,
        required: false,
      });

      if (typeof result === 'symbol') {
        log.info('已取消');
        process.exit(0);
      }

      selected = result;

      if (selected.length > 0) break;

      const action = await select({
        message: '未选择任何项，请选择操作:',
        options: [
          { value: 'retry', label: '🔄 重新选择' },
          { value: 'cancel', label: '❌ 取消' },
        ],
      });

      if (typeof action === 'symbol' || action === 'cancel') {
        log.info('已取消');
        process.exit(0);
      }
    }

    const cwd = process.cwd();
    const claudeDir = ensureClaudeDir(cwd);

    // 解析选择结果
    const updateAll = selected.includes('__all__');
    const updateAllCommands = updateAll || selected.includes('__all_commands__');
    const updateAllSkills = updateAll || selected.includes('__all_skills__');

    // 二次确认：如果选择 all/all commands/all skills，且本地已有文件，提示合并操作
    if (updateAll || updateAllCommands || updateAllSkills) {
      const localCommandsDir = path.join(claudeDir, 'commands');
      const localSkillsDir = path.join(claudeDir, 'skills');
      const hasLocalCommands = fs.existsSync(localCommandsDir) && fs.readdirSync(localCommandsDir).length > 0;
      const hasLocalSkills = fs.existsSync(localSkillsDir) && fs.readdirSync(localSkillsDir).length > 0;

      let needConfirm = false;
      let confirmMessage = '';

      if (updateAll && (hasLocalCommands || hasLocalSkills)) {
        needConfirm = true;
        confirmMessage = '此操作将合并远程配置到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
      } else if (updateAllCommands && hasLocalCommands) {
        needConfirm = true;
        confirmMessage = '此操作将合并远程 commands 到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
      } else if (updateAllSkills && hasLocalSkills) {
        needConfirm = true;
        confirmMessage = '此操作将合并远程 skills 到本地（已存在的文件会被覆盖，本地独有的文件会保留），是否继续？';
      }

      if (needConfirm) {
        const confirmResult = await select({
          message: confirmMessage,
          options: [
            { value: 'yes', label: '✅ 确认继续' },
            { value: 'no', label: '❌ 取消' },
          ],
        });

        if (typeof confirmResult === 'symbol' || confirmResult === 'no') {
          log.info('已取消');
          process.exit(0);
        }
      }
    }

    const updateSpinner = ora('正在合并到 .claude/...').start();

    const selectedCommands = updateAllCommands
      ? commands
      : selected.filter((s) => s.startsWith('cmd:')).map((s) => s.replace('cmd:', ''));

    const selectedSkills = updateAllSkills
      ? skills
      : selected.filter((s) => s.startsWith('skill:')).map((s) => s.replace('skill:', ''));

    const updatedItems = [];
    const addedItems = [];

    // 合并 commands
    if (selectedCommands.length > 0) {
      const destDir = path.join(claudeDir, 'commands');
      fs.mkdirSync(destDir, { recursive: true });
      for (const cmd of selectedCommands) {
        const srcPath = path.join(commandsDir, `${cmd}.md`);
        const destPath = path.join(destDir, `${cmd}.md`);
        const exists = fs.existsSync(destPath);
        fs.copyFileSync(srcPath, destPath);
        if (exists) {
          updatedItems.push(`commands/${cmd}.md`);
        } else {
          addedItems.push(`commands/${cmd}.md`);
        }
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
        copyFileOrDir(srcPath, destPath);
        if (exists) {
          updatedItems.push(`skills/${skill}/`);
        } else {
          addedItems.push(`skills/${skill}/`);
        }
      }
    }

    // 输出结果
    const totalItems = updatedItems.length + addedItems.length;
    let successMsg = `已合并 ${totalItems} 个项目:\n`;
    if (addedItems.length > 0) {
      successMsg += c.green(`  新增: ${addedItems.length} 个\n`);
    }
    if (updatedItems.length > 0) {
      successMsg += c.yellow(`  更新: ${updatedItems.length} 个\n`);
    }
    const allItems = [...addedItems, ...updatedItems];
    if (allItems.length <= 10) {
      successMsg += allItems.map((f) => `  • ${f}`).join('\n');
    } else {
      successMsg += allItems.slice(0, 10).map((f) => `  • ${f}`).join('\n');
      successMsg += `\n  ... 还有 ${allItems.length - 10} 个`;
    }
    updateSpinner.succeed(successMsg);

    // 更新 .gitignore
    if (updateGitignore(cwd)) {
      log.info('已添加 .claude 到 .gitignore');
    }
  } catch (error) {
    spinner.fail(`更新失败: ${error.message}`);
    process.exit(1);
  }
}
