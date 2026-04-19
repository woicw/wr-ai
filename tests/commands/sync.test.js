import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveLastSelection, getLastSelection } from '../../src/lib/config.js';
import { normalizePromptSelection, resolveSkillsToSync } from '../../src/commands/sync.js';

describe('sync command - skills history', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-sync-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should store only skills in local lastSelection', () => {
    saveLastSelection({ skills: ['code-review'] }, false, tempDir);
    const localSelection = getLastSelection(false, tempDir);
    assert.deepStrictEqual(localSelection.skills, ['code-review']);
    assert.strictEqual(Object.hasOwn(localSelection, 'commands'), false);
  });

  it('should store only skills in global lastSelection', () => {
    saveLastSelection({ skills: ['nextjs'] }, true, tempDir);
    const globalSelection = getLastSelection(true, tempDir);
    assert.deepStrictEqual(globalSelection.skills, ['nextjs']);
  });
});

it('resolveSkillsToSync - 只保留远程仍然存在的 skills', () => {
  assert.deepStrictEqual(
    resolveSkillsToSync({ skills: ['code-review', 'missing'] }, ['code-review', 'nextjs']),
    ['code-review']
  );
});

it('resolveSkillsToSync - 没有可同步项时返回空数组', () => {
  assert.deepStrictEqual(
    resolveSkillsToSync({ skills: ['missing'] }, ['code-review']),
    []
  );
});

it('normalizePromptSelection - 选择全部时展开为全部远程 skills', () => {
  assert.deepStrictEqual(
    normalizePromptSelection(['__all_skills__'], ['code-review', 'nextjs']),
    ['code-review', 'nextjs']
  );
});
