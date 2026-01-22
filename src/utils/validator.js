import path from 'path';
import fs from 'fs';
import { log } from './logger.js';

/**
 * 验证文件路径是否在基础目录内，防止路径遍历攻击
 * @param {string} filePath - 要验证的文件路径
 * @param {string} baseDir - 基础目录
 * @returns {string} 解析后的绝对路径
 * @throws {Error} 如果路径不在基础目录内
 */
export function validatePath(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  // 确保解析后的路径在基础目录内（使用 path.sep 确保跨平台兼容）
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`路径遍历攻击检测: ${filePath} 不在 ${baseDir} 目录内`);
  }
  return resolved;
}

/**
 * 安全地解析 JSON 文件，带有错误处理和默认值
 * @param {string} filePath - JSON 文件路径
 * @param {any} defaultValue - 解析失败时的默认值
 * @param {boolean} throwOnError - 是否在错误时抛出异常
 * @returns {any} 解析后的 JSON 对象或默认值
 */
export function safeJsonParse(filePath, defaultValue = {}, throwOnError = false) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    const errorMsg = `无法解析 JSON 文件 ${filePath}: ${e.message}`;
    log.warn(errorMsg);
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    return defaultValue;
  }
}
