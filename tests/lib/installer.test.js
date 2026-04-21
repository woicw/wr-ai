import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveSkillSource, ensureRemoteInCache, assertNpxAvailable } from '../../src/lib/installer.js';

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

test('ensureRemoteInCache - skips npx when cache already populated', async () => {
  const cacheDir = scratch('wrs-cache-hit-');
  const existing = path.join(cacheDir, 'skills', 'vite');
  fs.mkdirSync(existing, { recursive: true });
  fs.writeFileSync(path.join(existing, 'SKILL.md'), '# vite');
  let called = false;
  try {
    await ensureRemoteInCache(
      { isLocal: false, name: 'vite', skillId: 'vite', repoUrl: 'https://github.com/antfu/skills' },
      { cacheDir, refresh: false, runNpxSkillsAdd: async () => { called = true; } }
    );
    assert.strictEqual(called, false);
    assert.strictEqual(fs.existsSync(path.join(existing, 'SKILL.md')), true);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('ensureRemoteInCache - invokes npx when cache missing', async () => {
  const cacheDir = scratch('wrs-cache-miss-');
  const calls = [];
  try {
    await ensureRemoteInCache(
      { isLocal: false, name: 'vite', skillId: 'vite', repoUrl: 'https://github.com/antfu/skills' },
      {
        cacheDir,
        refresh: false,
        runNpxSkillsAdd: async ({ stageDir, skillId, repoUrl }) => {
          calls.push({ stageDir, skillId, repoUrl });
          // Simulate npx output landing under stage/.claude/skills/<id>/
          const fake = path.join(stageDir, '.claude', 'skills', skillId);
          fs.mkdirSync(fake, { recursive: true });
          fs.writeFileSync(path.join(fake, 'SKILL.md'), '# vite upstream');
        },
      }
    );
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].repoUrl, 'https://github.com/antfu/skills');
    assert.strictEqual(
      fs.readFileSync(path.join(cacheDir, 'skills', 'vite', 'SKILL.md'), 'utf-8'),
      '# vite upstream'
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('ensureRemoteInCache - refresh=true rebuilds even when cache present', async () => {
  const cacheDir = scratch('wrs-cache-refresh-');
  const existing = path.join(cacheDir, 'skills', 'vite');
  fs.mkdirSync(existing, { recursive: true });
  fs.writeFileSync(path.join(existing, 'SKILL.md'), '# stale');
  try {
    await ensureRemoteInCache(
      { isLocal: false, name: 'vite', skillId: 'vite', repoUrl: 'https://github.com/antfu/skills' },
      {
        cacheDir,
        refresh: true,
        runNpxSkillsAdd: async ({ stageDir, skillId }) => {
          const fake = path.join(stageDir, '.claude', 'skills', skillId);
          fs.mkdirSync(fake, { recursive: true });
          fs.writeFileSync(path.join(fake, 'SKILL.md'), '# fresh');
        },
      }
    );
    assert.strictEqual(
      fs.readFileSync(path.join(cacheDir, 'skills', 'vite', 'SKILL.md'), 'utf-8'),
      '# fresh'
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('ensureRemoteInCache - accepts produced dir that differs from skillId', async () => {
  const cacheDir = scratch('wrs-cache-rename-');
  try {
    await ensureRemoteInCache(
      { isLocal: false, name: 'react:components', skillId: 'react:components', repoUrl: 'https://github.com/x/y' },
      {
        cacheDir,
        refresh: false,
        runNpxSkillsAdd: async ({ stageDir }) => {
          // Simulate npx writing to a sanitized name that differs from skillId.
          const fake = path.join(stageDir, '.claude', 'skills', 'react-components');
          fs.mkdirSync(fake, { recursive: true });
          fs.writeFileSync(path.join(fake, 'SKILL.md'), '# renamed');
        },
      }
    );
    assert.strictEqual(
      fs.readFileSync(path.join(cacheDir, 'skills', 'react:components', 'SKILL.md'), 'utf-8'),
      '# renamed'
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('ensureRemoteInCache - cleans stage when runner rejects', async () => {
  const cacheDir = scratch('wrs-cache-fail-');
  const stageDir = path.join(cacheDir, 'stage');
  try {
    await assert.rejects(
      () =>
        ensureRemoteInCache(
          { isLocal: false, name: 'x', skillId: 'x', repoUrl: 'https://github.com/x/y' },
          { cacheDir, runNpxSkillsAdd: async () => { throw new Error('boom'); } }
        ),
      /boom/
    );
    assert.strictEqual(fs.existsSync(stageDir), false);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('assertNpxAvailable - does not throw when npx is present on PATH', () => {
  // On CI and dev machines Node ships with npx, so this should succeed.
  assertNpxAvailable();
});
