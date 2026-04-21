import fs from 'node:fs';
import { CACHE_DIR } from '../utils/constants.js';
import { log } from '../utils/logger.js';

export function cleanCacheDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function handleCacheClean() {
  cleanCacheDir(CACHE_DIR);
  log.info(`已清空缓存: ${CACHE_DIR}`);
}
