import { test } from 'node:test';
import assert from 'node:assert';
import { parseLatestArg } from '../../src/commands/add.js';

test('parseLatestArg - @latest 返回默认 count 1', () => {
  const result = parseLatestArg('@latest');
  assert.deepStrictEqual(result, { isLatest: true, count: 1 });
});

test('parseLatestArg - @latest:5 返回 count 5', () => {
  const result = parseLatestArg('@latest:5');
  assert.deepStrictEqual(result, { isLatest: true, count: 5 });
});

test('parseLatestArg - 普通名称返回 isLatest false', () => {
  const result = parseLatestArg('code-review');
  assert.deepStrictEqual(result, { isLatest: false, count: 0 });
});

test('parseLatestArg - @latest:0 返回 count 1（最少1个）', () => {
  const result = parseLatestArg('@latest:0');
  assert.deepStrictEqual(result, { isLatest: true, count: 1 });
});
