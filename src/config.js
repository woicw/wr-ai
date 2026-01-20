import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".wr-ai");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_ORIGIN = "https://github.com/woicw/ai-config.git";

export function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { origin: DEFAULT_ORIGIN };
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return { origin: DEFAULT_ORIGIN };
  }
}

export function setOrigin(url) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const config = { origin: url };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

export function getOrigin() {
  const config = getConfig();
  return config.origin;
}
