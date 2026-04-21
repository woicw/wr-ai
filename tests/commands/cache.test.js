import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cleanCacheDir } from '../../src/commands/cache.js';

test('cleanCacheDir - removes the cache directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-cache-clean-'));
  const nested = path.join(root, 'skills', 'vite');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'SKILL.md'), '# x');
  cleanCacheDir(root);
  assert.strictEqual(fs.existsSync(root), false);
});

test('cleanCacheDir - no-op when cache absent', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-cache-clean-miss-'));
  const missing = path.join(parent, 'does-not-exist');
  try {
    cleanCacheDir(missing);
    assert.strictEqual(fs.existsSync(missing), false);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
