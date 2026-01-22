import { setOrigin } from '../config.js';
import * as c from 'yoctocolors';

// 简单的 log 函数替代
const log = {
  info: (msg) => console.log(c.cyan('ℹ'), msg),
  warn: (msg) => console.log(c.yellow('⚠'), msg),
  error: (msg) => console.log(c.red('✖'), msg),
  success: (msg) => console.log(c.green('✔'), msg),
};

export async function handleSet(origin) {
  if (!origin) {
    log.error('请提供 GitHub 地址');
    process.exit(1);
  }

  try {
    setOrigin(origin);
    log.success(`已设置 GitHub 地址: ${origin}`);
  } catch (error) {
    log.error(`设置失败: ${error.message}`);
    process.exit(1);
  }
}