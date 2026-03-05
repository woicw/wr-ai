#!/usr/bin/env node

import { Command } from "commander";
import { handleSet, handleSetPlatform } from "./commands/set.js";
import { handleInit } from "./commands/init.js";
import { handleList } from "./commands/list.js";
import { handleUpdate } from "./commands/update.js";
import { handleClear } from "./commands/clear.js";
import { handleAdd } from "./commands/add.js";
import { handleReset } from "./commands/reset.js";
import { handleSync } from "./commands/sync.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 package.json 获取版本号
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("wr-ai")
  .description("一个用于管理 AI 模板的 CLI 工具")
  .version(packageJson.version, "-v, --version", "output the version number");

const setCommand = program.command("set").description("设置配置");

setCommand
  .command("github")
  .description("设置 GitHub 远程地址")
  .argument("<url>", "GitHub 仓库地址")
  .action(handleSet);

setCommand
  .command("platform")
  .description("设置平台名称（目录名）")
  .argument("<platform>", "平台名称（如 claude，将保存在 .claude/ 目录）")
  .action(handleSetPlatform);

const initCommand = program
  .command("init")
  .description("初始化配置到当前目录")
  .argument("[type]", "配置类型 (command/skill/agent/hook/mcp/lsp)")
  .option("-a, --all", "初始化所有配置")
  .option("-g, --global", "保存到用户目录（自动检测 ~/.claude/、~/.codex/ 等）")
  .option("-p, --platform <platform>", "指定平台目录（如 claude/codex），指定后仅同步该目录")
  .action(handleInit);

program
  .command("list")
  .description("列出所有可用配置")
  .argument("[type]", "配置类型 (command/skill/agent/hook/mcp/lsp)")
  .action(handleList);

program
  .command("add")
  .description("添加指定的配置项（command/skill/agent/hook/mcp/lsp）")
  .argument("<name>", "配置名称，支持 <type>:<name> 格式（如 mcp:server-name）")
  .option("-g, --global", "保存到用户目录（自动检测 ~/.claude/、~/.codex/ 等）")
  .option("-p, --platform <platform>", "指定平台目录（如 claude/codex），指定后仅同步该目录")
  .action(handleAdd);

program
  .command("update")
  .description("更新配置")
  .option("-g, --global", "更新用户目录（自动检测 ~/.claude/、~/.codex/ 等）")
  .option("-p, --platform <platform>", "指定平台目录（如 claude/codex），指定后仅同步该目录")
  .action(handleUpdate);

program
  .command("clear")
  .description("删除 .wr-ai 文件夹（包括配置和模板）")
  .option("-y, --yes", "跳过确认提示")
  .action(handleClear);

program
  .command("reset")
  .description("重置指定的文件夹或文件")
  .argument("<target>", "文件夹名（commands/skills/agents/hooks）或文件名（.mcp.json/.lsp.json）")
  .option("-g, --global", "重置用户目录 (~/.claude/) 下的文件")
  .option("-y, --yes", "跳过确认提示")
  .action(handleReset);

program
  .command("sync")
  .description("同步上次选择的配置（无需重新选择）")
  .option("-g, --global", "同步全局配置")
  .option("-p, --platform <platform>", "指定平台目录")
  .action(handleSync);

program.parse();
