import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setOrigin } from '../../src/lib/config.js';
import { TEMPLATES_DIR } from '../../src/utils/constants.js';
import { findSkillOrThrow, handleAdd } from '../../src/commands/add.js';

const CONFIG_PATH = path.join(os.homedir(), '.wrs', 'config.json');
const REPO_URL = 'https://github.com/test/wrs-add-skill';
const REPO_DIR = path.join(TEMPLATES_DIR, 'test_wrs-add-skill');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createBareRemote(rootDir) {
  const remoteDir = path.join(rootDir, 'remote.git');
  execFileSync('git', ['init', '--bare', remoteDir]);
  return remoteDir;
}

function seedCachedRepo(rootDir) {
  const workDir = path.join(rootDir, 'seed');
  const remoteDir = createBareRemote(rootDir);

  execFileSync('git', ['init', workDir]);
  execFileSync('git', ['config', 'user.name', 'Codex Test'], { cwd: workDir });
  execFileSync('git', ['config', 'user.email', 'codex@example.com'], { cwd: workDir });

  writeFile(path.join(workDir, 'awesome-claude', 'skills', 'code-review', 'SKILL.md'), '# code-review\n');
  writeFile(path.join(workDir, 'awesome-claude', 'skills', 'nextjs', 'SKILL.md'), '# nextjs\n');

  execFileSync('git', ['add', '.'], { cwd: workDir });
  execFileSync('git', ['commit', '-m', 'seed repo'], { cwd: workDir });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: workDir });
  execFileSync('git', ['remote', 'add', 'origin', remoteDir], { cwd: workDir });
  execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: workDir });

  fs.mkdirSync(path.dirname(REPO_DIR), { recursive: true });
  execFileSync('git', ['clone', remoteDir, REPO_DIR]);
}

let originalCwd;
let originalConfig;
let tempDir;

beforeEach(() => {
  originalCwd = process.cwd();
  originalConfig = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : null;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-add-test-'));
  process.chdir(tempDir);

  fs.rmSync(REPO_DIR, { recursive: true, force: true });
  seedCachedRepo(tempDir);
  setOrigin(REPO_URL);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(REPO_DIR, { recursive: true, force: true });

  if (originalConfig === null) {
    fs.rmSync(CONFIG_PATH, { force: true });
  } else {
    writeFile(CONFIG_PATH, originalConfig);
  }
});

test('findSkillOrThrow - throws a clear error when the skill is missing', () => {
  assert.throws(
    () => findSkillOrThrow(['code-review', 'nextjs'], 'missing-skill'),
    /未找到 skill: missing-skill/
  );
});

test('handleAdd - adds a single skill into the detected platform directory', async () => {
  writeFile(path.join(tempDir, '.gitignore'), '');

  await handleAdd('code-review');

  const installedSkill = path.join(tempDir, '.claude', 'skills', 'code-review', 'SKILL.md');
  assert.strictEqual(fs.existsSync(installedSkill), true);
  assert.match(fs.readFileSync(installedSkill, 'utf8'), /code-review/);

  const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf8');
  assert.match(gitignoreContent, /\.claude/);
});
