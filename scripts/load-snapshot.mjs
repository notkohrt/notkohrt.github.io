import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SOURCES, SOURCE_META_URL } from '../lib/graph-model.mjs';

export async function loadSnapshot(root = fileURLToPath(new URL('../', import.meta.url))) {
  const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, file]) => [key, await readJson(file)]));
  const [meta, manualLinks] = await Promise.all([readJson(SOURCE_META_URL), readJson('data/manual-links.json')]);
  return { raw: Object.fromEntries(entries), meta, manualLinks };
}
