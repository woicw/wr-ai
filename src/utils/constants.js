import path from 'path';
import os from 'os';

export const EXCLUDE_LIST = ['.git', '.gitignore', 'package.json', 'package-lock.json', 'node_modules', 'README.md'];
export const DEFAULT_SOURCE = 'awesome-claude';
export const MAX_DISPLAY_ITEMS = 10;

export const TEMPLATES_DIR = path.join(os.homedir(), '.wrs', 'templates');

export const CACHE_DIR = path.join(os.homedir(), '.wrs', 'cache');
export const CACHE_SKILLS_DIR = path.join(CACHE_DIR, 'skills');
export const CACHE_STAGE_DIR = path.join(CACHE_DIR, 'stage');
export const MANIFEST_REL_PATH = path.join('awesome-claude', 'skills.manifest.json');
