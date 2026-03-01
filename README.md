# wr-ai

从 GitHub 仓库一键拉取 AI 配置（Commands / Skills / Agents / Hooks / MCP / LSP），快速装备你的 Claude 工作区。

## 安装

```bash
npm install -g wr-ai
# 或
pnpm add -g wr-ai
```

## 快速开始

```bash
# 1. 设置配置源（默认已指向 woicw/ai-config）
wr-ai set github <仓库地址>

# 2. 查看可用配置
wr-ai list

# 3. 交互式选择并安装
wr-ai init

# 4. 或直接添加单个配置
wr-ai add code-review
wr-ai add mcp:server-name
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `wr-ai list [type]` | 列出远程可用配置 |
| `wr-ai add <name>` | 添加单个配置项 |
| `wr-ai init [type]` | 交互式批量选择安装 |
| `wr-ai update` | 交互式更新已有配置 |
| `wr-ai reset <target>` | 重置指定文件夹或文件 |
| `wr-ai set github <url>` | 设置 GitHub 仓库地址 |
| `wr-ai set platform <name>` | 设置平台目录名（默认 `claude`） |
| `wr-ai clear` | 清除本地缓存（`~/.wr-ai/`） |

### 通用选项

- `-g, --global` — 操作目标改为用户目录（`init` / `add` / `update` 会自动检测 `~/.claude/`、`~/.codex/` 等已存在目录）
- `-p, --platform <name>` — 指定平台目录（如 `claude` / `codex`），指定后只同步该目录（`init` / `add` / `update`）
- `-y, --yes` — 跳过确认提示（`clear` / `reset`）
- `-a, --all` — 跳过交互直接安装全部（`init`）

## 命令详解

### `list`

直接输出所有类型的可用配置，无需交互。可按类型过滤：

```bash
wr-ai list           # 全部
wr-ai list command   # 仅 commands
wr-ai list mcp      # 仅 MCP 服务器
```

支持类型别名：`cmd` = `command`，`commands` = `command`，`skills` = `skill` 等。

### `add`

添加单个配置项，自动检测类型：

```bash
wr-ai add commit              # 自动匹配 command/skill/agent/hook
wr-ai add mcp                 # 添加所有 MCP 服务器
wr-ai add mcp:plugin-db       # 添加单个 MCP 服务器
wr-ai add lsp:python          # 添加单个 LSP 服务
wr-ai add command:review      # 显式指定类型
wr-ai add commit -g           # 安装到全局已存在 AI 目录（如 ~/.claude/、~/.codex/）
wr-ai add commit --platform codex   # 仅同步到 .codex/（或 ~/.codex/）
```

找不到时会列出所有可用项供参考。MCP 配置保存时如果检测到占位符（`${API_KEY}`、`<TOKEN>` 等），会自动提示需要手动配置。

### `init`

交互式多选安装，支持按类型过滤和全量安装：

```bash
wr-ai init              # 先选类型，再选配置
wr-ai init skill        # 只选 skill
wr-ai init --all        # 安装全部，跳过交互
wr-ai init --all -g     # 全部安装到全局已存在 AI 目录
wr-ai init --all --platform claude  # 指定只安装到 .claude/
```

选择界面示例：

```
? 请选择要添加的配置（空格选择，回车确认）:
  ◻ ⚡ ALL - 复制所有配置
  ◻ 🔧 ALL Commands          (2 个命令)
     └─ commit
     └─ review
  ◻ 🧠 ALL Skills            (3 个技能)
     └─ code-review
     └─ mcp-builder
  ◻ 🔌 ALL MCP Servers       (2 个服务器)
     └─ plugin-database
     └─ plugin-api-client
```

### `update`

与 `init` 相同的交互界面，合并模式更新已有配置。默认会同步到当前目录（或 `-g` 的用户目录）下已存在的常用 AI 配置目录；可通过 `--platform` 强制指定单目录。

### `reset`

删除指定的子目录或配置文件：

```bash
wr-ai reset skills          # 删除 .claude/skills/
wr-ai reset .mcp.json       # 删除 .claude/.mcp.json
wr-ai reset skills -g       # 删除 ~/.claude/skills/
wr-ai reset skills -y       # 跳过确认
```

支持的 target：`commands` / `skills` / `agents` / `hooks` / `.mcp.json` / `.lsp.json`

### `clear`

清除工具的全局缓存和配置（`~/.wr-ai/`），不影响项目中的 `.claude/` 目录：

```bash
wr-ai clear          # 需要确认
wr-ai clear -y       # 跳过确认
```

### `set`

```bash
wr-ai set github https://github.com/user/repo.git
wr-ai set github user/repo              # 简写形式
wr-ai set platform cursor               # 配置保存到 .cursor/ 目录
```

## 合并策略

所有安装/更新操作遵循相同的合并规则：

| 远程 | 本地 | 结果 |
|------|------|------|
| 存在 | 不存在 | **新增** |
| 存在 | 存在 | **覆盖** |
| 不存在 | 存在 | **保留** |

MCP / LSP 配置按 server/service 粒度合并，本地独有的 server 不会被删除。

## 目录结构

### 远程仓库

```
ai-config/
└── awesome-claude/          # 配置源（DEFAULT_SOURCE）
    ├── commands/*.md        # 命令
    ├── skills/*/            # 技能（目录）
    ├── agents/*.md          # 代理
    ├── hooks/*.json         # 钩子
    ├── .mcp.json            # MCP 服务器配置
    └── .lsp.json            # LSP 服务配置
```

### 本地输出

```
.claude/                     # 或 .<platform>/
├── commands/*.md
├── skills/*/
├── agents/*.md
├── hooks/*.json
├── .mcp.json
└── .lsp.json
```

默认会优先同步到已存在的常用 AI 目录（如 `.claude/`、`.codex/`，多个目录会同时同步）；若都不存在，则回退到配置中的平台目录（默认 `.claude/`）。全局模式（`-g`）同理在 `~/` 下检测。

## 配置文件

`~/.wr-ai/config.json`：

```json
{
  "origin": "https://github.com/woicw/ai-config.git",
  "platform": "claude"
}
```

## 安全

- **路径验证** — 所有文件操作验证路径，防止路径遍历
- **原子写入** — MCP / LSP 配置使用 tmp + rename
- **自动 .gitignore** — 本地模式自动将同步目标目录（如 `.claude`、`.codex`）加入 `.gitignore`

## 技术栈

- Node.js ESM (>=18)
- [Commander](https://github.com/tj/commander.js) — CLI 框架
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) — 交互式提示
- [ora](https://github.com/sindresorhus/ora) — 加载动画
- [yoctocolors](https://github.com/sindresorhus/yoctocolors) — 终端颜色

## 开发

```bash
git clone https://github.com/woicw/wr-ai.git
cd wr-ai
pnpm install
pnpm link --global
```

```
src/
├── index.js              # CLI 入口
├── commands/             # 命令处理器
│   ├── add.js
│   ├── clear.js
│   ├── init.js
│   ├── list.js
│   ├── reset.js
│   ├── set.js
│   └── update.js
├── lib/                  # 核心库
│   ├── config.js         # 配置管理
│   ├── filesystem.js     # 文件系统操作
│   ├── repository.js     # Git 仓库操作
│   └── source.js         # 配置源解析
└── utils/                # 工具函数
    ├── constants.js      # 常量与类型别名
    ├── logger.js         # 日志
    ├── merger.js         # 配置合并
    ├── parser.js         # 选项解析
    ├── prompts.js        # 交互提示
    └── validator.js      # 路径验证与 JSON 解析
```

## License

MIT
