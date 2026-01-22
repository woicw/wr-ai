import { setOrigin } from '../lib/config.js';
import { log } from '../utils/logger.js';

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