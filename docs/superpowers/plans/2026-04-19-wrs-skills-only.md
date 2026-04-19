# WRS Skills-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a breaking major release that renames `wr-ai` to `wrs`, drops every sync type except `skills`, and stores configuration under `.wrs`.

**Architecture:** Keep the existing repository fetch and target-directory resolution pieces that still fit, but rebuild the CLI surface, config model, parser, and sync flow around a skills-only domain. Prefer deleting generic multi-type code over preserving abstractions that no longer match the product.

**Tech Stack:** Node.js, ESM modules, Commander, Inquirer, Ora, Node test runner

---

## File Structure

### Files to modify

- `package.json`
  - Rename the package and CLI binary to `wrs`
- `src/index.js`
  - Remove obsolete commands and register only `list`, `add`, `sync`, and `set github`
- `src/commands/set.js`
  - Remove `set platform`, keep only global GitHub origin updates, and switch messages to `wrs`
- `src/commands/list.js`
  - Make output skill-only and remove all type handling
- `src/commands/add.js`
  - Remove typed-name parsing, `@latest`, MCP/LSP handling, and non-skill listing
- `src/commands/sync.js`
  - Rebuild around `lastSelection.skills` with history-first behavior and interactive fallback
- `src/lib/config.js`
  - Move config paths from `.wr-ai` to `.wrs` and shrink stored selection data to `skills`
- `src/utils/parser.js`
  - Replace multi-type readers/parsers with a skill-only reader and skill-only selection handling
- `src/utils/merger.js`
  - Remove generic multi-type merge logic in favor of explicit skill sync helpers
- `src/utils/constants.js`
  - Remove type constants and rename `.wr-ai` constants to `.wrs` where still needed
- `README.md`
  - Rewrite documentation for the new `wrs` contract
- `tests/lib/config.test.js`
  - Rewrite for `.wrs` paths and skills-only selection storage
- `tests/commands/sync.test.js`
  - Rewrite around skills-only history behavior
- `tests/utils/merger.test.js`
  - Extend to lock down same-name skill merge behavior

### Files to create

- `tests/utils/parser.test.js`
  - Assert that only `skills/` is read and that non-skill repository content is ignored
- `tests/commands/list.test.js`
  - Assert skill-only list formatting and `wrs` help text expectations
- `tests/commands/add.test.js`
  - Assert single-skill add success and clear failure for missing skills

### Files to delete

- `src/commands/init.js`
- `src/commands/update.js`
- `src/commands/clear.js`
- `src/commands/reset.js`
- `src/commands/upgrade.js`
- `tests/commands/add-latest.test.js`

These files encode the removed product surface and should be deleted rather than partially preserved.

## Task 1: Lock Down the New Config Contract

**Files:**
- Modify: `src/lib/config.js`
- Modify: `tests/lib/config.test.js`

- [ ] **Step 1: Rewrite the config tests around `.wrs` and skills-only selection**

Replace the old test cases in `tests/lib/config.test.js` with these expectations:

```js
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
```

- [ ] **Step 2: Run the config tests and verify they fail on old `.wr-ai` behavior**

Run: `node --test tests/lib/config.test.js`

Expected: FAIL with assertions mentioning `.wr-ai` vs `.wrs` paths and unexpected legacy selection fields.

- [ ] **Step 3: Rewrite `src/lib/config.js` to use `.wrs` paths and skills-only selection**

Refactor `src/lib/config.js` toward this shape:

```js
const CONFIG_DIR = path.join(os.homedir(), '.wrs');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_ORIGIN = 'https://github.com/woicw/ai-config.git';
const DEFAULT_PLATFORM = 'claude';

export function getLocalConfigPath(cwd) {
  return path.join(cwd, '.wrs', 'config.json');
}

export function saveLastSelection(selection, isGlobal, baseDir) {
  const base = baseDir || (isGlobal ? os.homedir() : process.cwd());
  const configPath = path.join(base, '.wrs', 'config.json');

  const lastSelection = {
    skills: selection.skills || [],
    timestamp: new Date().toISOString(),
  };

  writeConfigFile(configPath, { lastSelection });
}

export function getLastSelection(isGlobal, baseDir) {
  const base = baseDir || (isGlobal ? os.homedir() : process.cwd());
  const configPath = path.join(base, '.wrs', 'config.json');
  const config = readConfigFile(configPath);
  return config.lastSelection || null;
}
```

Keep `getOrigin`, `setOrigin`, and `getPlatform`, but do not keep `setPlatform`.

- [ ] **Step 4: Run the config tests and verify they pass**

Run: `node --test tests/lib/config.test.js`

Expected: PASS for all tests in `tests/lib/config.test.js`.

- [ ] **Step 5: Commit the config-contract change**

```bash
git add tests/lib/config.test.js src/lib/config.js
git commit -m "Define the wrs config contract" -m "This change moves config storage to .wrs and removes legacy multi-type lastSelection fields.\n\nConstraint: New major version must not remain compatible with .wr-ai config layout\nRejected: Keep reading .wr-ai as fallback | contradicts the planned breaking boundary\nConfidence: high\nScope-risk: narrow\nReversibility: clean\nDirective: Do not reintroduce commands/agents/MCP fields into lastSelection without revisiting the product scope\nTested: node --test tests/lib/config.test.js\nNot-tested: Full command integration flow"
```

## Task 2: Replace Multi-Type Parsing With Skill-Only Discovery

**Files:**
- Modify: `src/utils/parser.js`
- Modify: `src/utils/constants.js`
- Create: `tests/utils/parser.test.js`

- [ ] **Step 1: Add parser tests that assert only `skills/` is discovered**

Create `tests/utils/parser.test.js` with these cases:

```js
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
```

- [ ] **Step 2: Run the parser tests and verify they fail because `readSkillList` does not exist yet**

Run: `node --test tests/utils/parser.test.js`

Expected: FAIL with an export error for `readSkillList`.

- [ ] **Step 3: Replace `src/utils/parser.js` with a skill-only reader**

Collapse `src/utils/parser.js` to a focused helper:

```js
import fs from 'fs';
import path from 'path';

export function readSkillList(sourcePath) {
  const skillsDir = path.join(sourcePath, 'skills');
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
```

Then remove obsolete constants from `src/utils/constants.js` so only values still used by the skills-only product remain, for example:

```js
export const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
export const DEFAULT_SOURCE = 'awesome-claude';
export const MAX_DISPLAY_ITEMS = 10;
export const TEMPLATES_DIR = path.join(os.homedir(), '.wrs', 'templates');
```

- [ ] **Step 4: Run the parser tests and the existing constants tests**

Run: `node --test tests/utils/parser.test.js tests/utils/constants.test.js`

Expected: parser tests PASS. If constants tests fail because they still expect multi-type values, update or remove those expectations in the same patch before re-running to green.

- [ ] **Step 5: Commit the skill-discovery layer**

```bash
git add tests/utils/parser.test.js src/utils/parser.js src/utils/constants.js tests/utils/constants.test.js
git commit -m "Reduce repository discovery to skills only" -m "The parser layer now reads only skills and no longer exposes the old multi-type selection contract.\n\nConstraint: Remote repositories may still contain legacy directories, but the CLI must ignore them\nRejected: Keep readConfigLists and return empty arrays for removed types | preserves a misleading API surface\nConfidence: high\nScope-risk: narrow\nReversibility: clean\nDirective: Keep parser helpers aligned with the actual product scope; do not add placeholder support for removed types\nTested: node --test tests/utils/parser.test.js tests/utils/constants.test.js\nNot-tested: Command handlers"
```

## Task 3: Slim the CLI Surface and Set Command

**Files:**
- Modify: `package.json`
- Modify: `src/index.js`
- Modify: `src/commands/set.js`

- [ ] **Step 1: Update package metadata and CLI registration tests by editing the public surface first**

Patch `package.json` and `src/index.js` toward these exact public identifiers:

```json
{
  "name": "wrs",
  "version": "4.0.0",
  "bin": {
    "wrs": "./src/index.js"
  }
}
```

```js
program
  .name('wrs')
  .description('一个用于同步 AI skills 的 CLI 工具')
  .version(packageJson.version, '-v, --version', 'output the version number');

const setCommand = program.command('set').description('设置配置');

setCommand
  .command('github')
  .description('设置 GitHub 远程地址')
  .argument('<url>', 'GitHub 仓库地址')
  .action(handleSet);

program.command('list').description('列出所有可用 skills').action(handleList);
program.command('add').description('添加指定 skill').argument('<name>', 'skill 名称').option('-g, --global').option('-p, --platform <platform>').action(handleAdd);
program.command('sync').description('同步 skills').option('-g, --global').option('-p, --platform <platform>').action(handleSync);
```

Delete command registrations for `init`, `update`, `install`, `upgrade`, `reset`, `clear`, and `set platform`.

- [ ] **Step 2: Simplify the set handler to GitHub-origin only**

Replace `src/commands/set.js` with:

```js
import { setOrigin } from '../lib/config.js';
import { log } from '../utils/logger.js';

export async function handleSet(origin) {
  if (!origin) {
    log.error('请提供 GitHub 地址');
    process.exit(1);
  }

  try {
    setOrigin(origin);
    log.success(`已设置 GitHub 地址: ${origin}`);
  } catch (error) {
    log.error(`设置失败: ${error.message}`);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Run a focused smoke check on the CLI entry**

Run: `node src/index.js --help`

Expected:
- The displayed binary name is `wrs`
- The command list contains `list`, `add`, `sync`, and `set`
- Removed commands are absent

- [ ] **Step 4: Commit the public CLI reduction**

```bash
git add package.json src/index.js src/commands/set.js
git commit -m "Rename the CLI to wrs and remove obsolete commands" -m "This narrows the public command surface to the four supported skills-only entry points.\n\nConstraint: Major release must communicate a clean break from wr-ai\nRejected: Leave hidden aliases for removed commands | encourages unsupported behavior and docs drift\nConfidence: high\nScope-risk: moderate\nReversibility: clean\nDirective: Keep the CLI surface small; new commands should require an explicit product-scope decision\nTested: node src/index.js --help\nNot-tested: End-to-end sync behavior"
```

## Task 4: Rebuild `list` and `add` for Skills Only

**Files:**
- Modify: `src/commands/list.js`
- Modify: `src/commands/add.js`
- Modify: `src/utils/merger.js`
- Create: `tests/commands/list.test.js`
- Create: `tests/commands/add.test.js`
- Delete: `tests/commands/add-latest.test.js`

- [ ] **Step 1: Add list-command tests for skill-only output**

Create `tests/commands/list.test.js` with a unit-level formatter seam. Export a pure helper from `src/commands/list.js` named `formatSkillListOutput` and test it like this:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { formatSkillListOutput } from '../../src/commands/list.js';

test('formatSkillListOutput - 只展示 skills 和 wrs 用法', () => {
  const lines = formatSkillListOutput('awesome-claude', ['code-review', 'nextjs']);
  const output = lines.join('\n');

  assert.match(output, /Skills/);
  assert.match(output, /code-review/);
  assert.match(output, /wrs add <skill>/);
  assert.match(output, /wrs sync/);
  assert.doesNotMatch(output, /Commands/);
  assert.doesNotMatch(output, /MCP/);
});
```

- [ ] **Step 2: Add add-command tests for one-skill success and missing-skill failure**

Create `tests/commands/add.test.js` around two pure seams:

- `findSkillOrThrow(skills, name)`
- `syncSkillDirectory(skillsDir, skillName, claudeDir)`

Use these tests:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { findSkillOrThrow } from '../../src/commands/add.js';
import { syncSkillDirectory } from '../../src/utils/merger.js';

test('findSkillOrThrow - 命中已有 skill', () => {
  assert.strictEqual(findSkillOrThrow(['code-review', 'nextjs'], 'nextjs'), 'nextjs');
});

test('findSkillOrThrow - 缺失 skill 时抛出明确错误', () => {
  assert.throws(
    () => findSkillOrThrow(['code-review'], 'missing-skill'),
    /未找到 skill: missing-skill/
  );
});

test('syncSkillDirectory - 复制远程 skill 并保留本地独有文件', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-add-'));
  const skillsDir = path.join(root, 'remote', 'skills');
  const claudeDir = path.join(root, 'project', '.claude');
  fs.mkdirSync(path.join(skillsDir, 'code-review'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'skills', 'code-review'), { recursive: true });

  fs.writeFileSync(path.join(skillsDir, 'code-review', 'SKILL.md'), '# remote');
  fs.writeFileSync(path.join(claudeDir, 'skills', 'code-review', 'local.md'), '# local-only');

  syncSkillDirectory(skillsDir, 'code-review', claudeDir);

  assert.strictEqual(fs.readFileSync(path.join(claudeDir, 'skills', 'code-review', 'SKILL.md'), 'utf8'), '# remote');
  assert.strictEqual(fs.readFileSync(path.join(claudeDir, 'skills', 'code-review', 'local.md'), 'utf8'), '# local-only');
});
```

- [ ] **Step 3: Run the new command tests and verify they fail before implementation**

Run: `node --test tests/commands/list.test.js tests/commands/add.test.js`

Expected: FAIL because `formatSkillListOutput`, `findSkillOrThrow`, and `syncSkillDirectory` do not exist yet.

- [ ] **Step 4: Narrow `src/utils/merger.js` to an explicit skill sync helper**

Add or keep only a helper with this contract:

```js
export function syncSkillDirectory(skillsDir, name, claudeDir) {
  const srcPath = path.join(skillsDir, name);
  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory()) {
    throw new Error(`未找到 skill: ${name}`);
  }

  const destPath = path.join(claudeDir, 'skills', name);
  copyFileOrDir(srcPath, destPath);
  return destPath;
}
```

Delete generic branches for commands, agents, hooks, MCP, and LSP once no callers remain.

- [ ] **Step 5: Rewrite `src/commands/list.js` around `readSkillList` and a pure formatter**

Drive the module toward this structure:

```js
export function formatSkillListOutput(sourceDir, skills) {
  const lines = [];
  lines.push(c.bold(`📦 ${sourceDir}`));
  lines.push('');
  lines.push(c.bold(c.green(`🧠 Skills (${skills.length})`)));
  lines.push('');
  skills.forEach((skill, index) => {
    const prefix = index === skills.length - 1 ? '└─' : '├─';
    lines.push(`${prefix} ${c.green(skill)}`);
  });
  lines.push('');
  lines.push('  使用方式:');
  lines.push('    wrs add <skill>           添加指定 skill');
  lines.push('    wrs sync                  同步上次选择或进入交互选择');
  lines.push('    wrs list                  列出可用 skills');
  return lines;
}
```

Then make `handleList()` call `readSkillList(sourcePath)` and print only this output.

- [ ] **Step 6: Rewrite `src/commands/add.js` into a skills-only command**

Drive it toward these exact seams:

```js
export function findSkillOrThrow(skills, name) {
  if (!skills.includes(name)) {
    throw new Error(`未找到 skill: ${name}`);
  }
  return name;
}

export async function handleAdd(name, options = {}) {
  if (!name) {
    log.error('请指定要添加的 skill 名称');
    process.exit(1);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wrs set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora(`正在查找 skill: ${name}...`).start();
  const { sourcePath } = await resolveSource(origin, spinner);
  const skills = readSkillList(sourcePath);
  findSkillOrThrow(skills, name);

  const targetDirs = resolveTargetDirectories({
    global: options.global || false,
    platform: options.platform,
    fallbackPlatform: getPlatform(),
    cwd: process.cwd(),
  });

  for (const target of targetDirs) {
    syncSkillDirectory(path.join(sourcePath, 'skills'), name, target.claudeDir);
  }
}
```

No `type:name`, no `@latest`, no MCP/LSP, no non-skill listing.

- [ ] **Step 7: Run the new command tests to green**

Run: `node --test tests/commands/list.test.js tests/commands/add.test.js tests/utils/merger.test.js`

Expected: PASS for skill-only list/add behaviors and merge semantics.

- [ ] **Step 8: Commit the skill-only list/add flow**

```bash
git add src/commands/list.js src/commands/add.js src/utils/merger.js tests/commands/list.test.js tests/commands/add.test.js tests/utils/merger.test.js
git rm tests/commands/add-latest.test.js
git commit -m "Rebuild list and add around skill sync" -m "The list and add flows now operate only on skills and the merge layer exposes a single explicit skill-sync helper.\n\nConstraint: Same-name skill sync must remain non-destructive for local-only files\nRejected: Keep generic addByType plumbing and only stop calling it | leaves dead complexity in the critical path\nConfidence: high\nScope-risk: moderate\nReversibility: clean\nDirective: Keep command handlers thin and push reusable logic into small, explicit skill-focused helpers\nTested: node --test tests/commands/list.test.js tests/commands/add.test.js tests/utils/merger.test.js\nNot-tested: Interactive sync flow"
```

## Task 5: Rebuild `sync` as History-First Skill Selection

**Files:**
- Modify: `src/commands/sync.js`
- Modify: `tests/commands/sync.test.js`

- [ ] **Step 1: Rewrite sync tests around the new history behavior**

Replace `tests/commands/sync.test.js` with cases for `.wrs` and skills-only history:

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveLastSelection, getLastSelection } from '../../src/lib/config.js';

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
```

- [ ] **Step 2: Add a pure helper inside `src/commands/sync.js` and test its selection behavior**

Export a helper named `resolveSkillsToSync(lastSelection, remoteSkills)` and add these assertions at the bottom of `tests/commands/sync.test.js`:

```js
import { resolveSkillsToSync } from '../../src/commands/sync.js';

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
```

- [ ] **Step 3: Run the sync tests and verify they fail on legacy command-field expectations**

Run: `node --test tests/commands/sync.test.js`

Expected: FAIL because `resolveSkillsToSync` does not exist and/or old `.wr-ai` paths are still referenced.

- [ ] **Step 4: Rewrite `src/commands/sync.js` around skills-only replay and interactive fallback**

Aim for this control flow:

```js
export function resolveSkillsToSync(lastSelection, remoteSkills) {
  return (lastSelection?.skills || []).filter((skill) => remoteSkills.includes(skill));
}

export async function handleSync(options = {}) {
  const isGlobal = options.global || false;
  const lastSelection = getLastSelection(isGlobal);
  const origin = getOrigin();

  if (!origin) {
    log.error('请先使用 "wrs set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在同步 skills...').start();
  const { sourcePath } = await resolveSource(origin, spinner);
  const remoteSkills = readSkillList(sourcePath);

  let selectedSkills = resolveSkillsToSync(lastSelection, remoteSkills);

  if (selectedSkills.length === 0) {
    spinner.stop();
    selectedSkills = await checkbox({
      message: '请选择要同步的 skills:',
      choices: remoteSkills.map((skill) => ({ name: skill, value: skill })),
    });

    if (selectedSkills.length === 0) {
      log.warn('未选择任何 skill');
      process.exit(1);
    }

    saveLastSelection({ skills: selectedSkills }, isGlobal);
  }

  const targetDirs = resolveTargetDirectories({
    global: isGlobal,
    platform: options.platform,
    fallbackPlatform: getPlatform(),
    cwd: process.cwd(),
  });

  for (const target of targetDirs) {
    for (const skill of selectedSkills) {
      syncSkillDirectory(path.join(sourcePath, 'skills'), skill, target.claudeDir);
    }
  }
}
```

If history exists but all remembered skills are gone remotely, fall back into the interactive selector instead of hard failing.

- [ ] **Step 5: Run the sync tests to green**

Run: `node --test tests/commands/sync.test.js`

Expected: PASS for skills-only lastSelection handling and replay filtering.

- [ ] **Step 6: Commit the new sync flow**

```bash
git add src/commands/sync.js tests/commands/sync.test.js
git commit -m "Make sync replay remembered skills or prompt for selection" -m "This rebuilds sync around skills-only history with an interactive fallback when no usable remembered skills exist.\n\nConstraint: Sync must be the main repeated-use command in the new product\nRejected: Hard-fail when remembered skills disappear remotely | creates unnecessary recovery friction\nConfidence: high\nScope-risk: moderate\nReversibility: clean\nDirective: Keep sync history scoped to skills only; do not let this handler become a new generic selection engine\nTested: node --test tests/commands/sync.test.js\nNot-tested: Full interactive prompt run"
```

## Task 6: Delete Removed Commands, Rewrite README, and Run Full Verification

**Files:**
- Delete: `src/commands/init.js`
- Delete: `src/commands/update.js`
- Delete: `src/commands/clear.js`
- Delete: `src/commands/reset.js`
- Delete: `src/commands/upgrade.js`
- Modify: `README.md`

- [ ] **Step 1: Remove obsolete command modules once all imports are gone**

Run:

```bash
git rm src/commands/init.js src/commands/update.js src/commands/clear.js src/commands/reset.js src/commands/upgrade.js
```

Expected: those files are staged for deletion, with no remaining imports in `src/index.js`.

- [ ] **Step 2: Rewrite the README around the new `wrs` workflow**

Replace the opening sections with content like this:

```md
# wrs

从 GitHub 仓库一键同步 AI skills，快速装备你的 Claude / Codex 工作区。

## 安装

```bash
npm install -g wrs
# 或
pnpm add -g wrs
```

## 快速开始

```bash
# 1. 设置远程仓库
wrs set github <仓库地址>

# 2. 查看可用 skills
wrs list

# 3. 添加单个 skill
wrs add code-review

# 4. 同步上次选择，或首次进入交互多选
wrs sync
```

## 破坏性变更

- 新版 CLI 名称为 `wrs`
- 只支持 `skills`
- 配置目录改为 `~/.wrs` 和 `<project>/.wrs`
- 不兼容旧版 `.wr-ai` 配置
```

Make sure every remaining command example, option, and error hint uses `wrs`, not `wr-ai`.

- [ ] **Step 3: Run a repository-wide grep for legacy surface that should now be gone**

Run:

```bash
rg -n "wr-ai|\\.wr-ai|init|update|install|upgrade|reset|clear|command/skill/agent|mcp|lsp" src tests README.md package.json
```

Expected:
- Remaining hits for `wr-ai` only appear in the design and plan docs
- Source files no longer describe removed commands or removed sync types

- [ ] **Step 4: Run the full automated test suite**

Run: `npm test`

Expected: PASS for the full test suite.

- [ ] **Step 5: Run one final CLI smoke check**

Run:

```bash
node src/index.js --help
node src/index.js list --help
node src/index.js sync --help
```

Expected:
- All help output uses `wrs`
- Only the supported commands are listed
- `sync` is described as the repeated workflow

- [ ] **Step 6: Commit the cleanup, docs rewrite, and verification pass**

```bash
git add README.md package.json src/index.js src/commands/set.js src/commands/list.js src/commands/add.js src/commands/sync.js src/lib/config.js src/utils/parser.js src/utils/merger.js src/utils/constants.js tests/commands/*.test.js tests/lib/config.test.js tests/utils/*.test.js
git commit -m "Finish the wrs skills-only release cutover" -m "The repository now reflects the breaking wrs product: a smaller CLI, a skills-only sync model, and the new .wrs config layout.\n\nConstraint: Documentation and shipped behavior must agree at release time\nRejected: Leave old docs and dead modules in place until later | invites immediate confusion after release\nConfidence: medium\nScope-risk: broad\nReversibility: messy\nDirective: Treat this repository as a skills-sync tool from this point forward; broadening scope should start from a fresh design pass\nTested: npm test; node src/index.js --help; node src/index.js list --help; node src/index.js sync --help\nNot-tested: Published package install from npm"
```

## Self-Review

### Spec coverage

- CLI reduction to `list`, `add`, `sync`, and `set github`: covered by Tasks 3, 4, and 5
- `.wrs` config layout and no `.wr-ai` compatibility: covered by Tasks 1 and 6
- Skills-only parsing and sync behavior: covered by Tasks 2, 4, and 5
- Non-destructive same-name skill merge: covered by Task 4
- README and release-facing breaking-change communication: covered by Task 6

No spec gaps remain.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain
- Every code-changing task includes concrete code or exact commands
- Every verification step includes an exact command and expected result

### Type consistency

- The plan consistently uses `readSkillList`, `syncSkillDirectory`, `findSkillOrThrow`, and `resolveSkillsToSync`
- `lastSelection` consistently stores only `skills`
- The CLI name is consistently `wrs`
