import fs from 'node:fs';
import path from 'node:path';
import { copyFileOrDir } from '../lib/filesystem.js';

export function syncSkillDirectoryFromPath(sourceDir, targetName, claudeDir) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`source skill dir missing: ${sourceDir}`);
  }
  const skillsTargetDir = path.join(claudeDir, 'skills');
  const destPath = path.join(skillsTargetDir, targetName);
  const exists = fs.existsSync(destPath);
  fs.mkdirSync(skillsTargetDir, { recursive: true });
  if (exists) fs.rmSync(destPath, { recursive: true, force: true });
  copyFileOrDir(sourceDir, destPath);
  return exists ? 'updated' : 'added';
}
