import fs from 'node:fs';
import path from 'node:path';
import { MANIFEST_REL_PATH } from '../utils/constants.js';

function parseEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('each manifest skill entry must be an object');
  }
  const { name, source } = raw;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('each skill entry requires a non-empty string name');
  }
  if (source !== 'local' && (typeof source !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source))) {
    throw new Error(`skill '${name}' has invalid source: ${JSON.stringify(source)}`);
  }
  return {
    name,
    source,
    skillId: raw.skillId ?? null,
    installName: raw.installName ?? null,
    agent: raw.agent ?? null,
    isLocal: source === 'local',
    repoUrl: source === 'local' ? null : `https://github.com/${source}`,
  };
}

export function loadManifest(sourcePath) {
  const file = path.join(sourcePath, MANIFEST_REL_PATH);
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!Array.isArray(data.skills)) {
    throw new Error('manifest must contain a top-level skills array');
  }
  return data.skills.map(parseEntry);
}

export function classifyBySource(entries) {
  const local = [];
  const remote = [];
  for (const entry of entries) {
    // Accepts both parsed entries (isLocal set) and raw manifest objects (derived from source).
    const isLocal = entry.isLocal ?? entry.source === 'local';
    (isLocal ? local : remote).push(entry);
  }
  return { local, remote };
}

export function filterByName(entries, names) {
  if (!names || names.length === 0) return entries;
  const set = new Set(names);
  return entries.filter((entry) => set.has(entry.name));
}

export function getTargetName(entry) {
  return entry.installName ?? entry.name;
}
