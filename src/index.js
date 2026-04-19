#!/usr/bin/env node

import { Command } from "commander";
import { handleSet } from "./commands/set.js";
import { handleList } from "./commands/list.js";
import { handleAdd } from "./commands/add.js";
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
  .name("wrs")
  .description("一个用于管理 wrs 技能配置的 CLI 工具")
  .version(packageJson.version, "-v, --version", "output the version number");

const setCommand = program.command("set").description("设置 wrs 配置");

setCommand
  .command("github")
  .description("设置 GitHub 远程地址")
  .argument("<url>", "GitHub 仓库地址")
  .action(handleSet);

program
  .command("list")
  .description("列出所有可用技能")
  .action(handleList);

program
  .command("add")
  .description("添加指定技能")
  .argument("<name>", "技能名称")
  .option("-g, --global", "保存到用户目录（自动检测 ~/.claude/、~/.codex/ 等）")
  .option("-p, --platform <platform>", "指定平台目录（如 claude/codex），指定后仅同步该目录")
  .action(handleAdd);

program
  .command("sync")
  .description("同步上次选择的技能")
  .option("-g, --global", "同步全局配置")
  .option("-p, --platform <platform>", "指定平台目录")
  .action(handleSync);

program.parse();
