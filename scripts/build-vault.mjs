import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const VAULT = path.join(ROOT, 'vault');
const MANUAL_LINKS_PATH = path.join(ROOT, 'data', 'manual-links.json');

const SOURCES = {
  card: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/cards.json',
  relic: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/relics.json',
  power: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/powers.json',
  potion: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/potions.json',
  enchantment: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/enchantments.json',
  keyword: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/keywords.json'
};

const FOLDERS = {
  card: 'Cards',
  relic: 'Relics',
  power: 'Powers',
  potion: 'Potions',
  enchantment: 'Enchantments',
  keyword: 'Keywords'
};

const START = '<!-- CURATED START -->';
const END = '<!-- CURATED END -->';

const norm = value => String(value ?? '').toLowerCase().trim();
const slug = value => String(value ?? '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
const nodeId = (type, id) => type + ':' + id;

function safeFileName(name) {
  return String(name || 'Untitled')
    .replace(/[\\/:*?"<>|#^\[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function yaml(value) {
  if (Array.isArray(value)) return '[' + value.map(v => JSON.stringify(v)).join(', ') + ']';
  return JSON.stringify(value ?? '');
}

async function load(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load ' + url + ': ' + response.status);
  return response.json();
}

function normalizeData(raw) {
  const nodes = [];

  for (const card of raw.card) {
    nodes.push({
      id: nodeId('card', card.id), sourceId: card.id, type: 'card', name: card.name,
      description: card.description || '', color: card.color || 'unknown', rarity: card.rarity || '',
      cardType: card.type || '', cost: card.cost, keywords: card.keywords || [], tags: card.tags || []
    });
  }

  for (const relic of raw.relic) {
    nodes.push({
      id: nodeId('relic', relic.id), sourceId: relic.id, type: 'relic', name: relic.name,
      description: relic.description || '', color: relic.color || 'shared', rarity: relic.tier || ''
    });
  }

  for (const power of raw.power) {
    nodes.push({
      id: nodeId('power', power.id), sourceId: power.id, type: 'power', name: power.name,
      description: power.description || '', rarity: power.type || ''
    });
  }

  for (const potion of raw.potion) {
    nodes.push({
      id: nodeId('potion', potion.id), sourceId: potion.id, type: 'potion', name: potion.name,
      description: potion.description || '', rarity: potion.rarity || '', color: potion.color || ''
    });
  }

  for (const enchantment of raw.enchantment) {
    nodes.push({
      id: nodeId('enchantment', enchantment.id), sourceId: enchantment.id, type: 'enchantment',
      name: enchantment.name, description: enchantment.description || '', rarity: enchantment.rarity || ''
    });
  }

  for (const keyword of raw.keyword) {
    nodes.push({
      id: nodeId('keyword', keyword.id), sourceId: keyword.id, type: 'keyword',
      name: (keyword.names && keyword.names[0]) || keyword.id, description: keyword.description || ''
    });
  }

  return nodes;
}

function containsEntityName(text, name) {
  const hay = norm(text);
  const needle = norm(name);
  if (!hay || !needle || needle.length < 4) return false;

  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(needle, from);
    if (at === -1) return false;

    const before = at === 0 ? '' : hay[at - 1];
    const afterPos = at + needle.length;
    const after = afterPos >= hay.length ? '' : hay[afterPos];
    const word = /[a-z0-9]/;

    if ((!before || !word.test(before)) && (!after || !word.test(after))) return true;
    from = at + needle.length;
  }

  return false;
}

function inferRelation(text, targetName) {
  const t = norm(text);
  const n = norm(targetName);
  const index = t.indexOf(n);
  const around = index >= 0 ? t.slice(Math.max(0, index - 58), index + n.length + 58) : t;

  if (/add|create|put .* hand|shuffle|transform/.test(around)) return 'creates / moves';
  if (/gain|apply|channel|inflict/.test(around)) return 'grants / applies';
  if (/deal|damage|increase|additional/.test(around)) return 'modifies';
  if (/whenever|when |if |start of|end of/.test(around)) return 'references / triggers';
  return 'references';
}

function buildDetectedEdges(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const cards = nodes.filter(n => n.type === 'card');
  const powers = nodes.filter(n => n.type === 'power');
  const candidates = nodes.filter(n => n.type !== 'keyword' && n.name && n.name.length >= 4);
  const edges = [];
  const seen = new Set();

  const push = (source, target, relation, provenance) => {
    if (!byId.has(source) || !byId.has(target) || source === target) return;
    const key = source + '|' + target + '|' + relation;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, relation, provenance });
  };

  for (const card of cards) {
    for (const keyword of card.keywords || []) {
      const target = nodeId('keyword', slug(keyword));
      if (byId.has(target)) push(card.id, target, 'has keyword', 'explicit');
    }
  }

  for (const source of nodes) {
    for (const target of candidates) {
      if (target.id === source.id) continue;
      if (containsEntityName(source.description, target.name)) {
        push(source.id, target.id, inferRelation(source.description, target.name), 'description');
      }
    }
  }

  for (const card of cards) {
    for (const power of powers) {
      const base = power.name.replace(/\s+Power$/i, '');
      if (norm(card.name) === norm(base)) push(card.id, power.id, 'grants', 'name-match');
    }
  }

  return edges;
}

function extractCurated(content) {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start === -1 || end === -1 || end < start) return '';
  return content.slice(start + START.length, end).trim();
}

async function readExistingCurated(file) {
  if (!existsSync(file)) return '';
  return extractCurated(await readFile(file, 'utf8'));
}

function parseCuratedLinks(sourceNode, curated, pathToId) {
  const links = [];
  const lines = curated.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*-\s*(.*?)\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (!match) continue;

    const relation = match[1].trim().replace(/[:\-]+$/, '').trim() || 'related';
    const targetPath = match[2].trim().replace(/\.md$/i, '');
    const target = pathToId.get(targetPath);

    if (target && target !== sourceNode.id) {
      links.push({ source: sourceNode.id, target, relation, note: 'Curated in Obsidian vault' });
    }
  }

  return links;
}

function wikiLink(node, nodePath) {
  return '[[' + nodePath.replace(/\.md$/i, '') + '|' + node.name + ']]';
}

function noteContent(node, nodePath, detectedOutgoing, curated) {
  const metadata = [
    '---',
    'id: ' + yaml(node.id),
    'source_id: ' + yaml(node.sourceId),
    'entity_type: ' + yaml(node.type),
    node.color ? 'color: ' + yaml(node.color) : null,
    node.rarity ? 'rarity: ' + yaml(node.rarity) : null,
    node.cardType ? 'card_type: ' + yaml(node.cardType) : null,
    node.cost !== undefined ? 'cost: ' + yaml(node.cost) : null,
    node.keywords && node.keywords.length ? 'keywords: ' + yaml(node.keywords) : null,
    '---',
    '',
    '# ' + node.name,
    '',
    node.description || '_No description available._',
    '',
    '## Detected relationships',
    ''
  ].filter(line => line !== null);

  const detected = detectedOutgoing.length
    ? detectedOutgoing.map(item => '- ' + item.edge.relation + ' ' + wikiLink(item.target, item.targetPath) + '  <!-- ' + item.edge.provenance + ' -->')
    : ['_No detected outgoing relationships._'];

  const curatedBody = curated || '<!-- Add typed wikilinks here. Example: - modifies [[Cards/Shiv|Shiv]] -->';

  return metadata.concat(
    detected,
    '',
    '## Curated relationships',
    '',
    START,
    curatedBody,
    END,
    ''
  ).join('\n');
}

async function main() {
  const rawEntries = await Promise.all(
    Object.entries(SOURCES).map(async ([key, url]) => [key, await load(url)])
  );
  const raw = Object.fromEntries(rawEntries);
  const nodes = normalizeData(raw);
  const byId = new Map(nodes.map(n => [n.id, n]));

  await mkdir(VAULT, { recursive: true });
  await mkdir(path.dirname(MANUAL_LINKS_PATH), { recursive: true });

  const nodePaths = new Map();
  const pathToId = new Map();

  for (const node of nodes) {
    const relative = path.posix.join(FOLDERS[node.type], safeFileName(node.name) + '.md');
    nodePaths.set(node.id, relative);
    pathToId.set(relative.replace(/\.md$/i, ''), node.id);
  }

  const curatedById = new Map();
  const manualLinks = [];

  for (const node of nodes) {
    const file = path.join(VAULT, nodePaths.get(node.id));
    const curated = await readExistingCurated(file);
    curatedById.set(node.id, curated);

    for (const link of parseCuratedLinks(node, curated, pathToId)) {
      manualLinks.push(link);
    }
  }

  const detected = buildDetectedEdges(nodes);
  const outgoing = new Map(nodes.map(n => [n.id, []]));

  for (const edge of detected) {
    const target = byId.get(edge.target);
    if (!target) continue;
    outgoing.get(edge.source).push({
      edge,
      target,
      targetPath: nodePaths.get(target.id)
    });
  }

  for (const node of nodes) {
    const relative = nodePaths.get(node.id);
    const file = path.join(VAULT, relative);
    await mkdir(path.dirname(file), { recursive: true });

    const content = noteContent(
      node,
      relative,
      outgoing.get(node.id) || [],
      curatedById.get(node.id) || ''
    );

    await writeFile(file, content, 'utf8');
  }

  manualLinks.sort((a, b) =>
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) ||
    a.relation.localeCompare(b.relation)
  );

  await writeFile(MANUAL_LINKS_PATH, JSON.stringify(manualLinks, null, 2) + '\n', 'utf8');

  const counts = Object.fromEntries(
    Object.entries(FOLDERS).map(([type]) => [type, nodes.filter(n => n.type === type).length])
  );

  console.log('Vault rebuilt:', counts);
  console.log('Curated links exported:', manualLinks.length);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
