import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const TEMPLATES_DIR = path.join(os.homedir(), ".wr-ai", "templates");

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

function getRepoPath(url) {
  const normalized = normalizeGitUrl(url);
  if (!normalized) return null;
  // 从 URL 中提取 repo 路径，例如：https://github.com/user/repo -> user/repo
  const match = normalized.match(/github\.com[/:](.+)$/);
  return match ? match[1] : null;
}

export async function cloneOrUpdateRepo(url) {
  const repoPath = getRepoPath(url);
  if (!repoPath) {
    throw new Error("无效的 GitHub 地址");
  }

  const repoDir = path.join(TEMPLATES_DIR, repoPath.replace(/\//g, "_"));

  if (fs.existsSync(repoDir)) {
    // 如果已存在，执行 git pull
    try {
      execSync("git pull", { cwd: repoDir, stdio: "inherit" });
    } catch (error) {
      throw new Error(`更新仓库失败: ${error.message}`);
    }
  } else {
    // 如果不存在，执行 git clone
    const normalizedUrl = normalizeGitUrl(url);
    if (!normalizedUrl.endsWith(".git")) {
      const cloneUrl = `${normalizedUrl}.git`;
      try {
        fs.mkdirSync(path.dirname(repoDir), { recursive: true });
        execSync(`git clone ${cloneUrl} ${repoDir}`, { stdio: "inherit" });
      } catch (error) {
        throw new Error(`克隆仓库失败: ${error.message}`);
      }
    } else {
      try {
        fs.mkdirSync(path.dirname(repoDir), { recursive: true });
        execSync(`git clone ${normalizedUrl} ${repoDir}`, { stdio: "inherit" });
      } catch (error) {
        throw new Error(`克隆仓库失败: ${error.message}`);
      }
    }
  }

  return repoDir;
}

export async function listTemplates(url) {
  const repoDir = await cloneOrUpdateRepo(url);
  const templatesPath = path.join(repoDir, "templates");

  if (!fs.existsSync(templatesPath)) {
    return [];
  }

  const items = fs.readdirSync(templatesPath, { withFileTypes: true });
  return items.filter((item) => item.isDirectory()).map((item) => item.name);
}

export function getRepoDir(url) {
  const repoPath = getRepoPath(url);
  if (!repoPath) {
    throw new Error("无效的 GitHub 地址");
  }
  return path.join(TEMPLATES_DIR, repoPath.replace(/\//g, "_"));
}

// 保留兼容性
export function getTemplatesDir(url) {
  return getRepoDir(url);
}
