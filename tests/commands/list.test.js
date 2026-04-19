import { test } from 'node:test';
import assert from 'node:assert';
import { formatSkillListOutput } from '../../src/commands/list.js';

test('formatSkillListOutput - formats a skills-only list with wrs usage', () => {
  const output = formatSkillListOutput('awesome-claude', ['code-review', 'nextjs']);

  assert.match(output, /awesome-claude/);
  assert.match(output, /Skills/);
  assert.match(output, /code-review/);
  assert.match(output, /nextjs/);
  assert.match(output, /wrs add <name>/);
  assert.match(output, /wrs list/);
  assert.doesNotMatch(output, /Commands|Agents|Hooks|MCP|LSP|wr-ai|init \[type\]/);
});

test('formatSkillListOutput - handles an empty skills list', () => {
  const output = formatSkillListOutput('awesome-claude', []);

  assert.match(output, /awesome-claude/);
  assert.match(output, /Skills \(0\)/);
  assert.match(output, /暂无可用技能/);
});
