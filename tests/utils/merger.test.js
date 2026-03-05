import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { mergeMcpConfig, mergeLspConfig } from '../../src/utils/merger.js';

// 创建临时测试目录
function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `wr-ai-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

// 清理临时目录
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('mergeMcpConfig - 创建新的 MCP 配置文件', () => {
  const tempDir = createTempDir();
  const srcDir = path.join(tempDir, 'src');
  const destDir = path.join(tempDir, 'dest');

  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  // 创建源配置文件
  const mcpFile = path.join(srcDir, '.mcp.json');
  const sourceConfig = {
    mcpServers: {
      'test-server': {
        command: 'node',
        args: ['server.js']
      }
    }
  };
  fs.writeFileSync(mcpFile, JSON.stringify(sourceConfig, null, 2));

  // 执行合并
  const result = mergeMcpConfig(mcpFile, destDir, [], true, srcDir);

  // 验证结果
  assert.strictEqual(result, 'added');

  const destFile = path.join(destDir, '.mcp.json');
  assert.strictEqual(fs.existsSync(destFile), true);

  const mergedConfig = JSON.parse(fs.readFileSync(destFile, 'utf8'));
  assert.deepStrictEqual(mergedConfig.mcpServers['test-server'], sourceConfig.mcpServers['test-server']);

  cleanupTempDir(tempDir);
});

test('mergeMcpConfig - 更新现有 MCP 配置并保留本地配置', () => {
  const tempDir = createTempDir();
  const srcDir = path.join(tempDir, 'src');
  const destDir = path.join(tempDir, 'dest');

  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  // 创建源配置文件
  const mcpFile = path.join(srcDir, '.mcp.json');
  const sourceConfig = {
    mcpServers: {
      'remote-server': {
        command: 'node',
        args: ['remote.js']
      }
    }
  };
  fs.writeFileSync(mcpFile, JSON.stringify(sourceConfig, null, 2));

  // 创建现有的目标配置文件（包含本地配置）
  const destFile = path.join(destDir, '.mcp.json');
  const existingConfig = {
    mcpServers: {
      'local-server': {
        command: 'node',
        args: ['local.js']
      }
    }
  };
  fs.writeFileSync(destFile, JSON.stringify(existingConfig, null, 2));

  // 执行合并
  const result = mergeMcpConfig(mcpFile, destDir, [], true, srcDir);

  // 验证结果
  assert.strictEqual(result, 'updated');

  const mergedConfig = JSON.parse(fs.readFileSync(destFile, 'utf8'));

  // 应该同时包含本地和远程配置
  assert.ok(mergedConfig.mcpServers['local-server']);
  assert.ok(mergedConfig.mcpServers['remote-server']);

  cleanupTempDir(tempDir);
});

test('mergeLspConfig - 创建新的 LSP 配置文件', () => {
  const tempDir = createTempDir();
  const srcDir = path.join(tempDir, 'src');
  const destDir = path.join(tempDir, 'dest');

  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  // 创建源配置文件
  const lspFile = path.join(srcDir, '.lsp.json');
  const sourceConfig = {
    'typescript': {
      command: 'typescript-language-server',
      args: ['--stdio']
    }
  };
  fs.writeFileSync(lspFile, JSON.stringify(sourceConfig, null, 2));

  // 执行合并
  const result = mergeLspConfig(lspFile, destDir, [], true, srcDir);

  // 验证结果
  assert.strictEqual(result, 'added');

  const destFile = path.join(destDir, '.lsp.json');
  assert.strictEqual(fs.existsSync(destFile), true);

  const mergedConfig = JSON.parse(fs.readFileSync(destFile, 'utf8'));
  assert.deepStrictEqual(mergedConfig['typescript'], sourceConfig['typescript']);

  cleanupTempDir(tempDir);
});
