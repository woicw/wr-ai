import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".wr-ai");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_ORIGIN = "https://github.com/woicw/ai-config.git";
const DEFAULT_PLATFORM = "claude";

export function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { origin: DEFAULT_ORIGIN, platform: DEFAULT_PLATFORM };
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content);
    // 确保 platform 有默认值
    if (!config.platform) {
      config.platform = DEFAULT_PLATFORM;
    }
    return config;
  } catch (error) {
    return { origin: DEFAULT_ORIGIN, platform: DEFAULT_PLATFORM };
  }
}

export function setOrigin(url) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const currentConfig = getConfig();
  const config = { ...currentConfig, origin: url };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

export function getOrigin() {
  const config = getConfig();
  return config.origin;
}

export function setPlatform(platform) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const currentConfig = getConfig();
  const config = { ...currentConfig, platform };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

export function getPlatform() {
  const config = getConfig();
  return config.platform || DEFAULT_PLATFORM;
}

/**
 * 获取本地配置文件路径
 * @param {string} cwd - 项目目录
 * @returns {string} 本地配置文件路径
 */
export function getLocalConfigPath(cwd) {
  return path.join(cwd, '.wr-ai', 'config.json');
}

/**
 * 读取指定路径的配置文件
 * @param {string} configPath - 配置文件路径
 * @returns {Object} 配置对象
 */
function readConfigFile(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * 写入配置文件（保留已有字段）
 * @param {string} configPath - 配置文件路径
 * @param {Object} updates - 要合并的字段
 */
function writeConfigFile(configPath, updates) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const existing = readConfigFile(configPath);
  const merged = { ...existing, ...updates };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

/**
 * 保存上次选择
 * @param {Object} selection - 选择对象
 * @param {boolean} isGlobal - 是否保存到全局配置
 * @param {string} [baseDir] - 基础目录
 */
export function saveLastSelection(selection, isGlobal, baseDir) {
  const base = baseDir || (isGlobal ? os.homedir() : process.cwd());
  const configPath = path.join(base, '.wr-ai', 'config.json');

  const lastSelection = {
    commands: selection.commands || [],
    skills: selection.skills || [],
    agents: selection.agents || [],
    hooks: selection.hooks || [],
    mcpServers: selection.mcpServers || [],
    lspServices: selection.lspServices || [],
    timestamp: new Date().toISOString(),
  };

  writeConfigFile(configPath, { lastSelection });
}

/**
 * 获取上次选择
 * @param {boolean} isGlobal - 是否读取全局配置
 * @param {string} [baseDir] - 基础目录
 * @returns {Object|null} 上次选择对象
 */
export function getLastSelection(isGlobal, baseDir) {
  const base = baseDir || (isGlobal ? os.homedir() : process.cwd());
  const configPath = path.join(base, '.wr-ai', 'config.json');
  const config = readConfigFile(configPath);
  return config.lastSelection || null;
}
