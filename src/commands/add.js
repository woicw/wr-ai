import { getOrigin, getPlatform } from "../lib/config.js";
import { ensureClaudeDir, updateGitignore } from "../lib/filesystem.js";
import { resolveSource } from "../lib/source.js";
import ora from "ora";
import fs from "fs";
import path from "path";
import { log } from "../utils/logger.js";
import {
  addSingleFileConfig,
  addSingleSkill,
  readJsonConfig,
  addMcpServers,
  addLspServices,
} from "../utils/merger.js";
import { normalizeType } from "../utils/constants.js";

// 列出可用的配置项
function listAvailableItems(sourcePath, filterType, mcpServers, lspServices) {
  const dirs = {
    command: { dir: path.join(sourcePath, "commands"), ext: ".md", label: "commands" },
    skill: { dir: path.join(sourcePath, "skills"), ext: null, label: "skills" },
    agent: { dir: path.join(sourcePath, "agents"), ext: ".md", label: "agents" },
    hook: { dir: path.join(sourcePath, "hooks"), ext: ".json", label: "hooks" },
  };

  for (const [type, { dir, ext, label }] of Object.entries(dirs)) {
    if (filterType && filterType !== type) continue;
    if (!fs.existsSync(dir)) continue;

    let items;
    if (ext) {
      items = fs.readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.replace(ext, ""));
    } else {
      items = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    }

    if (items.length > 0) {
      console.log(`\n可用的 ${label}:`);
      items.forEach((item) => console.log(`  • ${item} 或 ${type}:${item}`));
    }
  }

  if (!filterType || filterType === "mcp") {
    if (mcpServers.length > 0) {
      console.log("\n可用的 MCP 配置:");
      console.log("  • mcp (全部服务器)");
      mcpServers.forEach((s) => console.log(`  • mcp:${s}`));
    }
  }

  if (!filterType || filterType === "lsp") {
    if (lspServices.length > 0) {
      console.log("\n可用的 LSP 配置:");
      console.log("  • lsp (全部服务)");
      lspServices.forEach((s) => console.log(`  • lsp:${s}`));
    }
  }
}

/**
 * 完成添加后的公共收尾逻辑
 */
function afterAdd(isGlobal, platform) {
  if (updateGitignore(process.cwd(), isGlobal, platform)) {
    log.info(`已添加 .${platform} 到 .gitignore`);
  }
}

export async function handleAdd(name, options = {}) {
  if (!name) {
    log.error("请指定要添加的配置名称，格式: <name> 或 <type>:<name>");
    log.info("支持的 type: command, skill, agent, hook, mcp, lsp");
    process.exit(1);
  }

  const origin = getOrigin();
  if (!origin) {
    log.error('请先使用 "wr-ai set github <url>" 设置 GitHub 地址');
    process.exit(1);
  }

  // 解析类型和名称
  let type = null;
  let actualName = name;

  if (name.includes(":")) {
    const parts = name.split(":");
    if (parts.length === 2) {
      type = normalizeType(parts[0]);
      actualName = parts[1];
    }
  }

  const spinner = ora(`正在查找 "${name}"...`).start();

  try {
    const { sourcePath } = await resolveSource(origin, spinner);
    spinner.start(`正在查找 "${name}"...`);

    const isGlobal = options.global || false;
    const platform = getPlatform();
    const claudeDir = ensureClaudeDir(isGlobal, platform);
    const dirName = `.${platform}`;
    const targetPathPrefix = isGlobal ? `~/${dirName}` : dirName;

    // 源目录路径
    const commandsDir = path.join(sourcePath, "commands");
    const skillsDir = path.join(sourcePath, "skills");
    const agentsDir = path.join(sourcePath, "agents");
    const hooksDir = path.join(sourcePath, "hooks");
    const mcpFile = path.join(sourcePath, ".mcp.json");
    const lspFile = path.join(sourcePath, ".lsp.json");

    // 读取 MCP/LSP 服务器列表（用于提示和查找）
    const { keys: mcpServers } = readJsonConfig(mcpFile, "mcpServers");
    const { keys: lspServices } = readJsonConfig(lspFile);

    // ========== 指定了类型的情况 ==========
    if (type) {
      const result = addByType(type, actualName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        claudeDir, targetPathPrefix, spinner, mcpServers, lspServices,
      });

      if (result) {
        afterAdd(isGlobal, platform);
        return;
      }

      // 未找到：列出该类型的可用项
      listAvailableItems(sourcePath, type, mcpServers, lspServices);
      process.exit(1);
    }

    // ========== 未指定类型，按优先级自动检测 ==========
    // 1. command
    if (addSingleFileConfig({ srcDir: commandsDir, name: actualName, ext: ".md", claudeDir, subDir: "commands" })) {
      spinner.succeed(`已添加 command: ${actualName} → ${targetPathPrefix}/commands/${actualName}.md`);
      afterAdd(isGlobal, platform);
      return;
    }

    // 2. skill
    if (addSingleSkill(skillsDir, actualName, claudeDir)) {
      spinner.succeed(`已添加 skill: ${actualName} → ${targetPathPrefix}/skills/${actualName}/`);
      afterAdd(isGlobal, platform);
      return;
    }

    // 3. agent
    if (addSingleFileConfig({ srcDir: agentsDir, name: actualName, ext: ".md", claudeDir, subDir: "agents" })) {
      spinner.succeed(`已添加 agent: ${actualName} → ${targetPathPrefix}/agents/${actualName}.md`);
      afterAdd(isGlobal, platform);
      return;
    }

    // 4. hook
    if (addSingleFileConfig({ srcDir: hooksDir, name: actualName, ext: ".json", claudeDir, subDir: "hooks" })) {
      spinner.succeed(`已添加 hook: ${actualName} → ${targetPathPrefix}/hooks/${actualName}.json`);
      afterAdd(isGlobal, platform);
      return;
    }

    // 5. mcp（单个服务器名或 "mcp" 全部）
    if (fs.existsSync(mcpFile)) {
      if (mcpServers.includes(actualName)) {
        const { success } = addMcpServers(mcpFile, claudeDir, actualName);
        if (success) {
          spinner.succeed(`已添加 MCP 服务器: ${actualName} → ${targetPathPrefix}/.mcp.json`);
          afterAdd(isGlobal, platform);
          return;
        }
      }
      if (actualName === "mcp") {
        addMcpServers(mcpFile, claudeDir, null);
        spinner.succeed(`已添加 MCP 配置 → ${targetPathPrefix}/.mcp.json`);
        afterAdd(isGlobal, platform);
        return;
      }
    }

    // 6. lsp（单个服务名或 "lsp" 全部）
    if (fs.existsSync(lspFile)) {
      if (lspServices.includes(actualName)) {
        const { success } = addLspServices(lspFile, claudeDir, actualName);
        if (success) {
          spinner.succeed(`已添加 LSP 服务: ${actualName} → ${targetPathPrefix}/.lsp.json`);
          afterAdd(isGlobal, platform);
          return;
        }
      }
      if (actualName === "lsp") {
        addLspServices(lspFile, claudeDir, null);
        spinner.succeed(`已添加 LSP 配置 → ${targetPathPrefix}/.lsp.json`);
        afterAdd(isGlobal, platform);
        return;
      }
    }

    // 未找到
    spinner.fail(`未找到 "${name}"，请检查名称是否正确`);
    listAvailableItems(sourcePath, null, mcpServers, lspServices);
    process.exit(1);
  } catch (error) {
    if (
      error.name === "CancelError" ||
      error.name === "ExitPromptError" ||
      error.message?.includes("SIGINT") ||
      error.message?.includes("cancel") ||
      error.message?.includes("取消") ||
      error.message?.includes("操作已取消")
    ) {
      spinner.stop();
      log.info("操作已取消");
      process.exit(0);
    }

    spinner.fail(`添加失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 按指定类型添加配置
 * @returns {boolean} 是否成功
 */
function addByType(type, name, ctx) {
  const {
    commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
    claudeDir, targetPathPrefix, spinner, mcpServers, lspServices,
  } = ctx;

  switch (type) {
    case "command": {
      if (!addSingleFileConfig({ srcDir: commandsDir, name, ext: ".md", claudeDir, subDir: "commands" })) {
        spinner.fail(`未找到 command: ${name}`);
        return false;
      }
      spinner.succeed(`已添加 command: ${name} → ${targetPathPrefix}/commands/${name}.md`);
      return true;
    }

    case "skill": {
      if (!addSingleSkill(skillsDir, name, claudeDir)) {
        spinner.fail(`未找到 skill: ${name}`);
        return false;
      }
      spinner.succeed(`已添加 skill: ${name} → ${targetPathPrefix}/skills/${name}/`);
      return true;
    }

    case "agent": {
      if (!addSingleFileConfig({ srcDir: agentsDir, name, ext: ".md", claudeDir, subDir: "agents" })) {
        spinner.fail(`未找到 agent: ${name}`);
        return false;
      }
      spinner.succeed(`已添加 agent: ${name} → ${targetPathPrefix}/agents/${name}.md`);
      return true;
    }

    case "hook": {
      if (!addSingleFileConfig({ srcDir: hooksDir, name, ext: ".json", claudeDir, subDir: "hooks" })) {
        spinner.fail(`未找到 hook: ${name}`);
        return false;
      }
      spinner.succeed(`已添加 hook: ${name} → ${targetPathPrefix}/hooks/${name}.json`);
      return true;
    }

    case "mcp": {
      if (!fs.existsSync(mcpFile)) {
        spinner.fail("未找到 .mcp.json");
        return false;
      }
      // mcp: (空名称) → 全部; mcp:server-name → 单个
      const serverName = name === "" ? null : name;
      const { success } = addMcpServers(mcpFile, claudeDir, serverName);
      if (!success) {
        spinner.fail(`未找到 MCP 服务器: ${name}`);
        if (mcpServers.length > 0) {
          console.log("\n可用的 MCP 服务器:");
          mcpServers.forEach((s) => console.log(`  • mcp:${s}`));
        }
        return false;
      }
      const label = serverName ? `MCP 服务器: ${name}` : "MCP 配置";
      spinner.succeed(`已添加 ${label} → ${targetPathPrefix}/.mcp.json`);
      return true;
    }

    case "lsp": {
      if (!fs.existsSync(lspFile)) {
        spinner.fail("未找到 .lsp.json");
        return false;
      }
      const serviceName = name === "" ? null : name;
      const { success } = addLspServices(lspFile, claudeDir, serviceName);
      if (!success) {
        spinner.fail(`未找到 LSP 服务: ${name}`);
        if (lspServices.length > 0) {
          console.log("\n可用的 LSP 服务:");
          lspServices.forEach((s) => console.log(`  • lsp:${s}`));
        }
        return false;
      }
      const label = serviceName ? `LSP 服务: ${name}` : "LSP 配置";
      spinner.succeed(`已添加 ${label} → ${targetPathPrefix}/.lsp.json`);
      return true;
    }

    default:
      spinner.fail(`未知的类型: ${type}`);
      log.info("支持的类型: command, skill, agent, hook, mcp, lsp");
      process.exit(1);
  }
}
