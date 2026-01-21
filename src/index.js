#!/usr/bin/env node

import { Command } from "commander";
import { handleSet } from "./commands/set.js";
import { handleInit } from "./commands/init.js";
import { handleList } from "./commands/list.js";
import { handleUpdate } from "./commands/update.js";
import { handleClear } from "./commands/clear.js";
import { handleAdd } from "./commands/add.js";
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
  .version(packageJson.version);

const setCommand = program.command("set").description("设置配置");

setCommand
  .command("github")
  .description("设置 GitHub 远程地址")
  .argument("<url>", "GitHub 仓库地址")
  .action(handleSet);

program
  .command("init")
  .description("初始化配置到当前目录")
  .action(handleInit);

program.command("list").description("列出所有可用配置").action(handleList);

program
  .command("add")
  .description("添加指定的 command 或 skill")
  .argument("<name>", "command 或 skill 名称")
  .action(handleAdd);

program.command("update").description("更新配置").action(handleUpdate);

program
  .command("clear")
  .description("删除 .wr-ai 文件夹（包括配置和模板）")
  .action(handleClear);

program.parse();
