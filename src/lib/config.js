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
