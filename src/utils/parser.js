import fs from 'fs';
import path from 'path';
import { loadManifest } from '../lib/manifest.js';

/**
 * 读取配置源中的技能目录列表
 * @param {string} sourcePath - 配置源目录路径
 * @returns {string[]} 已排序的技能目录名数组
 */
export function readSkillList(sourcePath) {
  const skillsDir = path.join(sourcePath, 'skills');

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function readManifestEntries(sourcePath) {
  return loadManifest(sourcePath);
}
