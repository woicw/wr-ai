import fs from 'node:fs';
import path from 'node:path';
import { CACHE_SKILLS_DIR } from '../utils/constants.js';

export function resolveSkillSource(entry, { cloneRoot, cacheDir }) {
  if (entry.isLocal) {
    return path.join(cloneRoot, 'awesome-claude', 'skills', entry.name);
  }
  const targetName = entry.installName ?? entry.name;
  return path.join(cacheDir, 'skills', targetName);
}

export function defaultCacheDir() {
  return path.dirname(CACHE_SKILLS_DIR);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
