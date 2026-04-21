import { loadManifest } from '../lib/manifest.js';

export function readManifestEntries(sourcePath) {
  return loadManifest(sourcePath);
}
