# wr-ai 便利性功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 wr-ai 添加记住上次选择（lastSelection）、sync/install 快捷命令、--recommended/--exclude 批量选项和 @latest 支持，减少重复操作

**Architecture:** 在 `src/lib/config.js` 中扩展配置读写支持全局/本地 lastSelection；新增 `src/commands/sync.js` 复用现有 merge 逻辑；在 `src/index.js` 注册 install 别名和新命令；在 init 命令中添加 --recommended/--exclude；在 add 命令中支持 @latest 模式

**Tech Stack:** Node.js (ES modules), commander, @inquirer/prompts, ora, node:test, yoctocolors

---

## Phase 1: 核心功能 - 配置存储与 sync 命令

### Task 1: 扩展 config.js 支持 lastSelection 读写

**Files:**
- Modify: `src/lib/config.js:1-56`
- Create: `tests/lib/config.test.js`

**Step 1: 编写 lastSelection 读写测试**

```javascript
// tests/lib/config.test.js
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
  // 由于 config.js 使用 os.homedir()，我们通过传参方式测试
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
    // 预先写入已有配置
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
```

**Step 2: 运行测试验证失败**

Run: `node --test tests/lib/config.test.js`
Expected: FAIL - `getLastSelection`, `saveLastSelection`, `getLocalConfigPath` 未导出

**Step 3: 实现 lastSelection 读写函数**

在 `src/lib/config.js` 文件末尾追加以下函数：

```javascript
/**
 * 获取本地配置文件路径
 * @param {string} cwd - 项目目录
 * @returns {string} 本地配置文件路径
 */
export function getLocalConfigPath(cwd) {
  return path.join(cwd, '.wr-ai', 'config.json');
}

/**
 * 读取指定路径的配置文件
 * @param {string} configPath - 配置文件路径
 * @returns {Object} 配置对象
 */
function readConfigFile(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * 写入配置文件（保留已有字段）
 * @param {string} configPath - 配置文件路径
 * @param {Object} updates - 要合并的字段
 */
function writeConfigFile(configPath, updates) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const existing = readConfigFile(configPath);
  const merged = { ...existing, ...updates };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

/**
 * 保存上次选择
 * @param {Object} selection - 选择对象 { commands, skills, agents, hooks, mcpServers, lspServices }
 * @param {boolean} isGlobal - 是否保存到全局配置
 * @param {string} [baseDir] - 基础目录（全局时为 home 目录，本地时为项目目录）
 */
export function saveLastSelection(selection, isGlobal, baseDir) {
  const base = baseDir || (isGlobal ? os.homedir() : process.cwd());
  const configPath = path.join(base, '.wr-ai', 'config.json');

  const lastSelection = {
    commands: selection.commands || [],
    skills: selection.skills || [],
    agents: selection.agents || [],
    hooks: selection.hooks || [],
    mcpServers: selection.mcpServers || [],
    lspServices: selection.lspServices || [],
    timestamp: new Date().toISOString(),
  };

  writeConfigFile(configPath, { lastSelection });
}

/**
 * 获取上次选择
 * @param {boolean} isGlobal - 是否读取全局配置
 * @param {string} [baseDir] - 基础目录
 * @returns {Object|null} 上次选择对象，不存在则返回 null
 */
export function getLastSelection(isGlobal, baseDir) {
  const base = baseDir || (isGlobal ? os.homedir() : process.cwd());
  const configPath = path.join(base, '.wr-ai', 'config.json');
  const config = readConfigFile(configPath);
  return config.lastSelection || null;
}
```

**Step 4: 运行测试验证通过**

Run: `node --test tests/lib/config.test.js`
Expected: 全部 PASS

**Step 5: 运行全部测试确保无回归**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 6: 提交**

```bash
git add src/lib/config.js tests/lib/config.test.js
git commit -m "feat: add lastSelection save/load to config module"
```

---

### Task 2: 在 init 和 update 命令中自动保存选择

**Files:**
- Modify: `src/commands/init.js:118-269`
- Modify: `src/commands/update.js:13-161`

**Step 1: 修改 init.js - 导入 saveLastSelection 并在合并完成后保存选择**

在 `src/commands/init.js` 第 1 行修改 import：

```javascript
import { getOrigin, getPlatform, saveLastSelection } from '../lib/config.js';
```

在 `handleInit` 函数中，`performMergeAndOutput` 调用之后（两处：`--all` 分支 ~200 行处和普通选择分支 ~258 行处），各添加一行保存选择的代码。

在 `--all` 分支的 `performMergeAndOutput` 调用后（约第 199 行 `return;` 之前）添加：

```javascript
      // 保存选择
      saveLastSelection({
        commands: selection.selectedCommands,
        skills: selection.selectedSkills,
        agents: selection.selectedAgents,
        hooks: selection.selectedHooks,
        mcpServers: selection.selectedMcpServers,
        lspServices: selection.selectedLspServices,
      }, isGlobal);
```

在普通选择分支的 `performMergeAndOutput` 调用后（约第 258 行之后）添加同样的代码：

```javascript
    // 保存选择
    saveLastSelection({
      commands: selection.selectedCommands,
      skills: selection.selectedSkills,
      agents: selection.selectedAgents,
      hooks: selection.selectedHooks,
      mcpServers: selection.selectedMcpServers,
      lspServices: selection.selectedLspServices,
    }, isGlobal);
```

**Step 2: 修改 update.js - 同样导入并保存选择**

在 `src/commands/update.js` 第 1 行修改 import：

```javascript
import { getOrigin, getPlatform, saveLastSelection } from '../lib/config.js';
```

在 `handleUpdate` 函数的 for 循环结束后（约第 150 行，`}` 的后面，`} catch` 之前）添加：

```javascript
    // 保存选择
    saveLastSelection({
      commands: selection.selectedCommands,
      skills: selection.selectedSkills,
      agents: selection.selectedAgents,
      hooks: selection.selectedHooks,
      mcpServers: selection.selectedMcpServers,
      lspServices: selection.selectedLspServices,
    }, isGlobal);
```

**Step 3: 运行全部测试确保无回归**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 4: 提交**

```bash
git add src/commands/init.js src/commands/update.js
git commit -m "feat: auto-save selection after init and update commands"
```

---

### Task 3: 实现 sync 命令

**Files:**
- Create: `src/commands/sync.js`
- Modify: `src/index.js:1-88`

**Step 1: 创建 sync 命令实现**

```javascript
// src/commands/sync.js
import { getOrigin, getPlatform, getLastSelection } from '../lib/config.js';
import { resolveTargetDirectories, isValidPlatformName, updateGitignore } from '../lib/filesystem.js';
import { resolveSource } from '../lib/source.js';
import * as c from 'yoctocolors';
import ora from 'ora';
import { MAX_DISPLAY_ITEMS, OPTION_VALUES } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { readConfigLists, parseSelection } from '../utils/parser.js';
import { mergeFileConfigs, mergeMcpConfig, mergeLspConfig, checkNeedConfirm } from '../utils/merger.js';
import { confirmAction } from '../utils/prompts.js';
import { handleCancelError } from '../utils/error-handler.js';

export async function handleSync(options = {}) {
  const isGlobal = options.global || false;

  // 读取上次保存的选择
  const lastSelection = getLastSelection(isGlobal);
  if (!lastSelection) {
    log.error(isGlobal
      ? '未找到全局配置的历史选择，请先运行 "wr-ai init -g" 或 "wr-ai update -g"'
      : '未找到本地配置的历史选择，请先运行 "wr-ai init" 或 "wr-ai update"');
    process.exit(1);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  const spinner = ora('正在同步配置...').start();

  try {
    const { sourcePath, srcBaseDir } = await resolveSource(origin, spinner);

    // 读取配置列表
    const configLists = readConfigLists(sourcePath);
    const {
      commands, skills, agents, hooks,
      mcpServers, lspServices,
      hasMcp, hasLsp,
      mcpFile, lspFile,
      commandsDir, skillsDir, agentsDir, hooksDir,
    } = configLists;

    // 根据保存的选择构建 selected 数组，复用 parseSelection
    const selected = [];

    for (const cmd of lastSelection.commands || []) {
      if (commands.includes(cmd)) selected.push(`${OPTION_VALUES.CMD_PREFIX}${cmd}`);
    }
    for (const skill of lastSelection.skills || []) {
      if (skills.includes(skill)) selected.push(`${OPTION_VALUES.SKILL_PREFIX}${skill}`);
    }
    for (const agent of lastSelection.agents || []) {
      if (agents.includes(agent)) selected.push(`${OPTION_VALUES.AGENT_PREFIX}${agent}`);
    }
    for (const hook of lastSelection.hooks || []) {
      if (hooks.includes(hook)) selected.push(`${OPTION_VALUES.HOOK_PREFIX}${hook}`);
    }
    for (const mcp of lastSelection.mcpServers || []) {
      if (mcpServers.includes(mcp)) selected.push(`${OPTION_VALUES.MCP_PREFIX}${mcp}`);
    }
    for (const lsp of lastSelection.lspServices || []) {
      if (lspServices.includes(lsp)) selected.push(`${OPTION_VALUES.LSP_PREFIX}${lsp}`);
    }

    if (selected.length === 0) {
      log.warn('上次选择的配置项在远程仓库中已不存在，请重新运行 "wr-ai init" 或 "wr-ai update"');
      process.exit(0);
    }

    // 显示将要同步的内容
    log.info(`将同步 ${selected.length} 个配置项（上次选择于 ${lastSelection.timestamp}）`);

    // 解析选择
    const selection = parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices);

    // 确定目标目录
    const fallbackPlatform = getPlatform();
    if (options.platform && !isValidPlatformName(options.platform)) {
      log.error('平台名称只能包含字母、数字、连字符和下划线');
      process.exit(1);
    }
    const targetDirs = resolveTargetDirectories({
      global: isGlobal,
      platform: options.platform,
      fallbackPlatform,
      cwd: process.cwd(),
    });

    // 执行合并
    for (const target of targetDirs) {
      const { platform, dirName, claudeDir, targetPathPrefix } = target;
      const syncSpinner = ora(`正在同步到 ${dirName}/...`).start();

      const fileResults = mergeFileConfigs(
        selection.selectedCommands,
        selection.selectedSkills,
        selection.selectedAgents,
        selection.selectedHooks,
        { commandsDir, skillsDir, agentsDir, hooksDir },
        claudeDir,
        srcBaseDir
      );

      const { addedItems, updatedItems, copiedItems } = fileResults;

      if (selection.selectMcp && hasMcp) {
        const status = mergeMcpConfig(mcpFile, claudeDir, selection.selectedMcpServers, selection.selectAllMcp, srcBaseDir);
        if (status === 'updated') updatedItems.push('.mcp.json');
        else addedItems.push('.mcp.json');
        copiedItems.push('.mcp.json');
      }

      if (selection.selectLsp && hasLsp) {
        const status = mergeLspConfig(lspFile, claudeDir, selection.selectedLspServices, selection.selectAllLsp, srcBaseDir);
        if (status === 'updated') updatedItems.push('.lsp.json');
        else addedItems.push('.lsp.json');
        copiedItems.push('.lsp.json');
      }

      const targetPath = `${targetPathPrefix}/`;
      let successMsg = `已同步 ${copiedItems.length} 个项目到 ${targetPath}:\n`;
      if (addedItems.length > 0) {
        successMsg += c.green(`  新增: ${addedItems.length} 个\n`);
      }
      if (updatedItems.length > 0) {
        successMsg += c.yellow(`  更新: ${updatedItems.length} 个\n`);
      }
      if (copiedItems.length <= MAX_DISPLAY_ITEMS) {
        successMsg += copiedItems.map((f) => `  • ${f}`).join('\n');
      } else {
        successMsg += copiedItems.slice(0, MAX_DISPLAY_ITEMS).map((f) => `  • ${f}`).join('\n');
        successMsg += `\n  ... 还有 ${copiedItems.length - MAX_DISPLAY_ITEMS} 个`;
      }
      syncSpinner.succeed(successMsg);

      if (!isGlobal && updateGitignore(process.cwd(), false, platform)) {
        log.info(`已添加 .${platform} 到 .gitignore`);
      }
    }
  } catch (error) {
    handleCancelError(error, spinner);

    spinner.fail(`同步失败: ${error.message}`);
    if (error.stack) {
      log.error(`错误堆栈: ${error.stack}`);
    }
    process.exit(1);
  }
}
```

**Step 2: 在 index.js 中注册 sync 命令**

在 `src/index.js` 第 7 行（`import { handleAdd }` 之后）添加：

```javascript
import { handleSync } from "./commands/sync.js";
```

在 `src/index.js` 第 87 行（`program.command("reset")` 之后，`program.parse()` 之前）添加：

```javascript
program
  .command("sync")
  .description("同步上次选择的配置（无需重新选择）")
  .option("-g, --global", "同步全局配置")
  .option("-p, --platform <platform>", "指定平台目录")
  .action(handleSync);
```

**Step 3: 运行全部测试确保无回归**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 4: 手动验证命令已注册**

Run: `node src/index.js sync --help`
Expected: 显示 sync 命令的帮助信息

**Step 5: 提交**

```bash
git add src/commands/sync.js src/index.js
git commit -m "feat: add sync command for quick re-apply of last selection"
```

---

## Phase 2: 便利功能 - install 别名与批量选项

### Task 4: 添加 install 命令别名

**Files:**
- Modify: `src/index.js`

**Step 1: 在 index.js 中注册 install 命令**

在 sync 命令注册之后，`program.parse()` 之前添加：

```javascript
program
  .command("install <name>")
  .description("安装配置（add 的别名）")
  .option("-g, --global", "保存到用户目录")
  .option("-p, --platform <platform>", "指定平台目录")
  .action(handleAdd);
```

**Step 2: 手动验证**

Run: `node src/index.js install --help`
Expected: 显示 install 命令的帮助信息

**Step 3: 提交**

```bash
git add src/index.js
git commit -m "feat: add install command as alias for add"
```

---

### Task 5: 为 init 命令添加 --recommended 选项

**Files:**
- Modify: `src/utils/constants.js:1-52`
- Modify: `src/commands/init.js:118-269`
- Create: `tests/utils/constants.test.js`

**Step 1: 编写推荐配置常量测试**

```javascript
// tests/utils/constants.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { RECOMMENDED_TYPES } from '../../src/utils/constants.js';

test('RECOMMENDED_TYPES - 包含推荐的配置类型', () => {
  assert.ok(Array.isArray(RECOMMENDED_TYPES));
  assert.ok(RECOMMENDED_TYPES.length > 0);
  // 推荐类型应该只包含简单配置，不包含 mcp/lsp
  assert.ok(!RECOMMENDED_TYPES.includes('mcp'));
  assert.ok(!RECOMMENDED_TYPES.includes('lsp'));
});
```

**Step 2: 运行测试验证失败**

Run: `node --test tests/utils/constants.test.js`
Expected: FAIL - `RECOMMENDED_TYPES` 未导出

**Step 3: 在 constants.js 中定义推荐类型**

在 `src/utils/constants.js` 末尾添加：

```javascript
// 推荐安装的配置类型（排除复杂的 mcp/lsp）
export const RECOMMENDED_TYPES = ['command', 'skill'];
```

**Step 4: 运行测试验证通过**

Run: `node --test tests/utils/constants.test.js`
Expected: PASS

**Step 5: 修改 init 命令支持 --recommended**

在 `src/index.js` 中的 initCommand 定义处添加选项：

```javascript
  .option('-r, --recommended', '安装推荐配置（commands 和 skills）')
```

在 `src/commands/init.js` 的 `handleInit` 函数中，`--all` 分支之后（约第 201 行），添加 `--recommended` 分支：

```javascript
    // 如果使用了 --recommended 选项
    if (options.recommended) {
      const selected = [];
      if (commands.length > 0) selected.push(OPTION_VALUES.ALL_COMMANDS);
      if (skills.length > 0) selected.push(OPTION_VALUES.ALL_SKILLS);

      if (selected.length === 0) {
        log.warn('未找到推荐的配置类型');
        process.exit(0);
      }

      const selection = parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices);

      await performMergeAndOutput({
        selection,
        commands, skills, agents, hooks,
        mcpServers, lspServices,
        hasMcp, hasLsp,
        mcpFile, lspFile,
        commandsDir, skillsDir, agentsDir, hooksDir,
        targetDirs, srcBaseDir,
        global: isGlobal,
      });

      saveLastSelection({
        commands: selection.selectedCommands,
        skills: selection.selectedSkills,
        agents: selection.selectedAgents,
        hooks: selection.selectedHooks,
        mcpServers: selection.selectedMcpServers,
        lspServices: selection.selectedLspServices,
      }, isGlobal);
      return;
    }
```

注意：需要在 init.js 顶部导入 `RECOMMENDED_TYPES`（如果后续需要动态判断可用）。但上面的实现更简单 - 直接硬编码选择 commands + skills，因为推荐就是这两类。

**Step 6: 运行全部测试**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 7: 手动验证**

Run: `node src/index.js init --help`
Expected: 显示 `--recommended` 选项

**Step 8: 提交**

```bash
git add src/utils/constants.js tests/utils/constants.test.js src/commands/init.js src/index.js
git commit -m "feat: add --recommended option to init command"
```

---

### Task 6: 为 init 命令添加 --exclude 选项

**Files:**
- Modify: `src/commands/init.js`
- Modify: `src/index.js`

**Step 1: 在 index.js 中为 init 注册 --exclude 选项**

在 initCommand 定义处添加：

```javascript
  .option('-e, --exclude <types>', '排除指定类型（逗号分隔，如 mcp,lsp）')
```

**Step 2: 修改 init.js 支持 --exclude**

在 `handleInit` 函数中，`--all` 分支的 `parseSelection` 调用之前，如果有 `options.exclude` 则过滤选项。

修改 `--all` 分支（约第 172-200 行）为：

```javascript
    if (options.all) {
      let selected = [OPTION_VALUES.ALL];

      // 处理排除选项
      if (options.exclude) {
        const excludeTypes = options.exclude.split(',').map((t) => normalizeType(t.trim()));
        selected = [];
        if (!excludeTypes.includes('command') && commands.length > 0) selected.push(OPTION_VALUES.ALL_COMMANDS);
        if (!excludeTypes.includes('skill') && skills.length > 0) selected.push(OPTION_VALUES.ALL_SKILLS);
        if (!excludeTypes.includes('agent') && agents.length > 0) selected.push(OPTION_VALUES.ALL_AGENTS);
        if (!excludeTypes.includes('hook') && hooks.length > 0) selected.push(OPTION_VALUES.ALL_HOOKS);
        if (!excludeTypes.includes('mcp') && hasMcp) selected.push(OPTION_VALUES.ALL_MCP);
        if (!excludeTypes.includes('lsp') && hasLsp) selected.push(OPTION_VALUES.ALL_LSP);
      }

      const selection = parseSelection(selected, commands, skills, agents, hooks, mcpServers, lspServices);

      await performMergeAndOutput({
        selection,
        commands, skills, agents, hooks,
        mcpServers, lspServices,
        hasMcp, hasLsp,
        mcpFile, lspFile,
        commandsDir, skillsDir, agentsDir, hooksDir,
        targetDirs, srcBaseDir,
        global: isGlobal,
      });

      saveLastSelection({
        commands: selection.selectedCommands,
        skills: selection.selectedSkills,
        agents: selection.selectedAgents,
        hooks: selection.selectedHooks,
        mcpServers: selection.selectedMcpServers,
        lspServices: selection.selectedLspServices,
      }, isGlobal);
      return;
    }
```

注意：确保 `normalizeType` 已从 constants.js 导入。检查 init.js 顶部的 import，当前已有：
```javascript
import { MAX_DISPLAY_ITEMS, OPTION_VALUES, VALID_TYPES, normalizeType } from '../utils/constants.js';
```
所以不需要额外导入。

**Step 3: 运行全部测试**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 4: 手动验证**

Run: `node src/index.js init --help`
Expected: 显示 `--exclude` 选项

**Step 5: 提交**

```bash
git add src/commands/init.js src/index.js
git commit -m "feat: add --exclude option to init command"
```

---

## Phase 3: 高级功能 - @latest 支持与 upgrade 命令

### Task 7: 为 add 命令添加 @latest 支持

**Files:**
- Modify: `src/commands/add.js:80-262`
- Create: `tests/commands/add-latest.test.js`

**Step 1: 编写 @latest 解析测试**

```javascript
// tests/commands/add-latest.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { parseLatestArg } from '../../src/commands/add.js';

test('parseLatestArg - @latest 返回默认 count 1', () => {
  const result = parseLatestArg('@latest');
  assert.deepStrictEqual(result, { isLatest: true, count: 1 });
});

test('parseLatestArg - @latest:5 返回 count 5', () => {
  const result = parseLatestArg('@latest:5');
  assert.deepStrictEqual(result, { isLatest: true, count: 5 });
});

test('parseLatestArg - 普通名称返回 isLatest false', () => {
  const result = parseLatestArg('code-review');
  assert.deepStrictEqual(result, { isLatest: false, count: 0 });
});

test('parseLatestArg - @latest:0 返回 count 1（最少1个）', () => {
  const result = parseLatestArg('@latest:0');
  assert.deepStrictEqual(result, { isLatest: true, count: 1 });
});
```

**Step 2: 运行测试验证失败**

Run: `node --test tests/commands/add-latest.test.js`
Expected: FAIL - `parseLatestArg` 未导出

**Step 3: 在 add.js 中实现 @latest 解析和处理**

在 `src/commands/add.js` 文件中添加导入 `execSync`：

```javascript
import { execSync } from "child_process";
```

在 `handleAdd` 函数之前添加：

```javascript
/**
 * 解析 @latest 参数
 * @param {string} name - 输入名称
 * @returns {{ isLatest: boolean, count: number }}
 */
export function parseLatestArg(name) {
  if (!name.startsWith('@latest')) {
    return { isLatest: false, count: 0 };
  }
  if (name === '@latest') {
    return { isLatest: true, count: 1 };
  }
  const match = name.match(/^@latest:(\d+)$/);
  if (match) {
    const count = Math.max(1, parseInt(match[1], 10));
    return { isLatest: true, count };
  }
  return { isLatest: true, count: 1 };
}

/**
 * 获取最近修改的配置文件（基于 git log）
 * @param {string} repoDir - Git 仓库目录
 * @param {string} sourcePath - 配置源目录
 * @param {number} count - 返回数量
 * @returns {string[]} 最近修改的配置名称列表（格式: type:name）
 */
function getLatestConfigs(repoDir, sourcePath, count) {
  try {
    // 使用 git log 获取最近修改的文件
    const output = execSync(
      `git log --pretty=format: --name-only --diff-filter=ACMR -n 50`,
      { cwd: repoDir, encoding: 'utf-8' }
    );

    const relativeSourcePath = path.relative(repoDir, sourcePath);
    const seen = new Set();
    const results = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith(relativeSourcePath + '/')) continue;

      // 从路径中提取 type 和 name
      const relativePath = trimmed.slice(relativeSourcePath.length + 1);
      const parts = relativePath.split('/');
      if (parts.length < 2) continue;

      const dir = parts[0]; // commands, skills, agents, hooks
      const fileName = parts[1];

      let type, name;
      if (dir === 'commands' && fileName.endsWith('.md')) {
        type = 'command';
        name = fileName.replace('.md', '');
      } else if (dir === 'skills') {
        type = 'skill';
        name = fileName; // skills 是目录
      } else if (dir === 'agents' && fileName.endsWith('.md')) {
        type = 'agent';
        name = fileName.replace('.md', '');
      } else if (dir === 'hooks' && fileName.endsWith('.json')) {
        type = 'hook';
        name = fileName.replace('.json', '');
      } else {
        continue;
      }

      const key = `${type}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(key);

      if (results.length >= count) break;
    }

    return results;
  } catch {
    return [];
  }
}
```

在 `handleAdd` 函数中，`const spinner` 之前（约第 105 行前），添加 @latest 检测：

```javascript
  // 检测 @latest 模式
  const latestArg = parseLatestArg(name);
  if (latestArg.isLatest) {
    const spinner = ora(`正在查找最近更新的 ${latestArg.count} 个配置...`).start();

    try {
      const { sourcePath } = await resolveSource(origin, spinner);
      const repoDir = path.dirname(sourcePath);
      spinner.start(`正在查找最近更新的配置...`);

      const latestConfigs = getLatestConfigs(path.dirname(sourcePath), sourcePath, latestArg.count);

      if (latestConfigs.length === 0) {
        spinner.fail('未找到最近更新的配置');
        process.exit(1);
      }

      const isGlobal = options.global || false;
      const fallbackPlatform = getPlatform();
      if (options.platform && !isValidPlatformName(options.platform)) {
        log.error('平台名称只能包含字母、数字、连字符和下划线');
        process.exit(1);
      }
      const targetDirs = resolveTargetDirectories({
        global: isGlobal,
        platform: options.platform,
        fallbackPlatform,
        cwd: process.cwd(),
      });

      log.info(`最近更新的 ${latestConfigs.length} 个配置:`);
      latestConfigs.forEach((c) => console.log(`  • ${c}`));

      let allSuccess = true;
      const sourceDirPath = sourcePath;
      const commandsDir = path.join(sourceDirPath, 'commands');
      const skillsDir = path.join(sourceDirPath, 'skills');
      const agentsDir = path.join(sourceDirPath, 'agents');
      const hooksDir = path.join(sourceDirPath, 'hooks');
      const mcpFile = path.join(sourceDirPath, '.mcp.json');
      const lspFile = path.join(sourceDirPath, '.lsp.json');
      const { keys: mcpServers } = readJsonConfig(mcpFile, 'mcpServers');
      const { keys: lspServices } = readJsonConfig(lspFile);

      for (const config of latestConfigs) {
        const [configType, configName] = config.split(':');
        const result = addByType(configType, configName, {
          commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
          targetDirs, spinner, mcpServers, lspServices,
        });
        if (!result) allSuccess = false;
      }

      if (allSuccess) {
        afterAddTargets(isGlobal, targetDirs);
      }
      return;
    } catch (error) {
      if (error.name === 'CancelError' || error.name === 'ExitPromptError' ||
          error.message?.includes('SIGINT') || error.message?.includes('cancel')) {
        spinner.stop();
        log.info('操作已取消');
        process.exit(0);
      }
      spinner.fail(`添加失败: ${error.message}`);
      process.exit(1);
    }
  }
```

注意：上面代码中 `repoDir` 的获取需要注意：`resolveSource` 返回 `{ repoDir, sourceDir, sourcePath, srcBaseDir }`。所以可以直接用返回的 `repoDir`。修正为：

```javascript
      const { sourcePath, repoDir } = await resolveSource(origin, spinner);
```

然后 `getLatestConfigs(repoDir, sourcePath, latestArg.count)`。

**Step 4: 运行测试验证通过**

Run: `node --test tests/commands/add-latest.test.js`
Expected: PASS

**Step 5: 运行全部测试**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 6: 提交**

```bash
git add src/commands/add.js tests/commands/add-latest.test.js
git commit -m "feat: add @latest support to add command"
```

---

### Task 8: 添加 upgrade 命令

**Files:**
- Create: `src/commands/upgrade.js`
- Modify: `src/index.js`

**Step 1: 创建 upgrade 命令实现**

```javascript
// src/commands/upgrade.js
import { execSync } from 'child_process';
import ora from 'ora';
import * as c from 'yoctocolors';
import { log } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function handleUpgrade() {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
  );
  const currentVersion = packageJson.version;

  const spinner = ora('正在检查更新...').start();

  try {
    // 查询 npm registry 获取最新版本
    const output = execSync('npm view wr-ai version', { encoding: 'utf-8', timeout: 10000 }).trim();
    const latestVersion = output;

    if (latestVersion === currentVersion) {
      spinner.succeed(`已是最新版本 ${c.green(currentVersion)}`);
      return;
    }

    spinner.info(`当前版本: ${c.yellow(currentVersion)}，最新版本: ${c.green(latestVersion)}`);
    log.info(`运行 ${c.cyan('npm install -g wr-ai')} 或 ${c.cyan('pnpm add -g wr-ai')} 更新`);
  } catch (error) {
    spinner.fail('检查更新失败，请确认网络连接');
  }
}
```

**Step 2: 在 index.js 中注册 upgrade 命令**

在 `src/index.js` 中添加导入：

```javascript
import { handleUpgrade } from "./commands/upgrade.js";
```

在 `program.parse()` 之前添加：

```javascript
program
  .command("upgrade")
  .description("检查 wr-ai 工具更新")
  .action(handleUpgrade);
```

**Step 3: 手动验证**

Run: `node src/index.js upgrade --help`
Expected: 显示 upgrade 命令的帮助信息

**Step 4: 运行全部测试**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 5: 提交**

```bash
git add src/commands/upgrade.js src/index.js
git commit -m "feat: add upgrade command to check for tool updates"
```

---

### Task 9: 为 update 命令添加 --last 选项

**Files:**
- Modify: `src/commands/update.js`
- Modify: `src/index.js`

**Step 1: 在 index.js 中为 update 注册 --last 选项**

修改 update 命令注册处，添加选项：

```javascript
program
  .command("update")
  .description("更新配置")
  .option("-g, --global", "更新用户目录")
  .option("-p, --platform <platform>", "指定平台目录")
  .option("-l, --last", "使用上次选择（等同于 sync）")
  .action(handleUpdate);
```

**Step 2: 修改 update.js 支持 --last**

在 `src/commands/update.js` 中添加导入：

```javascript
import { getOrigin, getPlatform, saveLastSelection, getLastSelection } from '../lib/config.js';
```

在 `handleUpdate` 函数开头（`const spinner` 之前），添加：

```javascript
  // 如果指定了 --last，委托给 sync 的逻辑
  if (options.last) {
    const { handleSync } = await import('./sync.js');
    return handleSync(options);
  }
```

同时在 `handleUpdate` 的 for 循环之后，catch 之前添加保存选择的逻辑（与 Task 2 中 update.js 的修改一致，如果 Task 2 已添加则此处已有）。

**Step 3: 运行全部测试**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 4: 手动验证**

Run: `node src/index.js update --help`
Expected: 显示 `--last` 选项

**Step 5: 提交**

```bash
git add src/commands/update.js src/index.js
git commit -m "feat: add --last option to update command"
```

---

### Task 10: 最终验证与版本更新

**Files:**
- Modify: `package.json`

**Step 1: 运行全部测试**

Run: `node --test tests/**/*.test.js`
Expected: 全部 PASS

**Step 2: 手动验证所有新命令**

Run: `node src/index.js --help`
Expected: 显示 sync、install、upgrade 等新命令

Run: `node src/index.js sync --help`
Run: `node src/index.js install --help`
Run: `node src/index.js upgrade --help`
Run: `node src/index.js init --help`（应显示 --recommended、--exclude）
Run: `node src/index.js update --help`（应显示 --last）

**Step 3: 更新版本号**

将 `package.json` 中的 `version` 从 `"3.1.1"` 改为 `"3.2.0"`（新功能，非破坏性变更）。

**Step 4: 提交**

```bash
git add package.json
git commit -m "chore: bump version to 3.2.0"
```
