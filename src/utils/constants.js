import path from 'path';
import os from 'os';

export const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
export const DEFAULT_SOURCE = 'awesome-claude';
export const MAX_DISPLAY_ITEMS = 10;

export const TEMPLATES_DIR = path.join(os.homedir(), '.wrs', 'templates');
