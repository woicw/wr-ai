import { test } from 'node:test';
import assert from 'node:assert';
import { validatePath } from '../../src/utils/validator.js';
import path from 'path';
import os from 'os';

test('validatePath - 拒绝路径遍历攻击（..）', () => {
  const basePath = '/Users/test/.claude';
  assert.throws(() => {
    validatePath('../../../etc/passwd', basePath);
  }, {
    message: /路径遍历攻击检测/
  });
});

test('validatePath - 拒绝绝对路径攻击', () => {
  const basePath = '/Users/test/.claude';
  assert.throws(() => {
    validatePath('/etc/passwd', basePath);
  }, {
    message: /路径遍历攻击检测/
  });
});

test('validatePath - 接受合法的相对路径', () => {
  const basePath = '/Users/test/.claude';
  const testPath = path.join(basePath, 'config.json');

  // 不应该抛出错误
  assert.doesNotThrow(() => {
    validatePath(testPath, basePath);
  });
});

test('validatePath - 接受 ~ 开头的路径', () => {
  const homeDir = os.homedir();
  const testPath = '~/.claude/config.json';

  // 不应该抛出错误
  assert.doesNotThrow(() => {
    validatePath(testPath, homeDir);
  });
});

test('validatePath - 拒绝包含 .. 的路径', () => {
  const basePath = '/Users/test/.claude';
  assert.throws(() => {
    validatePath(path.join(basePath, '../other/file'), basePath);
  }, {
    message: /路径遍历攻击检测/
  });
});
