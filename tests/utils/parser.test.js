import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readSkillList } from '../../src/utils/parser.js';

function createTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-parser-'));
  fs.mkdirSync(path.join(root, 'skills', 'code-review'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills', 'nextjs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'commands'), { recursive: true });
  fs.writeFileSync(path.join(root, 'commands', 'review.md'), '# review');
  fs.writeFileSync(path.join(root, '.mcp.json'), '{}');
  return root;
}

test('readSkillList - 只返回 skills 目录名', () => {
  const root = createTempRepo();
  try {
    assert.deepStrictEqual(readSkillList(root), ['code-review', 'nextjs']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('readSkillList - 缺少 skills 目录时返回空数组', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-parser-empty-'));
  try {
    assert.deepStrictEqual(readSkillList(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
