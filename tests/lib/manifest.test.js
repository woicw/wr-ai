import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadManifest, classifyBySource } from '../../src/lib/manifest.js';

function writeManifest(root, payload) {
  const file = path.join(root, 'awesome-claude', 'skills.manifest.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
  return root;
}

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('loadManifest - parses local and remote entries', () => {
  const root = writeManifest(tmp('wrs-manifest-'), {
    version: 2,
    skills: [
      { name: 'woic', source: 'local' },
      { name: 'vite', source: 'antfu/skills', skillId: 'vite' },
      { name: 'skill-creator-anthropics', source: 'anthropics/skills', skillId: 'skill-creator', installName: 'skill-creator-anthropics' },
    ],
  });
  try {
    const entries = loadManifest(root);
    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0].source, 'local');
    assert.strictEqual(entries[1].repoUrl, 'https://github.com/antfu/skills');
    assert.strictEqual(entries[2].installName, 'skill-creator-anthropics');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('classifyBySource - splits local vs remote', () => {
  const entries = [
    { name: 'a', source: 'local' },
    { name: 'b', source: 'x/y', skillId: 'b' },
  ];
  const { local, remote } = classifyBySource(entries);
  assert.deepStrictEqual(local.map((e) => e.name), ['a']);
  assert.deepStrictEqual(remote.map((e) => e.name), ['b']);
});

test('loadManifest - throws on malformed source', () => {
  const root = writeManifest(tmp('wrs-manifest-bad-'), {
    version: 2,
    skills: [{ name: 'oops', source: 'not-a-repo' }],
  });
  try {
    assert.throws(() => loadManifest(root), /invalid source/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
