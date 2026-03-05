import { test } from 'node:test';
import assert from 'node:assert';
import { RECOMMENDED_TYPES } from '../../src/utils/constants.js';

test('RECOMMENDED_TYPES - 包含推荐的配置类型', () => {
  assert.ok(Array.isArray(RECOMMENDED_TYPES));
  assert.ok(RECOMMENDED_TYPES.length > 0);
  // 推荐类型应该只包含简单配置，不包含 mcp/lsp
  assert.ok(!RECOMMENDED_TYPES.includes('mcp'));
  assert.ok(!RECOMMENDED_TYPES.includes('lsp'));
});
