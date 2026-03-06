// tests/commands/sync.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveLastSelection, getLastSelection } from '../../src/lib/config.js';

describe('sync command - lastSelection fallback', () => {
  let tempDir;
  let originalCwd;
  let globalConfigPath;
  let originalGlobalConfig;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-ai-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Backup global config
    globalConfigPath = path.join(os.homedir(), '.wr-ai', 'config.json');
    if (fs.existsSync(globalConfigPath)) {
      originalGlobalConfig = fs.readFileSync(globalConfigPath, 'utf-8');
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Restore global config
    if (originalGlobalConfig) {
      fs.writeFileSync(globalConfigPath, originalGlobalConfig);
    } else if (fs.existsSync(globalConfigPath)) {
      fs.rmSync(globalConfigPath, { force: true });
    }
  });

  it('should find global config when local does not exist', () => {
    // Save to global config
    const selection = {
      commands: ['test-cmd'],
      skills: [],
      agents: [],
      hooks: [],
      mcpServers: [],
      lspServices: [],
    };
    saveLastSelection(selection, true);

    // Try to get local config (should not exist)
    const localSelection = getLastSelection(false, tempDir);
    assert.strictEqual(localSelection, null);

    // Get global config (should exist)
    const globalSelection = getLastSelection(true);
    assert.ok(globalSelection);
    assert.deepStrictEqual(globalSelection.commands, ['test-cmd']);
  });

  it('should prefer local config over global when both exist', () => {
    // Save to global config
    saveLastSelection({
      commands: ['global-cmd'],
      skills: [],
      agents: [],
      hooks: [],
      mcpServers: [],
      lspServices: [],
    }, true);

    // Save to local config
    saveLastSelection({
      commands: ['local-cmd'],
      skills: [],
      agents: [],
      hooks: [],
      mcpServers: [],
      lspServices: [],
    }, false, tempDir);

    // Get local config (should return local, not global)
    const localSelection = getLastSelection(false, tempDir);
    assert.ok(localSelection);
    assert.deepStrictEqual(localSelection.commands, ['local-cmd']);
  });
});
