import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncSkillDirectory } from '../../src/utils/merger.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-merger-test-'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test('syncSkillDirectory - adds a new skill directory', () => {
  const tempDir = createTempDir();
  const skillsDir = path.join(tempDir, 'remote', 'skills');
  const claudeDir = path.join(tempDir, 'project', '.claude');

  try {
    writeFile(path.join(skillsDir, 'code-review', 'SKILL.md'), '# remote\n');

    const result = syncSkillDirectory(skillsDir, 'code-review', claudeDir);

    assert.strictEqual(result, 'added');
    assert.strictEqual(
      fs.readFileSync(path.join(claudeDir, 'skills', 'code-review', 'SKILL.md'), 'utf8'),
      '# remote\n'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('syncSkillDirectory - replaces the whole local directory for a same-name skill', () => {
  const tempDir = createTempDir();
  const skillsDir = path.join(tempDir, 'remote', 'skills');
  const claudeDir = path.join(tempDir, 'project', '.claude');

  try {
    writeFile(path.join(skillsDir, 'code-review', 'SKILL.md'), '# remote new\n');
    writeFile(path.join(skillsDir, 'code-review', 'notes.txt'), 'remote notes\n');

    writeFile(path.join(claudeDir, 'skills', 'code-review', 'SKILL.md'), '# local old\n');
    writeFile(path.join(claudeDir, 'skills', 'code-review', 'local-only.txt'), 'keep me\n');

    const result = syncSkillDirectory(skillsDir, 'code-review', claudeDir);

    assert.strictEqual(result, 'updated');
    assert.strictEqual(
      fs.readFileSync(path.join(claudeDir, 'skills', 'code-review', 'SKILL.md'), 'utf8'),
      '# remote new\n'
    );
    assert.strictEqual(
      fs.readFileSync(path.join(claudeDir, 'skills', 'code-review', 'notes.txt'), 'utf8'),
      'remote notes\n'
    );
    assert.strictEqual(
      fs.existsSync(path.join(claudeDir, 'skills', 'code-review', 'local-only.txt')),
      false
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
