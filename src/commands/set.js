import { setOrigin, setPlatform } from '../lib/config.js';
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

export async function handleSetPlatform(platform) {
  if (!platform) {
    log.error('请提供平台名称');
    process.exit(1);
  }

  // 验证平台名称（只允许字母、数字、连字符、下划线）
  if (!/^[a-zA-Z0-9_-]+$/.test(platform)) {
    log.error('平台名称只能包含字母、数字、连字符和下划线');
    process.exit(1);
  }

  try {
    setPlatform(platform);
    log.success(`已设置平台名称: ${platform}（将保存在 .${platform}/ 目录）`);
  } catch (error) {
    log.error(`设置失败: ${error.message}`);
    process.exit(1);
  }
}