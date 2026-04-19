import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `wr-ai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('getLocalConfigPath - 返回项目本地配置路径', async () => {
  const { getLocalConfigPath } = await import('../../src/lib/config.js');
  const result = getLocalConfigPath('/test/project');
  assert.strictEqual(result, path.join('/test/project', '.wrs', 'config.json'));
});

test('saveLastSelection + getLastSelection - 全局配置往返', async () => {
  const { saveLastSelection, getLastSelection } = await import('../../src/lib/config.js');
  const tempDir = createTempDir();

  try {
    saveLastSelection({ skills: ['code-review', 'nextjs'] }, true, tempDir);
    const configPath = path.join(tempDir, '.wrs', 'config.json');
    assert.strictEqual(fs.existsSync(configPath), true);

    const result = getLastSelection(true, tempDir);
    assert.deepStrictEqual(result.skills, ['code-review', 'nextjs']);
    assert.ok(result.timestamp);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('saveLastSelection - 保留已有 origin/platform 字段', async () => {
  const { saveLastSelection } = await import('../../src/lib/config.js');
  const tempDir = createTempDir();

  try {
    const configDir = path.join(tempDir, '.wrs');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ origin: 'https://github.com/test/repo.git', platform: 'claude' }, null, 2)
    );

    saveLastSelection({ skills: ['code-review'] }, true, tempDir);

    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8'));
    assert.strictEqual(config.origin, 'https://github.com/test/repo.git');
    assert.strictEqual(config.platform, 'claude');
    assert.deepStrictEqual(config.lastSelection.skills, ['code-review']);
  } finally {
    cleanupTempDir(tempDir);
  }
});
