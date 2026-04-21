import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatManifestListOutput } from '../../src/commands/list.js';

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
