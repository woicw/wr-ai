import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveSkillSource } from '../../src/lib/installer.js';

function scratch(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('resolveSkillSource - returns local clone path for local entries', () => {
  const cloneRoot = scratch('wrs-clone-');
  const skillDir = path.join(cloneRoot, 'awesome-claude', 'skills', 'woic');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# woic');
  try {
    const resolved = resolveSkillSource({ isLocal: true, name: 'woic' }, { cloneRoot, cacheDir: '/unused' });
    assert.strictEqual(resolved, skillDir);
  } finally {
    fs.rmSync(cloneRoot, { recursive: true, force: true });
  }
});

test('resolveSkillSource - returns cache path for remote entries', () => {
  const cacheDir = scratch('wrs-cache-');
  try {
    const entry = { isLocal: false, name: 'vite', skillId: 'vite', installName: null };
    const resolved = resolveSkillSource(entry, { cloneRoot: '/unused', cacheDir });
    assert.strictEqual(resolved, path.join(cacheDir, 'skills', 'vite'));
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('resolveSkillSource - honors installName for remote entries', () => {
  const cacheDir = scratch('wrs-cache-');
  try {
    const entry = { isLocal: false, name: 'skill-creator-anthropics', skillId: 'skill-creator', installName: 'skill-creator-anthropics' };
    const resolved = resolveSkillSource(entry, { cloneRoot: '/unused', cacheDir });
    assert.strictEqual(resolved, path.join(cacheDir, 'skills', 'skill-creator-anthropics'));
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});
