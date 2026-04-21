import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { formatSkillListOutput, formatManifestListOutput } from '../../src/commands/list.js';

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

describe('formatManifestListOutput', () => {
  it('groups entries into Local and Remote sections', () => {
    const output = formatManifestListOutput('ai-config', [
      { name: 'woic', source: 'local', isLocal: true },
      { name: 'vite', source: 'antfu/skills', skillId: 'vite', isLocal: false },
      { name: 'vue', source: 'antfu/skills', skillId: 'vue', isLocal: false },
    ]);
    assert.match(output, /Local \(1\)/);
    assert.match(output, /Remote \(2\)/);
    assert.match(output, /vite.*antfu\/skills/);
  });

  it('shows (none) placeholder for empty Local and Remote sections', () => {
    const emptyLocal = formatManifestListOutput('ai-config', [
      { name: 'vite', source: 'antfu/skills', skillId: 'vite', isLocal: false },
    ]);
    assert.match(emptyLocal, /Local \(0\)/);
    assert.match(emptyLocal, /\(none\)/);

    const emptyRemote = formatManifestListOutput('ai-config', [
      { name: 'woic', source: 'local', isLocal: true },
    ]);
    assert.match(emptyRemote, /Remote \(0\)/);
    assert.match(emptyRemote, /\(none\)/);
  });
});
