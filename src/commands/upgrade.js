// src/commands/upgrade.js
import { execSync } from 'child_process';
import ora from 'ora';
import * as c from 'yoctocolors';
import { log } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function handleUpgrade() {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
  );
  const currentVersion = packageJson.version;

  const spinner = ora('正在检查更新...').start();

  try {
    // 查询 npm registry 获取最新版本
    const output = execSync('npm view wr-ai version', { encoding: 'utf-8', timeout: 10000 }).trim();
    const latestVersion = output;

    if (latestVersion === currentVersion) {
      spinner.succeed(`已是最新版本 ${c.green(currentVersion)}`);
      return;
    }

    spinner.info(`当前版本: ${c.yellow(currentVersion)}，最新版本: ${c.green(latestVersion)}`);
    log.info(`运行 ${c.cyan('npm install -g wr-ai')} 或 ${c.cyan('pnpm add -g wr-ai')} 更新`);
  } catch (error) {
    spinner.fail('检查更新失败，请确认网络连接');
  }
}
