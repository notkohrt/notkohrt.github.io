import { SOURCES, TYPE_FOLDERS as FOLDERS, normalizeData, buildEdges, createNodePaths, isMechanicalRelation } from '../lib/graph-model.mjs';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const START = '<!-- CURATED START -->';
const END = '<!-- CURATED END -->';

function yaml(value) {
  if (Array.isArray(value)) return '[' + value.map(v => JSON.stringify(v)).join(', ') + ']';
  return JSON.stringify(value ?? '');
}

async function load(source) {
  const file = path.join(ROOT, source);
  return JSON.parse(await readFile(file, 'utf8'));
}

export function extractCurated(content) {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start === -1 || end === -1 || end < start) return '';
  return content.slice(start + START.length, end).trim();
}

async function readExistingCurated(file) {
  if (!existsSync(file)) return '';
  return extractCurated(await readFile(file, 'utf8'));
}

export function parseCuratedLinks(sourceNode, curated, pathToId) {
  const links = [];
  const lines = curated.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*-\s*(.*?)\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (!match) continue;

    const relation = match[1].trim().replace(/[:\-]+$/, '').trim();
    const targetPath = match[2].trim().replace(/\.md$/i, '');
    const target = pathToId.get(targetPath);

    if (!isMechanicalRelation(relation)) {
      throw new Error(sourceNode.id + ': use a specific mechanical relation for ' + targetPath);
    }
    if (!target || target === sourceNode.id) {
      throw new Error(sourceNode.id + ': invalid curated target ' + targetPath);
    }
    links.push({ source: sourceNode.id, target, relation, note: 'Curated in Obsidian vault' });
  }

  return links;
}

function wikiLink(node, nodePath) {
  return '[[' + nodePath.replace(/\.md$/i, '') + '|' + node.name + ']]';
}

export function noteContent(node, detectedOutgoing, curated) {
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
    node.tags && node.tags.length ? 'tags: ' + yaml(node.tags) : null,
    node.target ? 'target: ' + yaml(node.target) : null,
    node.mechanicGroup ? 'mechanic_group: ' + yaml(node.mechanicGroup) : null,
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
    '',
    '---',
    '',
    'Slay the Spire 2 and its game content are by [Mega Crit](https://www.megacrit.com/). STS2 Bubble is an unofficial fan project.',
    ''
  ).join('\n');
}

export async function buildVault({ output = ROOT } = {}) {
  const VAULT = path.join(path.resolve(output), 'vault');
  const MANUAL_LINKS_PATH = path.join(path.resolve(output), 'data', 'manual-links.json');
  const rawEntries = await Promise.all(
    Object.entries(SOURCES).map(async ([key, url]) => [key, await load(url)])
  );
  const raw = Object.fromEntries(rawEntries);
  const nodes = normalizeData(raw);
  const byId = new Map(nodes.map(n => [n.id, n]));

  await mkdir(VAULT, { recursive: true });
  await mkdir(path.dirname(MANUAL_LINKS_PATH), { recursive: true });

  const nodePaths = createNodePaths(nodes);
  const pathToId = new Map([...nodePaths].map(([id, file]) => [file.replace(/\.md$/i, ''), id]));

  const curatedById = new Map();
  const manualLinks = [];

  for (const node of nodes) {
    const file = path.join(VAULT, nodePaths.get(node.id));
    const curated = await readExistingCurated(existsSync(file) ? file : path.join(ROOT, 'vault', nodePaths.get(node.id)));
    curatedById.set(node.id, curated);

    for (const link of parseCuratedLinks(node, curated, pathToId)) {
      manualLinks.push(link);
    }
  }

  const detected = buildEdges(nodes, [], raw.cardPowers);
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

  return { counts, nodes: nodePaths.size, detected: detected.length, manualLinks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { output: { type: 'string' } } });
    const result = await buildVault({ output: values.output });
    console.log('Vault rebuilt:', result.counts);
    console.log('Vault notes:', result.nodes);
    console.log('Detected relationships:', result.detected);
    console.log('Curated links exported:', result.manualLinks.length);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
