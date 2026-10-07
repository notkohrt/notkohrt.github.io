import { readFile } from 'node:fs/promises';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const [cards, relics, powers, potions, enchantments, keywords, mechanics, manualLinks, meta] = await Promise.all([
  readJson('data/sts2/cards.json'),
  readJson('data/sts2/relics.json'),
  readJson('data/sts2/powers.json'),
  readJson('data/sts2/potions.json'),
  readJson('data/sts2/enchantments.json'),
  readJson('data/sts2/keywords.json'),
  readJson('data/sts2/mechanics.json'),
  readJson('data/manual-links.json'),
  readJson('data/sts2/meta.json')
]);

const app = await readFile('app.js', 'utf8');
const vault = await readFile('scripts/build-vault.mjs', 'utf8');
const slug = (value) => String(value == null ? '' : value).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();

const ids = new Set();
for (const x of cards) ids.add('card:' + x.id);
for (const x of relics) ids.add('relic:' + x.id);
for (const x of powers) ids.add('power:' + x.id);
for (const x of potions) ids.add('potion:' + x.id);
for (const x of enchantments) ids.add('enchantment:' + x.id);
for (const x of keywords) ids.add('keyword:' + x.id);

for (const group of ['core_concepts', 'orbs', 'character_mechanics']) {
  for (const x of mechanics[group] || []) ids.add('mechanic:' + (x.id || slug(x.title || x.name)));
}

for (const id of ['ORB_SYSTEM','ORB_SLOTS','OSTY','CARD_TYPE_ATTACK','CARD_TYPE_SKILL','CARD_TYPE_POWER','CARD_TYPE_STATUS','CARD_TYPE_COLORLESS']) {
  ids.add('mechanic:' + id);
}

for (const card of cards) {
  for (const tag of card.tags || []) ids.add('tag:' + slug(tag));
}

for (const id of ['DRAW','DISCARD','EXHAUST_CARD','PLAY_CARD','DAMAGE','HEAL','LOSE_HP','UPGRADE','TRANSFORM','CREATE_CARD','SHUFFLE','CHANNEL','EVOKE','COST_CHANGE']) {
  ids.add('effect:' + id);
}

const missing = [];
const pairRe = /\[\s*'([^']+:[^']+)'\s*,\s*'([^']+:[^']+)'\s*,\s*(?:\[|'[^']+')/g;
for (const item of [['app.js', app], ['scripts/build-vault.mjs', vault]]) {
  const file = item[0];
  const source = item[1];
  let match;
  while ((match = pairRe.exec(source))) {
    for (const id of [match[1], match[2]]) {
      if (!ids.has(id)) missing.push(file + ': ' + id);
    }
  }
}

for (const link of manualLinks) {
  if (!ids.has(link.source)) missing.push('data/manual-links.json source: ' + link.source);
  if (!ids.has(link.target)) missing.push('data/manual-links.json target: ' + link.target);
}

const unpinned = [];
for (const item of [['app.js', app], ['scripts/build-vault.mjs', vault]]) {
  if (/raw\.githubusercontent\.com\/nkhoit\/spire-archive\/main\//.test(item[1])) unpinned.push(item[0]);
}

if (missing.length) {
  console.error('Missing graph endpoints:\n' + [...new Set(missing)].join('\n'));
  process.exitCode = 1;
}
if (unpinned.length) {
  console.error('Unpinned live Spire Archive URLs remain in: ' + unpinned.join(', '));
  process.exitCode = 1;
}

const colors = {};
for (const card of cards) colors[card.color] = (colors[card.color] || 0) + 1;

console.log(JSON.stringify({
  snapshot: {
    source_commit: meta.source_commit,
    game_data_version: meta.game_data_version,
    snapshot_date: meta.snapshot_date
  },
  entities: {
    cards: cards.length,
    relics: relics.length,
    powers: powers.length,
    potions: potions.length,
    enchantments: enchantments.length,
    keywords: keywords.length
  },
  cards_by_color: colors,
  graph_endpoint_ids: ids.size,
  manual_links: manualLinks.length,
  status: process.exitCode ? 'failed' : 'ok'
}, null, 2));
