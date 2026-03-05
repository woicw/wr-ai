# wr-ai 便利性功能优化设计

## 设计目标

提升 wr-ai 的用户体验，减少重复操作，提供更智能的默认行为。

## 核心功能

### 1. 记住上次选择（方案 B）

**问题**：每次 `update` 都要重新选择配置，重复劳动

**解决方案**：
- 自动保存用户的配置选择
- 区分全局模式（`-g`）和本地模式
- 提供快速同步命令

**配置存储**：

全局配置：`~/.wr-ai/config.json`
```json
{
  "origin": "https://github.com/woicw/ai-config.git",
  "platform": "claude",
  "lastSelection": {
    "commands": ["commit", "review"],
    "skills": ["code-review", "mcp-builder"],
    "agents": [],
    "hooks": [],
    "mcpServers": ["plugin-db"],
    "lspServices": ["typescript"],
    "timestamp": "2026-03-05T12:00:00Z"
  }
}
```

本地配置：`<项目>/.wr-ai/config.json`
```json
{
  "lastSelection": {
    "commands": ["deploy"],
    "skills": ["frontend-design"],
    "agents": ["test-runner"],
    "hooks": [],
    "mcpServers": [],
    "lspServices": [],
    "timestamp": "2026-03-05T12:00:00Z"
  }
}
```

**行为**：
- `wr-ai init` / `wr-ai add` 执行后自动保存选择
- 根据 `-g` 参数决定保存位置
- `wr-ai sync` 使用保存的选择快速更新

### 2. 快捷命令别名（方案 C）

**新增命令**：

| 命令 | 等价于 | 说明 |
|------|--------|------|
| `wr-ai sync` | `wr-ai update --last` | 同步上次选择的配置 |
| `wr-ai sync -g` | `wr-ai update --last -g` | 同步全局配置 |
| `wr-ai install <name>` | `wr-ai add <name>` | 更直观的安装命令 |
| `wr-ai upgrade` | - | 检查工具更新 |

**设计理念**：
- `sync` - 更符合"同步配置"的语义
- `install` - 更符合包管理器的习惯
- `upgrade` - 工具自身的更新

### 3. 批量操作增强（方案 E）

**推荐配置**：
```bash
wr-ai init --recommended
```
预定义推荐列表（常用配置，排除复杂的 mcp/lsp）

**排除选项**：
```bash
wr-ai init --exclude mcp,lsp
wr-ai init --all --exclude hooks
```
灵活控制安装范围

**最新配置**：
```bash
wr-ai add @latest       # 最近更新的 1 个
wr-ai add @latest:5     # 最近更新的 5 个
```
基于 git 提交时间排序

## 用户体验流程

### 首次使用
```bash
wr-ai list                    # 查看可用配置
wr-ai init --recommended      # 安装推荐配置
# 自动保存选择到 .wr-ai/config.json
```

### 日常更新
```bash
wr-ai sync                    # 一键更新，无交互
# 或
wr-ai update                  # 重新选择（如果想改变配置）
```

### 快速安装
```bash
wr-ai install code-review     # 更直观的命令名
wr-ai install @latest         # 安装最新配置
```

## 技术实现

### 配置管理

**扩展 `src/lib/config.js`**：
- `getLastSelection(isGlobal)` - 获取上次选择
- `saveLastSelection(selection, isGlobal)` - 保存选择
- `getLocalConfigPath(cwd)` - 获取本地配置路径

**本地配置路径**：
- 全局：`~/.wr-ai/config.json`
- 本地：`<项目>/.wr-ai/config.json`

### 命令实现

**新增命令**：
- `src/commands/sync.js` - 同步命令
- `src/commands/upgrade.js` - 升级命令

**修改命令**：
- `src/commands/init.js` - 添加 `--recommended`、`--exclude` 支持
- `src/commands/add.js` - 添加 `@latest` 支持，添加 `install` 别名
- `src/commands/update.js` - 添加 `--last` 支持

**命令注册**（`src/index.js`）：
```javascript
program
  .command('sync')
  .description('同步上次选择的配置')
  .option('-g, --global', '全局模式')
  .action(handleSync);

program
  .command('install <name>')
  .description('安装配置（add 的别名）')
  .option('-g, --global', '全局模式')
  .option('-p, --platform <name>', '指定平台')
  .action(handleAdd);  // 复用 add 的处理函数

program
  .command('upgrade')
  .description('检查工具更新')
  .action(handleUpgrade);
```

### 推荐配置列表

**定义在 `src/utils/constants.js`**：
```javascript
export const RECOMMENDED_CONFIGS = {
  commands: ['commit', 'review'],
  skills: ['code-review'],
  agents: [],
  hooks: [],
  mcpServers: [],
  lspServices: []
};
```

### @latest 实现

**在 `src/commands/add.js` 中**：
- 检测 `@latest` 或 `@latest:N` 模式
- 使用 git log 获取最近修改的文件
- 按时间排序，取前 N 个

## 向后兼容性

**完全兼容**：
- 所有现有命令保持不变
- 新功能为可选增强
- 配置文件向后兼容（新增字段不影响旧版本）

**迁移**：
- 无需迁移，自动兼容
- 首次使用新功能时自动创建 `lastSelection` 字段

## 测试计划

### 单元测试
- 配置读写测试（全局/本地）
- 选择保存/加载测试
- @latest 解析测试

### 集成测试
- `sync` 命令端到端测试
- `install` 别名测试
- `--recommended` 和 `--exclude` 测试

### 手动测试
```bash
# 测试记住选择
wr-ai init
wr-ai sync              # 应该使用上次选择

# 测试全局/本地分离
wr-ai init -g
wr-ai sync -g           # 应该使用全局选择
wr-ai sync              # 应该使用本地选择

# 测试新命令
wr-ai install code-review
wr-ai init --recommended
wr-ai init --exclude mcp
wr-ai add @latest
```

## 实施优先级

### 第一阶段（核心功能）
1. 配置存储扩展（lastSelection）
2. `sync` 命令实现
3. 自动保存选择

### 第二阶段（便利功能）
4. `install` 别名
5. `--recommended` 选项
6. `--exclude` 选项

### 第三阶段（高级功能）
7. `@latest` 支持
8. `upgrade` 命令

## 预期收益

- **减少操作步骤**：日常更新从 3 步（运行命令 → 选择配置 → 确认）减少到 1 步（`wr-ai sync`）
- **降低认知负担**：不需要记住上次安装了什么
- **提升灵活性**：更多批量操作选项
- **改善新手体验**：`--recommended` 提供开箱即用的配置

## 风险评估

**低风险**：
- 所有功能向后兼容
- 配置文件扩展不影响现有功能
- 新命令为独立实现

**潜在问题**：
- 本地配置文件可能被误删（解决：提供恢复机制）
- 全局/本地配置可能混淆（解决：清晰的提示信息）

## 总结

这个设计方案通过三个核心功能（记住选择、快捷命令、批量操作）显著提升了 wr-ai 的便利性，同时保持了完全的向后兼容性。实施后，用户的日常操作将更加高效和直观。
