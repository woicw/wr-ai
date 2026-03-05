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

test('getLocalConfigPath - 返回项目本地配置路径', async (t) => {
  const { getLocalConfigPath } = await import('../../src/lib/config.js');
  const result = getLocalConfigPath('/test/project');
  assert.strictEqual(result, path.join('/test/project', '.wr-ai', 'config.json'));
});

test('saveLastSelection + getLastSelection - 全局配置往返', async (t) => {
  const { saveLastSelection, getLastSelection } = await import('../../src/lib/config.js');
  const tempDir = createTempDir();

  try {
    const selection = {
      commands: ['commit', 'review'],
      skills: ['code-review'],
      agents: [],
      hooks: [],
      mcpServers: ['plugin-db'],
      lspServices: [],
    };

    saveLastSelection(selection, true, tempDir);

    const configPath = path.join(tempDir, '.wr-ai', 'config.json');
    assert.strictEqual(fs.existsSync(configPath), true);

    const result = getLastSelection(true, tempDir);
    assert.deepStrictEqual(result.commands, ['commit', 'review']);
    assert.deepStrictEqual(result.skills, ['code-review']);
    assert.deepStrictEqual(result.mcpServers, ['plugin-db']);
    assert.ok(result.timestamp);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('saveLastSelection + getLastSelection - 本地配置往返', async (t) => {
  const { saveLastSelection, getLastSelection } = await import('../../src/lib/config.js');
  const tempDir = createTempDir();

  try {
    const selection = {
      commands: ['deploy'],
      skills: ['frontend-design'],
      agents: ['test-runner'],
      hooks: [],
      mcpServers: [],
      lspServices: ['typescript'],
    };

    saveLastSelection(selection, false, tempDir);

    const configPath = path.join(tempDir, '.wr-ai', 'config.json');
    assert.strictEqual(fs.existsSync(configPath), true);

    const result = getLastSelection(false, tempDir);
    assert.deepStrictEqual(result.commands, ['deploy']);
    assert.deepStrictEqual(result.agents, ['test-runner']);
    assert.deepStrictEqual(result.lspServices, ['typescript']);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('getLastSelection - 无配置文件时返回 null', async (t) => {
  const { getLastSelection } = await import('../../src/lib/config.js');
  const tempDir = createTempDir();

  try {
    const result = getLastSelection(false, tempDir);
    assert.strictEqual(result, null);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('saveLastSelection - 保留已有配置字段', async (t) => {
  const { saveLastSelection } = await import('../../src/lib/config.js');
  const tempDir = createTempDir();

  try {
    const configDir = path.join(tempDir, '.wr-ai');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ origin: 'https://github.com/test/repo.git', platform: 'claude' }, null, 2)
    );

    saveLastSelection({ commands: ['x'], skills: [], agents: [], hooks: [], mcpServers: [], lspServices: [] }, true, tempDir);

    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8'));
    assert.strictEqual(config.origin, 'https://github.com/test/repo.git');
    assert.strictEqual(config.platform, 'claude');
    assert.deepStrictEqual(config.lastSelection.commands, ['x']);
  } finally {
    cleanupTempDir(tempDir);
  }
});
