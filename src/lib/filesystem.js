import fs from 'fs';
import path from 'path';
import os from 'os';

export function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`源目录不存在: ${src}`);
  }

  // 创建目标目录
  fs.mkdirSync(dest, { recursive: true });

  // 读取源目录内容
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 确保配置目录存在
 * @param {boolean} global - 是否使用全局目录（用户目录）
 * @param {string} platform - 平台名称（目录名，如 'claude'）
 * @param {string} cwd - 当前工作目录（仅在非全局模式下使用）
 * @returns {string} 配置目录路径
 */
export function ensureClaudeDir(global = false, platform = 'claude', cwd = process.cwd()) {
  const dirName = `.${platform}`;
  const claudeDir = global
    ? path.join(os.homedir(), dirName)
    : path.join(cwd, dirName);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  return claudeDir;
}

// 递归列出目录下的所有文件和目录（相对路径）
export function listFilesRecursive(dir, baseDir = dir) {
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    files.push(relativePath);
    
    if (entry.isDirectory()) {
      const subFiles = listFilesRecursive(fullPath, baseDir);
      files.push(...subFiles);
    }
  }
  
  return files.sort();
}

// 复制单个文件或目录
export function copyFileOrDir(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    copyDirectory(src, dest);
  } else {
    // 确保目标目录存在
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// 更新 .gitignore，确保包含平台目录
export function updateGitignore(cwd = process.cwd(), global = false, platform = 'claude') {
  // 全局模式下不更新 .gitignore
  if (global) {
    return false;
  }
  const gitignorePath = path.join(cwd, '.gitignore');
  const dirName = `.${platform}`;
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes(dirName)) {
      fs.appendFileSync(gitignorePath, `\n${dirName}\n`);
      return true;
    }
  }
  return false;
}
