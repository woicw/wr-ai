import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { TEMPLATES_DIR } from "../utils/constants.js";

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
 * 克隆或更新 Git 仓库
 * @param {string} url - Git 仓库 URL
 * @returns {Promise<string>} 仓库本地目录路径
 * @throws {Error} 如果 URL 无效或 git 操作失败
 */
export async function cloneOrUpdateRepo(url) {
  const repoPath = getRepoPath(url);
  if (!repoPath) {
    throw new Error("无效的 GitHub 地址");
  }

  const repoDir = path.join(TEMPLATES_DIR, repoPath.replace(/\//g, "_"));

  if (fs.existsSync(repoDir)) {
    // 如果已存在，执行 git pull
    try {
      execSync("git", ["pull"], {
        cwd: repoDir,
        stdio: "pipe",
        encoding: "utf-8"
      });
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
      // 使用参数数组形式，避免命令注入风险
      execSync("git", ["clone", cloneUrl, repoDir], {
        stdio: "pipe",
        encoding: "utf-8"
      });
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
