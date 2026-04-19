import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import {
  DEFAULT_SOURCE,
  EXCLUDE_LIST,
  MAX_DISPLAY_ITEMS,
  TEMPLATES_DIR,
} from '../../src/utils/constants.js';

test('skills-only 常量 - 仅保留仍被产品使用的值', () => {
  assert.strictEqual(DEFAULT_SOURCE, 'awesome-claude');
  assert.ok(EXCLUDE_LIST.includes('.git'));
  assert.ok(EXCLUDE_LIST.includes('README.md'));
  assert.strictEqual(MAX_DISPLAY_ITEMS, 10);
  assert.strictEqual(TEMPLATES_DIR, path.join(os.homedir(), '.wrs', 'templates'));
});
