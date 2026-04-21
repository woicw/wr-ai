import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncSkillDirectoryFromPath } from '../../src/utils/merger.js';

test('syncSkillDirectoryFromPath - copies a source dir into <claudeDir>/skills/<name>', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-merger-src-'));
  fs.writeFileSync(path.join(src, 'SKILL.md'), '# test');
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-merger-dst-'));
  try {
    const status = syncSkillDirectoryFromPath(src, 'vite', claudeDir);
    assert.strictEqual(status, 'added');
    assert.strictEqual(
      fs.readFileSync(path.join(claudeDir, 'skills', 'vite', 'SKILL.md'), 'utf-8'),
      '# test'
    );
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(claudeDir, { recursive: true, force: true });
  }
});

test('syncSkillDirectoryFromPath - returns updated when dest already exists', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-merger-src2-'));
  fs.writeFileSync(path.join(src, 'SKILL.md'), '# v2');
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-merger-dst2-'));
  const pre = path.join(claudeDir, 'skills', 'vite');
  fs.mkdirSync(pre, { recursive: true });
  fs.writeFileSync(path.join(pre, 'SKILL.md'), '# v1');
  try {
    const status = syncSkillDirectoryFromPath(src, 'vite', claudeDir);
    assert.strictEqual(status, 'updated');
    assert.strictEqual(
      fs.readFileSync(path.join(pre, 'SKILL.md'), 'utf-8'),
      '# v2'
    );
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(claudeDir, { recursive: true, force: true });
  }
});
