import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'data', 'sts2');
const REPO = 'nkhoit/spire-archive';
const FILES = ['cards','relics','powers','potions','enchantments','keywords','mechanics','card_powers'];

async function json(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'sts2-bubble-data-updater' } });
  if (!response.ok) throw new Error(url + ' -> ' + response.status);
  return response.json();
}

const ref = await json('https://api.github.com/repos/' + REPO + '/git/ref/heads/main');
const sha = ref.object.sha;
const rawBase = 'https://raw.githubusercontent.com/' + REPO + '/' + sha + '/data/sts2/';

await mkdir(OUT, { recursive: true });

for (const name of FILES) {
  const response = await fetch(rawBase + name + '.json');
  if (!response.ok) throw new Error(name + '.json -> ' + response.status);
  const body = await response.text();
  JSON.parse(body);
  await writeFile(path.join(OUT, name + '.json'), body.endsWith('\n') ? body : body + '\n');
  console.log('updated', name + '.json');
}

const changelog = await json(rawBase + 'changelog.json');
const latest = changelog[0] || {};
const today = new Date().toISOString().slice(0, 10);
const meta = {
  source_repository: REPO,
  source_commit: sha,
  snapshot_date: today,
  game_data_version: latest.version || null,
  game_data_date: latest.date || null,
  source_path: 'data/sts2',
  note: 'Pinned source snapshot used by STS2 Bubble.'
};

await writeFile(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log('snapshot', sha, latest.version || 'unknown', latest.date || 'unknown');
console.log('Run: node scripts/validate-graph.mjs');
