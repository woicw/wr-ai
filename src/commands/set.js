import { setOrigin } from '../config.js';
import * as c from '@clack/prompts';

export async function handleSet(origin) {
  if (!origin) {
    c.log.error('请提供 GitHub 地址');
    process.exit(1);
  }

  try {
    setOrigin(origin);
    c.log.success(`已设置 GitHub 地址: ${origin}`);
  } catch (error) {
    c.log.error(`设置失败: ${error.message}`);
    process.exit(1);
  }
}