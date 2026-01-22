# wr-ai

一个用于管理 Claude AI 配置的命令行工具，支持 Commands、Skills、Agents、Hooks、MCP 和 LSP 配置。

## ✨ 特性

- 🚀 **快速配置**: 从 GitHub 仓库快速获取和安装 Claude 配置
- 📦 **完整支持**: 支持 Commands、Skills、Agents、Hooks、MCP 和 LSP 配置
- 🔄 **智能合并**: 合并模式保留本地独有文件，避免数据丢失
- 🎨 **美观界面**: 彩色交互式命令行界面
- ⚡ **批量操作**: 支持批量添加、更新配置
- 🔌 **细粒度控制**: 支持选择单个 MCP 服务器和 LSP 服务
- 🔒 **自动保护**: 自动更新 `.gitignore`，保护配置隐私

## 📦 安装

```bash
# 使用 npm
npm install -g wr-ai

# 使用 pnpm
pnpm add -g wr-ai

# 使用 yarn
yarn global add wr-ai
```

## 🚀 快速开始

### 1. 设置 GitHub 仓库地址

```bash
wr-ai set github <仓库地址>
```

例如：

```bash
wr-ai set github https://github.com/woicw/ai-config.git
# 或简写形式
wr-ai set github woicw/ai-config
```

### 2. 查看可用配置

```bash
wr-ai list
```

### 3. 初始化配置

```bash
wr-ai init
```

交互式选择要添加的 Commands 和 Skills。

### 4. 快速添加单个配置

```bash
# 添加 command
wr-ai add commit

# 添加 skill
wr-ai add mcp-builder

# 添加 agent
wr-ai add security-reviewer

# 添加 hook
wr-ai add hooks

# 添加 MCP 配置（合并所有服务器）
wr-ai add mcp

# 添加 LSP 配置（合并所有服务）
wr-ai add lsp
```

### 5. 更新配置

```bash
wr-ai update
```

## 📖 命令详解

### `set github <url>`

设置 GitHub 远程仓库地址，用于获取配置源。

```bash
wr-ai set github https://github.com/user/repo.git
```

**说明**:

- 配置保存在 `~/.wr-ai/config.json`
- 默认仓库: `https://github.com/woicw/ai-config.git`
- 支持完整 URL 或简写形式（如 `user/repo`）

### `init`

交互式初始化配置到当前目录的 `.claude/` 文件夹。

**功能**:

- 默认从 `awesome-claude/` 目录读取配置
- 支持按 Commands、Skills、Agents、Hooks、MCP、LSP 分组选择
- 支持批量选择（ALL、ALL Commands、ALL Skills 等）
- 支持选择单个 MCP 服务器和 LSP 服务
- 合并模式：保留本地独有文件，覆盖已存在的文件
- 自动更新 `.gitignore`

**选择界面**:

```
? 请选择要添加的配置（空格选择，回车确认）:
  ◻ ⚡ ALL - 复制所有配置
  ◻ 🔧 ALL Commands          (全部 2 个)
     ◻ ○ commit
     ◻ ○ review
  ◻ 🧠 ALL Skills            (全部 4 个)
     ◻ ○ code-review
     ◻ ○ mcp-builder
  ◻ 🤖 ALL Agents            (全部 3 个)
     ◻ ○ security-reviewer
     ◻ ○ performance-tester
  ◻ 🪝 ALL Hooks             (全部 2 个)
     ◻ ○ hooks
     ◻ ○ security-hooks
  ◻ 🔌 ALL MCP Servers       (全部 2 个)
     ◻ ○ plugin-database
     ◻ ○ plugin-api-client
  ◻ 💻 ALL LSP Services      (全部 2 个)
     ◻ ○ go
     ◻ ○ python
```

**合并行为**:

- 远程存在、本地不存在 → **新增**
- 远程存在、本地也存在 → **更新**（覆盖）
- 本地存在、远程不存在 → **保留**本地文件

### `list`

列出所有可用的配置项，包括 Commands、Skills、Agents、Hooks、MCP 和 LSP。

**输出示例**:

```
📦 awesome-claude

🔧 Commands (2)

├─ commit
└─ review

🧠 Skills (4)

├─ code-review
├─ mcp-builder
├─ react-webapp-builder
└─ skill-creator

🤖 Agents (3)

├─ security-reviewer
├─ performance-tester
└─ compliance-checker

🪝 Hooks (2)

├─ hooks
└─ security-hooks

🔌 MCP Servers (2)

├─ plugin-database
└─ plugin-api-client

💻 LSP Services (2)

├─ go
└─ python

  使用方式:
    wr-ai add <name>  添加指定配置（command/skill/agent/hook/mcp/lsp）
    wr-ai init        交互式选择添加
```

### `add <name>`

快速添加指定的配置项。

```bash
# 添加 command
wr-ai add commit

# 添加 skill
wr-ai add mcp-builder

# 添加 agent
wr-ai add security-reviewer

# 添加 hook
wr-ai add hooks

# 添加 MCP 配置（合并所有服务器）
wr-ai add mcp

# 添加 LSP 配置（合并所有服务）
wr-ai add lsp
```

**行为**:

- 自动识别配置类型：
  - `commands/<name>.md` → command
  - `skills/<name>/` → skill
  - `agents/<name>.md` → agent
  - `hooks/<name>.json` → hook
  - `.mcp.json` → MCP 配置（使用 `mcp` 作为名称）
  - `.lsp.json` → LSP 配置（使用 `lsp` 作为名称）
- 复制到对应的 `.claude/` 子目录
- MCP 和 LSP 配置会智能合并，保留本地独有的配置
- 如果未找到，会列出所有可用的选项

### `update`

更新已安装的配置。

**功能**:

- 与 `init` 相同的交互式选择界面
- 合并模式更新，保留本地独有文件
- 显示新增和更新的文件数量

### `clear`

清除本地缓存（包括配置和模板）。

```bash
wr-ai clear
```

**说明**:

- 删除 `~/.wr-ai/` 目录
- 不影响项目中的 `.claude/` 目录

## 📁 目录结构

### 远程仓库结构

```
ai-config/
├── awesome-claude/          # 默认配置源
│   ├── commands/            # Commands（.md 文件）
│   │   ├── commit.md
│   │   └── review.md
│   ├── skills/              # Skills（目录）
│   │   ├── code-review/
│   │   ├── mcp-builder/
│   │   └── react-webapp-builder/
│   ├── agents/              # Agents（.md 文件）
│   │   ├── security-reviewer.md
│   │   └── performance-tester.md
│   ├── hooks/               # Hooks（.json 文件）
│   │   ├── hooks.json
│   │   └── security-hooks.json
│   ├── .mcp.json            # MCP 服务器配置
│   └── .lsp.json            # LSP 服务配置
├── .gitignore
└── package.json
```

**MCP 配置格式** (`.mcp.json`):

```json
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data"
      }
    },
    "plugin-api-client": {
      "command": "npx",
      "args": ["@company/mcp-server", "--plugin-mode"],
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

**LSP 配置格式** (`.lsp.json`):

```json
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": {
      ".go": "go"
    }
  },
  "python": {
    "command": "pylsp",
    "args": ["--stdio"]
  }
}
```

### 本地输出结构

所有配置都会复制到项目根目录的 `.claude/` 文件夹：

```
项目根目录/
└── .claude/
    ├── commands/            # Commands
    │   ├── commit.md
    │   └── review.md
    ├── skills/              # Skills
    │   └── code-review/
    │       ├── README.md
    │       └── SKILL.md
    ├── agents/              # Agents
    │   ├── security-reviewer.md
    │   └── performance-tester.md
    ├── hooks/               # Hooks
    │   ├── hooks.json
    │   └── security-hooks.json
    ├── .mcp.json            # MCP 配置（合并后）
    └── .lsp.json            # LSP 配置（合并后）
```

## 🔧 配置

配置文件位置: `~/.wr-ai/config.json`

```json
{
  "origin": "https://github.com/woicw/ai-config.git"
}
```

## 💡 使用场景

1. **初始化新项目**: 使用 `wr-ai init` 快速添加常用的配置项
2. **添加单个功能**: 使用 `wr-ai add <name>` 快速添加特定配置
3. **更新配置**: 使用 `wr-ai update` 同步远程最新配置
4. **查看可用配置**: 使用 `wr-ai list` 浏览所有可用选项
5. **选择性添加 MCP/LSP**: 在 `init` 或 `update` 中选择单个服务器/服务，而不是全部

## 🔌 MCP 和 LSP 配置说明

### MCP 配置

- **全部添加**: 选择 "ALL MCP Servers" 会合并所有服务器配置
- **单个添加**: 选择 `mcp:server-name` 只会添加该服务器配置
- **合并规则**: 远程配置覆盖本地同名服务器，保留本地独有的服务器

### LSP 配置

- **全部添加**: 选择 "ALL LSP Services" 会合并所有服务配置
- **单个添加**: 选择 `lsp:service-name` 只会添加该服务配置
- **合并规则**: 远程配置覆盖本地同名服务，保留本地独有的服务

## 🛠️ 技术栈

- **Node.js**: ES Modules
- **Commander**: 命令行参数解析
- **@clack/prompts**: 交互式命令行界面
- **ora**: 加载动画
- **yoctocolors**: 终端颜色输出

## 📝 开发

```bash
# 克隆仓库
git clone https://github.com/woicw/wr-ai.git
cd wr-ai

# 安装依赖
pnpm install

# 本地开发（需要全局链接）
pnpm link --global
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**提示**: 使用 `wr-ai --help` 查看所有可用命令。
