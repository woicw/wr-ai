import { getOrigin, getPlatform } from "../lib/config.js";
import { resolveTargetDirectories, isValidPlatformName, updateGitignore } from "../lib/filesystem.js";
import { resolveSource } from "../lib/source.js";
import ora from "ora";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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
 * 格式化多目标路径展示
 */
function formatDestinations(targetDirs, relativePath) {
  return targetDirs
    .map((target) => `${target.targetPathPrefix}/${relativePath}`)
    .join(", ");
}

/**
 * 完成添加后的公共收尾逻辑
 */
function afterAddTargets(isGlobal, targetDirs) {
  for (const target of targetDirs) {
    if (updateGitignore(process.cwd(), isGlobal, target.platform)) {
      log.info(`已添加 .${target.platform} 到 .gitignore`);
    }
  }
}

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

      const relativePath = trimmed.slice(relativeSourcePath.length + 1);
      const parts = relativePath.split('/');
      if (parts.length < 2) continue;

      const dir = parts[0];
      const fileName = parts[1];

      let type, name;
      if (dir === 'commands' && fileName.endsWith('.md')) {
        type = 'command';
        name = fileName.replace('.md', '');
      } else if (dir === 'skills') {
        type = 'skill';
        name = fileName;
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

  // 检测 @latest 模式
  const latestArg = parseLatestArg(name);
  if (latestArg.isLatest) {
    const spinner = ora(`正在查找最近更新的 ${latestArg.count} 个配置...`).start();

    try {
      const { sourcePath, repoDir } = await resolveSource(origin, spinner);
      spinner.start(`正在查找最近更新的配置...`);

      const latestConfigs = getLatestConfigs(repoDir, sourcePath, latestArg.count);

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

      const commandsDir = path.join(sourcePath, 'commands');
      const skillsDir = path.join(sourcePath, 'skills');
      const agentsDir = path.join(sourcePath, 'agents');
      const hooksDir = path.join(sourcePath, 'hooks');
      const mcpFile = path.join(sourcePath, '.mcp.json');
      const lspFile = path.join(sourcePath, '.lsp.json');
      const { keys: mcpServers } = readJsonConfig(mcpFile, 'mcpServers');
      const { keys: lspServices } = readJsonConfig(lspFile);

      let allSuccess = true;
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
    const fallbackPlatform = getPlatform();
    if (options.platform && !isValidPlatformName(options.platform)) {
      log.error("平台名称只能包含字母、数字、连字符和下划线");
      process.exit(1);
    }
    const targetDirs = resolveTargetDirectories({
      global: isGlobal,
      platform: options.platform,
      fallbackPlatform,
      cwd: process.cwd(),
    });
    if (targetDirs.length > 1) {
      log.info(`检测到多个 AI 配置目录，将同步到: ${targetDirs.map((t) => t.dirName).join(", ")}`);
    }

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
        targetDirs, spinner, mcpServers, lspServices,
      });

      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }

      // 未找到：列出该类型的可用项
      listAvailableItems(sourcePath, type, mcpServers, lspServices);
      process.exit(1);
    }

    // ========== 未指定类型，按优先级自动检测 ==========
    // 1. command
    const commandPath = path.join(commandsDir, `${actualName}.md`);
    if (fs.existsSync(commandPath)) {
      const result = addByType("command", actualName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        targetDirs, spinner, mcpServers, lspServices,
      });
      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }
      process.exit(1);
    }

    // 2. skill
    const skillPath = path.join(skillsDir, actualName);
    if (fs.existsSync(skillPath) && fs.statSync(skillPath).isDirectory()) {
      const result = addByType("skill", actualName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        targetDirs, spinner, mcpServers, lspServices,
      });
      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }
      process.exit(1);
    }

    // 3. agent
    const agentPath = path.join(agentsDir, `${actualName}.md`);
    if (fs.existsSync(agentPath)) {
      const result = addByType("agent", actualName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        targetDirs, spinner, mcpServers, lspServices,
      });
      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }
      process.exit(1);
    }

    // 4. hook
    const hookPath = path.join(hooksDir, `${actualName}.json`);
    if (fs.existsSync(hookPath)) {
      const result = addByType("hook", actualName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        targetDirs, spinner, mcpServers, lspServices,
      });
      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }
      process.exit(1);
    }

    // 5. mcp（单个服务器名或 "mcp" 全部）
    if (fs.existsSync(mcpFile) && (mcpServers.includes(actualName) || actualName === "mcp")) {
      const serverName = actualName === "mcp" ? "" : actualName;
      const result = addByType("mcp", serverName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        targetDirs, spinner, mcpServers, lspServices,
      });
      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }
      process.exit(1);
    }

    // 6. lsp（单个服务名或 "lsp" 全部）
    if (fs.existsSync(lspFile) && (lspServices.includes(actualName) || actualName === "lsp")) {
      const serviceName = actualName === "lsp" ? "" : actualName;
      const result = addByType("lsp", serviceName, {
        commandsDir, skillsDir, agentsDir, hooksDir, mcpFile, lspFile,
        targetDirs, spinner, mcpServers, lspServices,
      });
      if (result) {
        afterAddTargets(isGlobal, targetDirs);
        return;
      }
      process.exit(1);
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
    targetDirs, spinner, mcpServers, lspServices,
  } = ctx;

  switch (type) {
    case "command": {
      const srcPath = path.join(commandsDir, `${name}.md`);
      if (!fs.existsSync(srcPath)) {
        spinner.fail(`未找到 command: ${name}`);
        return false;
      }
      for (const target of targetDirs) {
        addSingleFileConfig({ srcDir: commandsDir, name, ext: ".md", claudeDir: target.claudeDir, subDir: "commands" });
      }
      spinner.succeed(`已添加 command: ${name} → ${formatDestinations(targetDirs, `commands/${name}.md`)}`);
      return true;
    }

    case "skill": {
      const srcPath = path.join(skillsDir, name);
      if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory()) {
        spinner.fail(`未找到 skill: ${name}`);
        return false;
      }
      for (const target of targetDirs) {
        addSingleSkill(skillsDir, name, target.claudeDir);
      }
      spinner.succeed(`已添加 skill: ${name} → ${formatDestinations(targetDirs, `skills/${name}/`)}`);
      return true;
    }

    case "agent": {
      const srcPath = path.join(agentsDir, `${name}.md`);
      if (!fs.existsSync(srcPath)) {
        spinner.fail(`未找到 agent: ${name}`);
        return false;
      }
      for (const target of targetDirs) {
        addSingleFileConfig({ srcDir: agentsDir, name, ext: ".md", claudeDir: target.claudeDir, subDir: "agents" });
      }
      spinner.succeed(`已添加 agent: ${name} → ${formatDestinations(targetDirs, `agents/${name}.md`)}`);
      return true;
    }

    case "hook": {
      const srcPath = path.join(hooksDir, `${name}.json`);
      if (!fs.existsSync(srcPath)) {
        spinner.fail(`未找到 hook: ${name}`);
        return false;
      }
      for (const target of targetDirs) {
        addSingleFileConfig({ srcDir: hooksDir, name, ext: ".json", claudeDir: target.claudeDir, subDir: "hooks" });
      }
      spinner.succeed(`已添加 hook: ${name} → ${formatDestinations(targetDirs, `hooks/${name}.json`)}`);
      return true;
    }

    case "mcp": {
      if (!fs.existsSync(mcpFile)) {
        spinner.fail("未找到 .mcp.json");
        return false;
      }
      // mcp: (空名称) → 全部; mcp:server-name → 单个
      const serverName = name === "" ? null : name;
      if (serverName && !mcpServers.includes(serverName)) {
        spinner.fail(`未找到 MCP 服务器: ${name}`);
        if (mcpServers.length > 0) {
          console.log("\n可用的 MCP 服务器:");
          mcpServers.forEach((s) => console.log(`  • mcp:${s}`));
        }
        return false;
      }

      for (const target of targetDirs) {
        const { success } = addMcpServers(mcpFile, target.claudeDir, serverName);
        if (!success) {
          spinner.fail(`同步 MCP 配置到 ${target.dirName} 失败`);
          return false;
        }
      }
      const label = serverName ? `MCP 服务器: ${name}` : "MCP 配置";
      spinner.succeed(`已添加 ${label} → ${formatDestinations(targetDirs, ".mcp.json")}`);
      return true;
    }

    case "lsp": {
      if (!fs.existsSync(lspFile)) {
        spinner.fail("未找到 .lsp.json");
        return false;
      }
      const serviceName = name === "" ? null : name;
      if (serviceName && !lspServices.includes(serviceName)) {
        spinner.fail(`未找到 LSP 服务: ${name}`);
        if (lspServices.length > 0) {
          console.log("\n可用的 LSP 服务:");
          lspServices.forEach((s) => console.log(`  • lsp:${s}`));
        }
        return false;
      }

      for (const target of targetDirs) {
        const { success } = addLspServices(lspFile, target.claudeDir, serviceName);
        if (!success) {
          spinner.fail(`同步 LSP 配置到 ${target.dirName} 失败`);
          return false;
        }
      }
      const label = serviceName ? `LSP 服务: ${name}` : "LSP 配置";
      spinner.succeed(`已添加 ${label} → ${formatDestinations(targetDirs, ".lsp.json")}`);
      return true;
    }

    default:
      spinner.fail(`未知的类型: ${type}`);
      log.info("支持的类型: command, skill, agent, hook, mcp, lsp");
      process.exit(1);
  }
}
