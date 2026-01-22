import { getOrigin } from "../lib/config.js";
import { cloneOrUpdateRepo, getRepoDir } from "../lib/repository.js";
import { copyFileOrDir, ensureClaudeDir, updateGitignore } from "../lib/filesystem.js";
import * as c from "yoctocolors";
import ora from "ora";
import fs from "fs";
import path from "path";
import { EXCLUDE_LIST, DEFAULT_SOURCE } from "../utils/constants.js";
import { log } from "../utils/logger.js";

// 列出可用的配置项
async function listAvailableItems(sourcePath, filterType, mcpServers, lspServices) {
  const commandsDir = path.join(sourcePath, "commands");
  const skillsDir = path.join(sourcePath, "skills");
  const agentsDir = path.join(sourcePath, "agents");
  const hooksDir = path.join(sourcePath, "hooks");
  const mcpFile = path.join(sourcePath, ".mcp.json");
  const lspFile = path.join(sourcePath, ".lsp.json");

  if (!filterType || filterType === 'command' || filterType === 'cmd') {
    const availableCommands = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(".md", ""))
      : [];

    if (availableCommands.length > 0) {
      console.log("\n可用的 commands:");
      availableCommands.forEach((c) => console.log(`  • ${c} 或 command:${c}`));
    }
  }

  if (!filterType || filterType === 'skill') {
    const availableSkills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
      : [];

    if (availableSkills.length > 0) {
      console.log("\n可用的 skills:");
      availableSkills.forEach((s) => console.log(`  • ${s} 或 skill:${s}`));
    }
  }

  if (!filterType || filterType === 'agent') {
    const availableAgents = fs.existsSync(agentsDir)
      ? fs.readdirSync(agentsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(".md", ""))
      : [];

    if (availableAgents.length > 0) {
      console.log("\n可用的 agents:");
      availableAgents.forEach((a) => console.log(`  • ${a} 或 agent:${a}`));
    }
  }

  if (!filterType || filterType === 'hook') {
    const availableHooks = fs.existsSync(hooksDir)
      ? fs.readdirSync(hooksDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
      : [];

    if (availableHooks.length > 0) {
      console.log("\n可用的 hooks:");
      availableHooks.forEach((h) => console.log(`  • ${h} 或 hook:${h}`));
    }
  }

  if (!filterType || filterType === 'mcp') {
    if (fs.existsSync(mcpFile)) {
      console.log("\n可用的 MCP 配置:");
      console.log("  • mcp (全部服务器)");
      if (mcpServers.length > 0) {
        mcpServers.forEach((server) => {
          console.log(`  • mcp:${server}`);
        });
      }
    }
  }

  if (!filterType || filterType === 'lsp') {
    if (fs.existsSync(lspFile)) {
      console.log("\n可用的 LSP 配置:");
      console.log("  • lsp (全部服务)");
      if (lspServices.length > 0) {
        lspServices.forEach((service) => {
          console.log(`  • lsp:${service}`);
        });
      }
    }
  }
}

export async function handleAdd(name) {
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

  if (name.includes(':')) {
    const parts = name.split(':');
    if (parts.length === 2) {
      type = parts[0];
      actualName = parts[1];
    }
  }

  const spinner = ora(`正在查找 "${name}"...`).start();

  try {
    await cloneOrUpdateRepo(origin);
    const repoDir = getRepoDir(origin);

    // 确定配置来源
    const items = fs.readdirSync(repoDir, { withFileTypes: true })
      .filter((item) => item.isDirectory() && !EXCLUDE_LIST.includes(item.name))
      .map((item) => item.name);

    const sourceDir = items.includes(DEFAULT_SOURCE) ? DEFAULT_SOURCE : items[0];
    if (!sourceDir) {
      spinner.fail("仓库中未找到可用配置");
      process.exit(1);
    }

    const sourcePath = path.join(repoDir, sourceDir);
    const cwd = process.cwd();
    const claudeDir = ensureClaudeDir(cwd);

    // 解析 MCP 和 LSP 配置（用于后续使用）
    const mcpFile = path.join(sourcePath, ".mcp.json");
    const lspFile = path.join(sourcePath, ".lsp.json");
    let mcpServers = [];
    let lspServices = [];

    if (fs.existsSync(mcpFile)) {
      try {
        const mcpContent = fs.readFileSync(mcpFile, 'utf-8');
        const mcpConfig = JSON.parse(mcpContent);
        if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
          mcpServers = Object.keys(mcpConfig.mcpServers);
        }
      } catch (e) {
        // 解析失败，忽略
      }
    }

    if (fs.existsSync(lspFile)) {
      try {
        const lspContent = fs.readFileSync(lspFile, 'utf-8');
        const lspConfig = JSON.parse(lspContent);
        if (typeof lspConfig === 'object') {
          lspServices = Object.keys(lspConfig);
        }
      } catch (e) {
        // 解析失败，忽略
      }
    }

    // 如果指定了类型，只在对应类型中查找
    if (type) {
      switch (type) {
        case 'command':
        case 'cmd': {
          const commandPath = path.join(sourcePath, "commands", `${actualName}.md`);
          if (fs.existsSync(commandPath)) {
            spinner.text = `正在添加 command: ${actualName}...`;
            const destDir = path.join(claudeDir, "commands");
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = path.join(destDir, `${actualName}.md`);
            fs.copyFileSync(commandPath, destPath);
            spinner.succeed(`已添加 command: ${actualName} → .claude/commands/${actualName}.md`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          }
          spinner.fail(`未找到 command: ${actualName}`);
          break;
        }

        case 'skill': {
          const skillPath = path.join(sourcePath, "skills", actualName);
          if (fs.existsSync(skillPath) && fs.statSync(skillPath).isDirectory()) {
            spinner.text = `正在添加 skill: ${actualName}...`;
            const destPath = path.join(claudeDir, "skills", actualName);
            copyFileOrDir(skillPath, destPath);
            spinner.succeed(`已添加 skill: ${actualName} → .claude/skills/${actualName}/`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          }
          spinner.fail(`未找到 skill: ${actualName}`);
          break;
        }

        case 'agent': {
          const agentPath = path.join(sourcePath, "agents", `${actualName}.md`);
          if (fs.existsSync(agentPath)) {
            spinner.text = `正在添加 agent: ${actualName}...`;
            const destDir = path.join(claudeDir, "agents");
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = path.join(destDir, `${actualName}.md`);
            fs.copyFileSync(agentPath, destPath);
            spinner.succeed(`已添加 agent: ${actualName} → .claude/agents/${actualName}.md`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          }
          spinner.fail(`未找到 agent: ${actualName}`);
          break;
        }

        case 'hook': {
          const hookPath = path.join(sourcePath, "hooks", `${actualName}.json`);
          if (fs.existsSync(hookPath)) {
            spinner.text = `正在添加 hook: ${actualName}...`;
            const destDir = path.join(claudeDir, "hooks");
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = path.join(destDir, `${actualName}.json`);
            fs.copyFileSync(hookPath, destPath);
            spinner.succeed(`已添加 hook: ${actualName} → .claude/hooks/${actualName}.json`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          }
          spinner.fail(`未找到 hook: ${actualName}`);
          break;
        }

        case 'mcp': {
          if (actualName === '') {
            // mcp: 表示添加所有服务器
            if (!fs.existsSync(mcpFile)) {
              spinner.fail(`未找到 .mcp.json`);
              process.exit(1);
            }

            spinner.text = `正在添加 MCP 配置...`;
            const destPath = path.join(claudeDir, '.mcp.json');
            const exists = fs.existsSync(destPath);

            let remoteConfig = {};
            let localConfig = {};

            try {
              const remoteContent = fs.readFileSync(mcpFile, 'utf-8');
              remoteConfig = JSON.parse(remoteContent);
            } catch (e) {
              spinner.fail(`无法解析远程 MCP 配置: ${e.message}`);
              process.exit(1);
            }

            if (exists) {
              try {
                const localContent = fs.readFileSync(destPath, 'utf-8');
                localConfig = JSON.parse(localContent);
              } catch (e) {
                log.warn(`无法解析本地 MCP 配置，将覆盖: ${e.message}`);
              }
            }

            const mergedConfig = {
              mcpServers: {
                ...(localConfig.mcpServers || {}),
                ...(remoteConfig.mcpServers || {})
              }
            };

            fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
            spinner.succeed(`已添加 MCP 配置 → .claude/.mcp.json`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          } else {
            // mcp:server-name 表示添加单个服务器
            if (!fs.existsSync(mcpFile)) {
              spinner.fail(`未找到 .mcp.json`);
              process.exit(1);
            }

            let remoteConfig = {};
            try {
              const remoteContent = fs.readFileSync(mcpFile, 'utf-8');
              remoteConfig = JSON.parse(remoteContent);
            } catch (e) {
              spinner.fail(`无法解析远程 MCP 配置: ${e.message}`);
              process.exit(1);
            }

            if (!remoteConfig.mcpServers || !remoteConfig.mcpServers[actualName]) {
              spinner.fail(`未找到 MCP 服务器: ${actualName}`);
              if (mcpServers.length > 0) {
                console.log("\n可用的 MCP 服务器:");
                mcpServers.forEach((s) => console.log(`  • mcp:${s}`));
              }
              process.exit(1);
            }

            spinner.text = `正在添加 MCP 服务器: ${actualName}...`;
            const destPath = path.join(claudeDir, '.mcp.json');
            const exists = fs.existsSync(destPath);

            let localConfig = {};
            if (exists) {
              try {
                const localContent = fs.readFileSync(destPath, 'utf-8');
                localConfig = JSON.parse(localContent);
              } catch (e) {
                log.warn(`无法解析本地 MCP 配置，将覆盖: ${e.message}`);
              }
            }

            const mergedConfig = {
              mcpServers: {
                ...(localConfig.mcpServers || {}),
                [actualName]: remoteConfig.mcpServers[actualName]
              }
            };

            fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
            spinner.succeed(`已添加 MCP 服务器: ${actualName} → .claude/.mcp.json`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          }
        }

        case 'lsp': {
          if (actualName === '') {
            // lsp: 表示添加所有服务
            if (!fs.existsSync(lspFile)) {
              spinner.fail(`未找到 .lsp.json`);
              process.exit(1);
            }

            spinner.text = `正在添加 LSP 配置...`;
            const destPath = path.join(claudeDir, '.lsp.json');
            const exists = fs.existsSync(destPath);

            let remoteConfig = {};
            let localConfig = {};

            try {
              const remoteContent = fs.readFileSync(lspFile, 'utf-8');
              remoteConfig = JSON.parse(remoteContent);
            } catch (e) {
              spinner.fail(`无法解析远程 LSP 配置: ${e.message}`);
              process.exit(1);
            }

            if (exists) {
              try {
                const localContent = fs.readFileSync(destPath, 'utf-8');
                localConfig = JSON.parse(localContent);
              } catch (e) {
                log.warn(`无法解析本地 LSP 配置，将覆盖: ${e.message}`);
              }
            }

            const mergedConfig = {
              ...localConfig,
              ...remoteConfig
            };

            fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
            spinner.succeed(`已添加 LSP 配置 → .claude/.lsp.json`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          } else {
            // lsp:service-name 表示添加单个服务
            if (!fs.existsSync(lspFile)) {
              spinner.fail(`未找到 .lsp.json`);
              process.exit(1);
            }

            let remoteConfig = {};
            try {
              const remoteContent = fs.readFileSync(lspFile, 'utf-8');
              remoteConfig = JSON.parse(remoteContent);
            } catch (e) {
              spinner.fail(`无法解析远程 LSP 配置: ${e.message}`);
              process.exit(1);
            }

            if (!remoteConfig[actualName]) {
              spinner.fail(`未找到 LSP 服务: ${actualName}`);
              if (lspServices.length > 0) {
                console.log("\n可用的 LSP 服务:");
                lspServices.forEach((s) => console.log(`  • lsp:${s}`));
              }
              process.exit(1);
            }

            spinner.text = `正在添加 LSP 服务: ${actualName}...`;
            const destPath = path.join(claudeDir, '.lsp.json');
            const exists = fs.existsSync(destPath);

            let localConfig = {};
            if (exists) {
              try {
                const localContent = fs.readFileSync(destPath, 'utf-8');
                localConfig = JSON.parse(localContent);
              } catch (e) {
                log.warn(`无法解析本地 LSP 配置，将覆盖: ${e.message}`);
              }
            }

            const mergedConfig = {
              ...localConfig,
              [actualName]: remoteConfig[actualName]
            };

            fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
            spinner.succeed(`已添加 LSP 服务: ${actualName} → .claude/.lsp.json`);

            if (updateGitignore(cwd)) {
              log.info('已添加 .claude 到 .gitignore');
            }
            return;
          }
        }

        default:
          spinner.fail(`未知的类型: ${type}`);
          log.info("支持的类型: command, skill, agent, hook, mcp, lsp");
          process.exit(1);
      }

      // 如果指定了类型但未找到，列出该类型的所有可用项
      await listAvailableItems(sourcePath, type, mcpServers, lspServices);
      process.exit(1);
    }

    // 如果没有指定类型，在所有类型中查找（按顺序）
    // 1. command
    const commandPath = path.join(sourcePath, "commands", `${actualName}.md`);
    if (fs.existsSync(commandPath)) {
      spinner.text = `正在添加 command: ${actualName}...`;
      const destDir = path.join(claudeDir, "commands");
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, `${actualName}.md`);
      fs.copyFileSync(commandPath, destPath);
      spinner.succeed(`已添加 command: ${actualName} → .claude/commands/${actualName}.md`);

      if (updateGitignore(cwd)) {
        log.info('已添加 .claude 到 .gitignore');
      }
      return;
    }

    // 2. skill
    const skillPath = path.join(sourcePath, "skills", actualName);
    if (fs.existsSync(skillPath) && fs.statSync(skillPath).isDirectory()) {
      spinner.text = `正在添加 skill: ${actualName}...`;
      const destPath = path.join(claudeDir, "skills", actualName);
      copyFileOrDir(skillPath, destPath);
      spinner.succeed(`已添加 skill: ${actualName} → .claude/skills/${actualName}/`);

      if (updateGitignore(cwd)) {
        log.info('已添加 .claude 到 .gitignore');
      }
      return;
    }

    // 3. agent
    const agentPath = path.join(sourcePath, "agents", `${actualName}.md`);
    if (fs.existsSync(agentPath)) {
      spinner.text = `正在添加 agent: ${actualName}...`;
      const destDir = path.join(claudeDir, "agents");
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, `${actualName}.md`);
      fs.copyFileSync(agentPath, destPath);
      spinner.succeed(`已添加 agent: ${actualName} → .claude/agents/${actualName}.md`);

      if (updateGitignore(cwd)) {
        log.info('已添加 .claude 到 .gitignore');
      }
      return;
    }

    // 4. hook
    const hookPath = path.join(sourcePath, "hooks", `${actualName}.json`);
    if (fs.existsSync(hookPath)) {
      spinner.text = `正在添加 hook: ${actualName}...`;
      const destDir = path.join(claudeDir, "hooks");
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, `${actualName}.json`);
      fs.copyFileSync(hookPath, destPath);
      spinner.succeed(`已添加 hook: ${actualName} → .claude/hooks/${actualName}.json`);

      if (updateGitignore(cwd)) {
        log.info('已添加 .claude 到 .gitignore');
      }
      return;
    }

    // 5. mcp (检查服务器名称或全部)
    if (fs.existsSync(mcpFile)) {
      let remoteConfig = {};
      try {
        const remoteContent = fs.readFileSync(mcpFile, 'utf-8');
        remoteConfig = JSON.parse(remoteContent);
      } catch (e) {
        // 解析失败，跳过
      }

      // 检查是否是单个服务器名称
      if (remoteConfig.mcpServers && remoteConfig.mcpServers[actualName]) {
        spinner.text = `正在添加 MCP 服务器: ${actualName}...`;
        const destPath = path.join(claudeDir, '.mcp.json');
        const exists = fs.existsSync(destPath);

        let localConfig = {};
        if (exists) {
          try {
            const localContent = fs.readFileSync(destPath, 'utf-8');
            localConfig = JSON.parse(localContent);
          } catch (e) {
            log.warn(`无法解析本地 MCP 配置，将覆盖: ${e.message}`);
          }
        }

        const mergedConfig = {
          mcpServers: {
            ...(localConfig.mcpServers || {}),
            [actualName]: remoteConfig.mcpServers[actualName]
          }
        };

        fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
        spinner.succeed(`已添加 MCP 服务器: ${actualName} → .claude/.mcp.json`);

        if (updateGitignore(cwd)) {
          log.info('已添加 .claude 到 .gitignore');
        }
        return;
      }

      // 检查是否是 "mcp"（全部）
      if (actualName === 'mcp') {
        spinner.text = `正在添加 MCP 配置...`;
        const destPath = path.join(claudeDir, '.mcp.json');
        const exists = fs.existsSync(destPath);

        let localConfig = {};
        if (exists) {
          try {
            const localContent = fs.readFileSync(destPath, 'utf-8');
            localConfig = JSON.parse(localContent);
          } catch (e) {
            log.warn(`无法解析本地 MCP 配置，将覆盖: ${e.message}`);
          }
        }

        const mergedConfig = {
          mcpServers: {
            ...(localConfig.mcpServers || {}),
            ...(remoteConfig.mcpServers || {})
          }
        };

        fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
        spinner.succeed(`已添加 MCP 配置 → .claude/.mcp.json`);

        if (updateGitignore(cwd)) {
          log.info('已添加 .claude 到 .gitignore');
        }
        return;
      }
    }

    // 6. lsp (检查服务名称或全部)
    if (fs.existsSync(lspFile)) {
      let remoteConfig = {};
      try {
        const remoteContent = fs.readFileSync(lspFile, 'utf-8');
        remoteConfig = JSON.parse(remoteContent);
      } catch (e) {
        // 解析失败，跳过
      }

      // 检查是否是单个服务名称
      if (remoteConfig[actualName]) {
        spinner.text = `正在添加 LSP 服务: ${actualName}...`;
        const destPath = path.join(claudeDir, '.lsp.json');
        const exists = fs.existsSync(destPath);

        let localConfig = {};
        if (exists) {
          try {
            const localContent = fs.readFileSync(destPath, 'utf-8');
            localConfig = JSON.parse(localContent);
          } catch (e) {
            log.warn(`无法解析本地 LSP 配置，将覆盖: ${e.message}`);
          }
        }

        const mergedConfig = {
          ...localConfig,
          [actualName]: remoteConfig[actualName]
        };

        fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
        spinner.succeed(`已添加 LSP 服务: ${actualName} → .claude/.lsp.json`);

        if (updateGitignore(cwd)) {
          log.info('已添加 .claude 到 .gitignore');
        }
        return;
      }

      // 检查是否是 "lsp"（全部）
      if (actualName === 'lsp') {
        spinner.text = `正在添加 LSP 配置...`;
        const destPath = path.join(claudeDir, '.lsp.json');
        const exists = fs.existsSync(destPath);

        let localConfig = {};
        if (exists) {
          try {
            const localContent = fs.readFileSync(destPath, 'utf-8');
            localConfig = JSON.parse(localContent);
          } catch (e) {
            log.warn(`无法解析本地 LSP 配置，将覆盖: ${e.message}`);
          }
        }

        const mergedConfig = {
          ...localConfig,
          ...remoteConfig
        };

        fs.writeFileSync(destPath, JSON.stringify(mergedConfig, null, 2) + '\n');
        spinner.succeed(`已添加 LSP 配置 → .claude/.lsp.json`);

        if (updateGitignore(cwd)) {
          log.info('已添加 .claude 到 .gitignore');
        }
        return;
      }
    }

    // 未找到
    spinner.fail(`未找到 "${name}"，请检查名称是否正确`);

    // 列出所有可用的配置项
    await listAvailableItems(sourcePath, null, mcpServers, lspServices);

    process.exit(1);
  } catch (error) {
    // 检查是否是用户取消操作（Ctrl+C）
    if (error.name === 'CancelError' ||
        error.message?.includes('SIGINT') ||
        error.message?.includes('cancel') ||
        error.message?.includes('取消') ||
        error.message?.includes('操作已取消')) {
      spinner.stop();
      log.info('操作已取消');
      process.exit(0);
    }

    spinner.fail(`添加失败: ${error.message}`);
    process.exit(1);
  }
}
