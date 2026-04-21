import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readManifestEntries } from '../../src/utils/parser.js';

function buildClone(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-parser-manifest-'));
  const file = path.join(root, 'awesome-claude', 'skills.manifest.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 2, skills: entries }));
  return root;
}

test('readManifestEntries - returns parsed entries in manifest order', () => {
  const root = buildClone([
    { name: 'woic', source: 'local' },
    { name: 'vite', source: 'antfu/skills', skillId: 'vite' },
  ]);
  try {
    const entries = readManifestEntries(root);
    assert.deepStrictEqual(entries.map((e) => e.name), ['woic', 'vite']);
    assert.strictEqual(entries[0].isLocal, true);
    assert.strictEqual(entries[1].repoUrl, 'https://github.com/antfu/skills');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
