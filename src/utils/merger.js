import fs from 'node:fs';
import path from 'node:path';
import { copyFileOrDir } from '../lib/filesystem.js';

export function syncSkillDirectory(skillsDir, name, claudeDir) {
  const srcPath = path.join(skillsDir, name);
  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory()) {
    throw new Error(`未找到 skill: ${name}`);
  }

  const skillsTargetDir = path.join(claudeDir, 'skills');
  const destPath = path.join(skillsTargetDir, name);
  const exists = fs.existsSync(destPath);

  fs.mkdirSync(skillsTargetDir, { recursive: true });
  if (exists) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }
  copyFileOrDir(srcPath, destPath);

  return exists ? 'updated' : 'added';
}
