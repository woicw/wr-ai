import { getOrigin } from '../config.js';
import { cloneOrUpdateRepo, getTemplatesDir } from '../github.js';
import { copyDirectory, ensureClaudeDir, listFilesRecursive, copyFileOrDir } from '../fileOps.js';
import { select, multiselect, log } from '@clack/prompts';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

export async function handleUpdate() {
  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set origin <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在更新模板...').start();

  try {
    // 克隆或更新仓库
    await cloneOrUpdateRepo(origin);

    // 获取模板目录
    const templatesDir = getTemplatesDir(origin);

    // 读取所有模板
    const templates = fs.readdirSync(templatesDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name);

    if (templates.length === 0) {
      spinner.fail('未找到任何模板');
      process.exit(1);
    }

    spinner.stop();

    // 让用户选择模板
    const templateResult = await select({
      message: '请选择要更新的模板:',
      options: templates.map((template) => ({
        value: template,
        label: template,
      })),
    });

    if (typeof templateResult === 'symbol') {
      log.info('已取消');
      process.exit(0);
    }

    const selectedTemplate = templateResult;
    const templatePath = path.join(templatesDir, selectedTemplate);

    // 列出模板下的所有文件
    const files = listFilesRecursive(templatePath);

    if (files.length === 0) {
      log.warn('模板目录为空');
      process.exit(0);
    }

    // 准备文件选项（添加 all 选项）
    const fileOptions = [
      {
        value: '__all__',
        label: '✨ ALL - 更新所有文件',
        hint: '将替换整个 .claude 文件夹',
      },
      ...files.map((file) => {
        const filePath = path.join(templatePath, file);
        const isDir = fs.statSync(filePath).isDirectory();
        return {
          value: file,
          label: isDir ? `📁 ${file}/` : `📄 ${file}`,
        };
      }),
    ];

    // 循环选择文件，直到用户选择文件或取消
    let selectedFiles = [];
    while (true) {
      // 让用户多选文件
      const result = await multiselect({
        message: '请选择要更新的文件（空格键选择，回车确认）',
        options: fileOptions,
        required: false,
      });

      if (typeof result === 'symbol') {
        log.info('已取消');
        process.exit(0);
      }

      selectedFiles = result;

      // 如果选择了文件，退出循环
      if (selectedFiles.length > 0) {
        break;
      }

      // 未选择文件时，弹出操作提示
      const action = await select({
        message: '未选择任何文件，请选择操作:',
        options: [
          { value: 'retry', label: '🔄 重新选择文件' },
          { value: 'cancel', label: '❌ 取消更新' },
        ],
      });

      if (typeof action === 'symbol' || action === 'cancel') {
        log.info('已取消更新');
        process.exit(0);
      }
      // 如果选择重新选择，继续循环
    }

    const claudeDir = ensureClaudeDir();
    const updateSpinner = ora('正在更新文件...').start();

    // 检查是否选择了 all
    if (selectedFiles.includes('__all__')) {
      // 清空 .claude 目录
      if (fs.existsSync(claudeDir)) {
        fs.rmSync(claudeDir, { recursive: true, force: true });
      }
      // 复制整个模板
      copyDirectory(templatePath, claudeDir);
      updateSpinner.succeed('所有文件已更新');
    } else {
      // 记录更新的文件列表
      const updatedFiles = [];

      // 只更新选中的文件
      for (const file of selectedFiles) {
        const srcPath = path.join(templatePath, file);
        const destPath = path.join(claudeDir, file);
        const isDir = fs.statSync(srcPath).isDirectory();
        copyFileOrDir(srcPath, destPath);
        updatedFiles.push(isDir ? `${file}/` : file);
      }

      // 格式化文件列表显示
      let successMessage = `已更新 ${selectedFiles.length} 个文件/文件夹:\n`;
      if (updatedFiles.length <= 10) {
        // 如果文件不多，全部显示
        successMessage += updatedFiles.map(f => `  • ${f}`).join('\n');
      } else {
        // 如果文件太多，只显示前10个，其余用省略号
        successMessage += updatedFiles.slice(0, 10).map(f => `  • ${f}`).join('\n');
        successMessage += `\n  ... 还有 ${updatedFiles.length - 10} 个文件`;
      }

      updateSpinner.succeed(successMessage);
    }
  } catch (error) {
    spinner.fail(`更新失败: ${error.message}`);
    process.exit(1);
  }
}