# wrs

从 GitHub 仓库一键同步 AI skills，快速装备你的 Claude / Codex 工作区。

## 安装

```bash
npm install -g wrs
# 或
pnpm add -g wrs
```

### 前置要求

- **本地 skills 专用**：如果仓库中所有 skills 均标记为 `source: "local"`，则无需额外依赖。
- **包含远程 skills**：如果源仓库中有任何远程 skills（`source: "owner/repo"`），则需要可用的 Node.js 和 npx 环境，以便首次物化时使用。

## 快速开始

```bash
# 1. 设置远程仓库（默认已指向 woicw/ai-config）
wrs set github <仓库地址>

# 2. 查看可用 skills
wrs list

# 3. 添加单个 skill
wrs add code-review

# 4. 同步上次选择；如果还没有历史记录，会进入交互多选
wrs sync
```

## 破坏性变更

- 新版 CLI 名称为 `wrs`
- 只支持 `skills`
- 配置目录改为 `~/.wrs` 和 `<project>/.wrs`
- 不兼容旧版 `.wr-ai` 配置
- 已移除 `init`、`update`、`install`、`upgrade`、`reset`、`clear`

## 命令一览

| 命令 | 说明 |
|------|------|
| `wrs list` | 列出远程仓库中的可用 skills |
| `wrs add <name>` | 添加单个 skill |
| `wrs sync` | 同步上次选择的 skills；首次使用或历史失效时进入交互选择 |
| `wrs sync --refresh` | 忽略缓存，从上游重新拉取所有远程 skill |
| `wrs cache clean` | 清空本地 skill 缓存 |
| `wrs set github <url>` | 设置 GitHub 仓库地址 |

## 源仓库要求

`wrs` 从源仓库的 `awesome-claude/skills.manifest.json` 读取 skill 清单：

- `source: "local"` 的条目直接从源仓库 clone 复制
- 其他条目（`source: "owner/repo"` + `skillId`）由 `wrs` 在第一次 sync 时通过 `npx skills add` 物化到 `~/.wrs/cache/skills/<name>/`，后续命中缓存
- 如果 manifest 中任何条目是远程的，用户机器需要可用的 Node/npx

### 通用选项

- `-g, --global`：同步到用户目录下已存在的 AI 工作区目录（如 `~/.claude/`、`~/.codex/`）
- `-p, --platform <platform>`：指定平台目录名，只同步到对应目录（如 `claude`、`codex`）

## 命令详解

### `wrs list`

输出远程仓库中的全部 skills：

```bash
wrs list
```

如果还没有配置 GitHub 地址，CLI 会提示先运行：

```bash
wrs set github <url>
```

### `wrs add`

添加单个 skill 到当前项目或全局 AI 工作区：

```bash
wrs add code-review
wrs add nextjs -g
wrs add react --platform codex
```

如果 skill 不存在，CLI 会报错并列出当前可用 skills。

### `wrs sync`

优先同步上次选择的 skills；如果没有历史记录，或历史记录中的 skill 已从远程仓库移除，则自动回退到交互式多选：

```bash
wrs sync
wrs sync -g
wrs sync --platform claude
```

这是新版 `wrs` 的重复工作流入口。日常更新直接运行 `wrs sync` 即可。

### `wrs set github`

设置远程 GitHub 仓库地址：

```bash
wrs set github https://github.com/user/repo.git
wrs set github user/repo
```

## 工作目录与输出

`wrs` 只同步 `skills/` 内容，并会优先写入已存在的 AI 工作区目录：

- 项目模式：优先检测当前项目下已存在的 `/.claude/`、`/.codex/` 等目录
- 全局模式：优先检测用户目录下已存在的 `~/.claude/`、`~/.codex/` 等目录
- 如果未检测到常用目录，则回退到配置中的平台目录（默认 `.claude/`）

同步结果示例：

```text
.claude/
└── skills/
    └── code-review/
```

## 配置文件

全局配置文件位于 `~/.wrs/config.json`，项目本地配置文件位于 `<project>/.wrs/config.json`。

示例：

```json
{
  "origin": "https://github.com/woicw/ai-config.git",
  "platform": "claude",
  "lastSelection": {
    "skills": ["code-review", "nextjs"],
    "timestamp": "2026-04-19T12:00:00.000Z"
  }
}
```

`lastSelection` 只保存 skills 历史，用于后续的 `wrs sync`。

## 本地缓存

远程 skill 物化后保存在用户目录：

```text
~/.wrs/
├── config.json               # 全局配置 + lastSelection
├── templates/                # 源仓库 git clone
└── cache/
    └── skills/<skillId>/     # 远程 skill 物化缓存
```

`wrs sync --refresh` 会重建缓存；`wrs cache clean` 会清空整个 `~/.wrs/cache/`。

## 合并行为

同步 skill 目录时遵循以下规则：

| 远程 | 本地 | 结果 |
|------|------|------|
| 存在 | 不存在 | 新增 |
| 存在 | 存在 | 更新 |

`wrs` 不再处理 commands、agents、hooks、MCP、LSP 等旧版内容；这是一次明确的 skills-only 破坏性升级。
