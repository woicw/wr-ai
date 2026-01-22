import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { TEMPLATES_DIR } from "../utils/constants.js";

// Git 操作超时时间（30秒）
const GIT_TIMEOUT = 30000;

/**
 * 规范化 Git URL，确保格式统一
 * @param {string} url - Git 仓库 URL（支持完整 URL 或简写形式如 user/repo）
 * @returns {string|null} 规范化后的 URL，如果输入无效则返回 null
 */
function normalizeGitUrl(url) {
  if (!url) return null;
  // 移除 .git 后缀（如果有）
  url = url.replace(/\.git$/, "");
  // 确保是完整的 GitHub URL
  if (!url.startsWith("http")) {
    url = `https://github.com/${url}`;
  }
  return url;
}

/**
 * 从 URL 中提取仓库路径
 * @param {string} url - Git 仓库 URL
 * @returns {string|null} 仓库路径（如 user/repo），如果无法提取则返回 null
 */
function getRepoPath(url) {
  const normalized = normalizeGitUrl(url);
  if (!normalized) return null;
  // 从 URL 中提取 repo 路径，例如：https://github.com/user/repo -> user/repo
  const match = normalized.match(/github\.com[/:](.+)$/);
  return match ? match[1] : null;
}

/**
 * 执行 Git 命令，支持超时和信号中断
 * @param {string[]} args - Git 命令参数
 * @param {Object} options - 执行选项
 * @returns {Promise<void>}
 */
function execGitCommand(args, options = {}) {
  return new Promise((resolve, reject) => {
    const { cwd, timeout = GIT_TIMEOUT } = options;

    const child = spawn("git", args, {
      cwd,
      stdio: "pipe",
      encoding: "utf-8"
    });

    let stdout = "";
    let stderr = "";
    let timeoutId = null;

    // 收集输出
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // 设置超时
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Git 操作超时（${timeout / 1000}秒），请检查网络连接`));
      }, timeout);
    }

    // 处理进程退出
    child.on("close", (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (code === 0) {
        resolve();
      } else {
        const errorMessage = stderr || stdout || `Git 命令失败，退出码: ${code}`;
        const error = new Error(errorMessage);
        error.code = code;
        reject(error);
      }
    });

    // 处理进程错误
    child.on("error", (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });

    // 处理用户中断信号（Ctrl+C）
    const signalHandler = (signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // 尝试优雅地终止进程
      try {
        child.kill(signal);
      } catch (e) {
        // 如果进程已经退出，忽略错误
      }
      // 创建可识别的取消错误
      const cancelError = new Error(`操作已取消（${signal}）`);
      cancelError.name = "CancelError";
      cancelError.signal = signal;
      reject(cancelError);
    };

    // 注册信号处理器
    process.on("SIGINT", signalHandler);
    process.on("SIGTERM", signalHandler);

    // 清理信号监听器（确保不会泄漏）
    const cleanup = () => {
      process.removeListener("SIGINT", signalHandler);
      process.removeListener("SIGTERM", signalHandler);
    };

    child.on("close", cleanup);
    child.on("error", () => cleanup());
  });
}

/**
 * 克隆或更新 Git 仓库
 * @param {string} url - Git 仓库 URL
 * @param {Object} options - 选项，包含 timeout（超时时间，毫秒）
 * @returns {Promise<string>} 仓库本地目录路径
 * @throws {Error} 如果 URL 无效或 git 操作失败
 */
export async function cloneOrUpdateRepo(url, options = {}) {
  const repoPath = getRepoPath(url);
  if (!repoPath) {
    throw new Error("无效的 GitHub 地址");
  }

  const repoDir = path.join(TEMPLATES_DIR, repoPath.replace(/\//g, "_"));
  const { timeout = GIT_TIMEOUT } = options;

  if (fs.existsSync(repoDir)) {
    // 如果已存在，执行 git pull
    try {
      await execGitCommand(["pull"], { cwd: repoDir, timeout });
    } catch (error) {
      const errorMessage = error.message || String(error);
      throw new Error(`更新仓库失败: ${errorMessage}`, { cause: error });
    }
  } else {
    // 如果不存在，执行 git clone
    const normalizedUrl = normalizeGitUrl(url);
    const cloneUrl = normalizedUrl.endsWith(".git") ? normalizedUrl : `${normalizedUrl}.git`;

    try {
      fs.mkdirSync(path.dirname(repoDir), { recursive: true });
      await execGitCommand(["clone", cloneUrl, repoDir], { timeout });
    } catch (error) {
      const errorMessage = error.message || String(error);
      throw new Error(`克隆仓库失败: ${errorMessage}`, { cause: error });
    }
  }

  return repoDir;
}

/**
 * 列出仓库中的模板目录
 * @param {string} url - Git 仓库 URL
 * @returns {Promise<string[]>} 模板目录名称数组
 */
export async function listTemplates(url) {
  const repoDir = await cloneOrUpdateRepo(url);
  const templatesPath = path.join(repoDir, "templates");

  if (!fs.existsSync(templatesPath)) {
    return [];
  }

  const items = fs.readdirSync(templatesPath, { withFileTypes: true });
  return items.filter((item) => item.isDirectory()).map((item) => item.name);
}

/**
 * 获取仓库的本地目录路径
 * @param {string} url - Git 仓库 URL
 * @returns {string} 仓库本地目录路径
 * @throws {Error} 如果 URL 无效
 */
export function getRepoDir(url) {
  const repoPath = getRepoPath(url);
  if (!repoPath) {
    throw new Error("无效的 GitHub 地址");
  }
  return path.join(TEMPLATES_DIR, repoPath.replace(/\//g, "_"));
}

/**
 * 获取模板目录路径（兼容性函数）
 * @param {string} url - Git 仓库 URL
 * @returns {string} 仓库本地目录路径
 */
export function getTemplatesDir(url) {
  return getRepoDir(url);
}
