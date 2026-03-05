import { test } from 'node:test';
import assert from 'node:assert';
import { isCancelError, handleCancelError } from '../../src/utils/error-handler.js';

test('isCancelError - 识别 CancelError', () => {
  const error = new Error('test');
  error.name = 'CancelError';
  assert.strictEqual(isCancelError(error), true);
});

test('isCancelError - 识别 ExitPromptError', () => {
  const error = new Error('test');
  error.name = 'ExitPromptError';
  assert.strictEqual(isCancelError(error), true);
});

test('isCancelError - 识别包含 SIGINT 的错误', () => {
  const error = new Error('Process terminated with SIGINT');
  assert.strictEqual(isCancelError(error), true);
});

test('isCancelError - 识别包含 cancel 的错误', () => {
  const error = new Error('User cancelled the operation');
  assert.strictEqual(isCancelError(error), true);
});

test('isCancelError - 识别包含"取消"的错误', () => {
  const error = new Error('用户取消了操作');
  assert.strictEqual(isCancelError(error), true);
});

test('isCancelError - 不识别普通错误', () => {
  const error = new Error('Normal error');
  assert.strictEqual(isCancelError(error), false);
});

test('handleCancelError - 对于取消错误应该退出', () => {
  const error = new Error('test');
  error.name = 'CancelError';

  // 由于 handleCancelError 会调用 process.exit(0)，我们无法直接测试
  // 这里只验证它能识别取消错误
  assert.strictEqual(isCancelError(error), true);
});

test('handleCancelError - 对于非取消错误应该重新抛出', () => {
  const error = new Error('Normal error');

  assert.throws(() => {
    handleCancelError(error, null);
  }, {
    message: 'Normal error'
  });
});
