import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
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

async function defaultRunNpxSkillsAdd({ stageDir, repoUrl, skillId, agent = 'claude-code' }) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['skills', 'add', repoUrl, '--skill', skillId, '--agent', agent, '--copy', '-y'],
      { cwd: stageDir, stdio: 'inherit' }
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npx skills add failed with exit code ${code}`));
    });
  });
}

export async function ensureRemoteInCache(entry, options) {
  const {
    cacheDir,
    refresh = false,
    runNpxSkillsAdd = defaultRunNpxSkillsAdd,
    agent = 'claude-code',
  } = options;

  const targetName = entry.installName ?? entry.name;
  const cachePath = path.join(cacheDir, 'skills', targetName);
  const stageDir = path.join(cacheDir, 'stage');

  if (fs.existsSync(cachePath) && !refresh) return cachePath;
  if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true });

  // Scrub stage before use to avoid cross-skill leftovers
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  await runNpxSkillsAdd({ stageDir, repoUrl: entry.repoUrl, skillId: entry.skillId, agent });

  const produced = path.join(stageDir, '.claude', 'skills', entry.skillId);
  if (!fs.existsSync(produced)) {
    throw new Error(`npx skills add did not produce expected dir: ${produced}`);
  }

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.renameSync(produced, cachePath);
  fs.rmSync(stageDir, { recursive: true, force: true });

  return cachePath;
}
