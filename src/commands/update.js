import { getOrigin } from '../config.js';
import { cloneOrUpdateRepo } from '../github.js';
import * as c from '@clack/prompts';
import ora from 'ora';

export async function handleUpdate() {
  const origin = getOrigin();
  if (!origin) {
    c.log.error('请先使用 "wr-ai set origin <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在更新模板...').start();

  try {
    await cloneOrUpdateRepo(origin);
    spinner.succeed('模板更新成功');
  } catch (error) {
    spinner.fail(`更新失败: ${error.message}`);
    process.exit(1);
  }
}