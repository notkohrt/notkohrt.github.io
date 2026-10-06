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
  keyword: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/keywords.json',
  mechanics: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/mechanics.json',
  cardPowers: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/card_powers.json'
};

const FOLDERS = {
  card: 'Cards',
  relic: 'Relics',
  power: 'Powers',
  potion: 'Potions',
  enchantment: 'Enchantments',
  keyword: 'Keywords',
  mechanic: 'Mechanics',
  tag: 'Tags',
  effect: 'Effects'
};

const EFFECT_DEFS = [
  { id:'DRAW', name:'Draw', description:'Draw cards from the Draw Pile into the Hand.', patterns:[/\bdraw(?:s|n)?\b(?!\s+pile)/i], relation:'draws' },
  { id:'DISCARD', name:'Discard', description:'Move cards from the Hand to the Discard Pile.', patterns:[/\bdiscard(?:s|ed|ing)?\b(?!\s+pile)/i], relation:'discards' },
  { id:'DAMAGE', name:'Damage', description:'Deal or take combat damage.', patterns:[/\bdeal(?:s)?\b[^.\n]*\bdamage\b/i,/\btake(?:s)?\b[^.\n]*\bdamage\b/i], relation:'deals / takes damage' },
  { id:'HEAL', name:'Heal', description:'Restore Hit Points.', patterns:[/\bheal(?:s|ed|ing)?\b/i], relation:'heals' },
  { id:'LOSE_HP', name:'Lose HP', description:'Lose Hit Points directly.', patterns:[/\blose(?:s)?\b[^.\n]*\bHP\b/i], relation:'loses HP' },
  { id:'UPGRADE', name:'Upgrade', description:'Upgrade a card.', patterns:[/\bupgrade(?:s|d|ing)?\b/i], relation:'upgrades' },
  { id:'TRANSFORM', name:'Transform', description:'Transform one card into another.', patterns:[/\btransform(?:s|ed|ing)?\b/i], relation:'transforms' },
  { id:'CREATE_CARD', name:'Create Card', description:'Create or add a card during combat.', patterns:[/\bcreate(?:s|d|ing)?\b[^.\n]*\bcard/i,/\badd\b[^.\n]*\b(?:card|shiv|status|curse|attack|skill|power)\b[^.\n]*\b(?:hand|pile|deck)\b/i], relation:'creates' },
  { id:'SHUFFLE', name:'Shuffle', description:'Shuffle cards or a pile.', patterns:[/\bshuffle(?:s|d|ing)?\b/i], relation:'shuffles' },
  { id:'CHANNEL', name:'Channel', description:'Channel an Orb.', patterns:[/\bchannel(?:s|ed|ing)?\b/i], relation:'channels' },
  { id:'EVOKE', name:'Evoke', description:'Evoke an Orb.', patterns:[/\bevoke(?:s|d|ing)?\b/i], relation:'evokes' },
  { id:'COST_CHANGE', name:'Cost Modification', description:'Change the Energy cost of a card.', patterns:[/\bcost(?:s)?\b[^.\n]*(?:less|more|0|zero)/i,/\bfree to play\b/i], relation:'modifies cost' }
];

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
      cardType: card.type || '', cost: card.cost, keywords: card.keywords || [], tags: card.tags || [],
      target: card.target || '', vars: card.vars || {}, upgrade: card.upgrade || {}
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

  for (const group of ['core_concepts', 'orbs', 'character_mechanics']) {
    for (const item of (raw.mechanics && raw.mechanics[group]) || []) {
      const name = String(item.title || item.name || item.id || '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();
      nodes.push({
        id: nodeId('mechanic', item.id || slug(name)),
        sourceId: item.id || slug(name),
        type: 'mechanic',
        name,
        description: item.description || '',
        mechanicGroup: group
      });
    }
  }

  const tags = new Set();
  for (const card of raw.card) {
    for (const tag of card.tags || []) tags.add(tag);
  }
  for (const tag of tags) {
    nodes.push({
      id: nodeId('tag', slug(tag)), sourceId: slug(tag), type: 'tag',
      name: tag, description: 'Card tag used by Slay the Spire 2.'
    });
  }

  for (const effect of EFFECT_DEFS) {
    nodes.push({
      id: nodeId('effect', effect.id), sourceId: effect.id, type: 'effect',
      name: effect.name, description: effect.description, systemDerived: true
    });
  }

  return nodes;
}

function entityAliases(name) {
  const base = norm(name).replace(/[{}]/g, '').trim();
  if (!base) return [];

  const aliases = new Set([base]);
  if (!base.endsWith('s')) aliases.add(base + 's');
  if (/[^aeiou]y$/.test(base)) aliases.add(base.slice(0, -1) + 'ies');
  if (/(?:s|x|z|ch|sh)$/.test(base)) aliases.add(base + 'es');

  return [...aliases].sort((a, b) => b.length - a.length);
}

function findEntityMentions(text, name) {
  const hay = norm(text).replace(/[{}]/g, '');
  if (!hay) return [];

  const found = [];

  for (const alias of entityAliases(name)) {
    let from = 0;

    while (from < hay.length) {
      const at = hay.indexOf(alias, from);
      if (at === -1) break;

      const before = at === 0 ? '' : hay[at - 1];
      const afterPos = at + alias.length;
      const after = afterPos >= hay.length ? '' : hay[afterPos];
      const word = /[a-z0-9]/;

      if ((!before || !word.test(before)) && (!after || !word.test(after))) {
        found.push({ index: at, alias });
      }

      from = at + alias.length;
    }
  }

  return found
    .sort((a, b) => a.index - b.index || b.alias.length - a.alias.length)
    .filter((item, index, items) =>
      index === 0 || item.index !== items[index - 1].index
    );
}

function findEntityMention(text, name) {
  return findEntityMentions(text, name)[0] || null;
}

function containsEntityName(text, name) {
  return Boolean(findEntityMention(text, name));
}

function inferRelationAt(text, mention) {
  const t = norm(text).replace(/[{}]/g, '');
  const before = t.slice(Math.max(0, mention.index - 72), mention.index);
  const after = t.slice(mention.index + mention.alias.length, mention.index + mention.alias.length + 72);
  const clauseBefore = before.split(/[.\n]/).pop() || before;
  const clauseAfter = after.split(/[.\n]/)[0] || after;

  if (/\b(?:whenever|when|each time|if|every\s+\d+\s+times)\b/.test(clauseBefore) &&
      /\b(?:play|apply|draw|discard|exhaust|gain|lose|create|deal)\b/.test(clauseBefore)) {
    return 'triggers on';
  }

  if (/\b(?:add|create|shuffle|put)\b[^.\n]{0,42}$/.test(clauseBefore)) return 'creates';
  if (/\btransform\b[^.\n]{0,34}$/.test(clauseBefore)) return 'transforms';
  if (/\bremove\b[^.\n]{0,34}$/.test(clauseBefore)) return 'removes';
  if (/\b(?:lose|loses|reduce|reduces)\b[^.\n]{0,34}$/.test(clauseBefore)) return 'reduces';
  if (/\b(?:apply|inflict)\b[^.\n]{0,30}$/.test(clauseBefore)) return 'applies';
  if (/\bequal to\b[^.\n]{0,24}$/.test(clauseBefore)) return 'scales with';
  if (/\bgain\b[^.\n]{0,28}$/.test(clauseBefore)) return 'grants';
  if (/\b(?:play|plays|played|playing)\b[^.\n]{0,26}$/.test(clauseBefore)) return 'plays';
  if (/\bdiscard(?:s|ed|ing)?\b[^.\n]{0,26}$/.test(clauseBefore)) return 'discards';
  if (/\bexhaust(?:s|ed|ing)?\b[^.\n]{0,26}$/.test(clauseBefore)) return 'exhausts';

  if (/^\s*(?:is\s+)?triggered\b/.test(clauseAfter)) return 'triggers';
  if (/^\s*(?:(?:enemies|creatures|cards|shivs?)\s+)?(?:now\s+)?(?:deal|deals|gain|gains|take|takes|cost|costs|hit|hits|reduce|reduces|increase|increases)\b/.test(clauseAfter)) {
    return 'modifies';
  }
  if (/\bwith\b[^.\n]{0,14}$/.test(clauseBefore) && /\b(?:deal|deals|take|takes|damage|more|less|double)\b/.test(clauseAfter)) {
    return 'modifies';
  }
  if (/\b(?:has|have|with|requires?)\b[^.\n]{0,22}$/.test(clauseBefore)) return 'requires';

  if (/\b(?:additional|double|more|less|increase|reduce|damage)\b/.test(clauseAfter)) return 'modifies';
  return 'references';
}

function inferRelations(text, targetName) {
  return [...new Set(findEntityMentions(text, targetName).map(mention => inferRelationAt(text, mention)))];
}

function inferRelation(text, targetName) {
  return inferRelations(text, targetName)[0] || 'references';
}

function inferEffectRelation(effectId, text, fallback) {
  const t = norm(text);

  if (effectId === 'DISCARD') {
    if (/\b(?:whenever|when|each time)\b[^.\n]{0,48}\bdiscard(?:s|ed|ing)?\b/.test(t)) return 'triggers on discard';
    if (/\bfor each\b[^.\n]{0,42}\bdiscarded\b/.test(t)) return 'scales with discard';
    if (/\bif\b[^.\n]{0,42}\bdiscarded\b/.test(t)) return 'benefits from discard';
    return 'discards';
  }

  if (effectId === 'DRAW') {
    if (/\b(?:whenever|when|each time|every\s+\d+\s+cards?)\b[^.\n]{0,52}\bdraw(?:s|n)?\b/.test(t)) return 'triggers on draw';
    if (/\bfor each\b[^.\n]{0,42}\bdrawn\b/.test(t)) return 'scales with draw';
    if (/\b(?:cannot|may not)\s+draw\b|\bdraw\s+\d+\s+fewer\b/.test(t)) return 'modifies draw';
    return 'draws';
  }

  if (effectId === 'DAMAGE') {
    if (/\b(?:additional|double|more|less)\s+damage\b|\bdamage\b[^.\n]{0,28}\b(?:increased|reduced|doubled)\b/.test(t)) return 'modifies damage';
    if (/\btake(?:s)?\b[^.\n]{0,28}\bdamage\b/.test(t)) return 'takes damage';
    if (/\bdeal(?:s)?\b[^.\n]{0,34}\bdamage\b/.test(t)) return 'deals damage';
  }

  return fallback;
}

function inferPowerRelation(card, powerNode) {
  const text = card.description || '';
  const relations = inferRelations(text, powerNode.name || '');

  if (relations.includes('removes')) return 'removes';
  if (relations.includes('reduces')) return 'reduces';
  if (relations.includes('applies')) return 'applies';
  if (relations.includes('grants')) return 'grants';

  return powerNode.rarity === 'Debuff' ? 'applies' : 'grants';
}

function inferKeywordRelation(text, keywordName) {
  const t = norm(text);
  const k = norm(keywordName);

  if (k === 'exhaust' && /\bexhaust\s+pile\b/.test(t) && !/\bexhaust(?:s|ed|ing)?\b(?!\s+pile)/.test(t)) {
    return null;
  }

  if (k === 'sly' && /\b(?:add|gain|gains)\b[^.\n]{0,36}\bsly\b/.test(t)) return 'grants';
  if (k === 'retain' && /\b(?:gain|gains|retain)\b[^.\n]{0,36}\bretain\b|\bretain\b[^.\n]{0,24}\bcard/.test(t)) return 'grants';

  const relation = inferRelation(text, keywordName);
  return relation === 'references' ? 'uses keyword' : relation;
}

function addPileRelations(source, text, push) {
  if (/\bdraw\s+pile\b/i.test(text)) {
    const relation = /(?:no cards|empty)[^.\n]{0,28}\bdraw\s+pile\b|\bdraw\s+pile\b[^.\n]{0,28}(?:empty|no cards)/i.test(text)
      ? 'requires empty'
      : 'references pile';
    push(source.id, nodeId('mechanic','DRAW_PILE'), relation, 'derived');
  }

  if (/\bdiscard\s+pile\b/i.test(text)) {
    push(source.id, nodeId('mechanic','DISCARD_PILE'), 'references pile', 'derived');
  }

  if (/\bexhaust\s+pile\b/i.test(text)) {
    const relation = /\bplay\b[^.\n]{0,42}\bexhaust\s+pile\b/i.test(text) ? 'plays from' : 'references pile';
    push(source.id, nodeId('mechanic','EXHAUST_PILE'), relation, 'derived');
  }
}

const SILENT_SEMANTIC_OVERRIDES = [
  ['card:BLADE_OF_INK', 'card:SHIV', ['creates']],
  ['card:BLADE_OF_INK', 'enchantment:INKY', ['creates with enchantment']],
  ['card:HAND_TRICK', 'keyword:SLY', ['grants']],
  ['card:MASTER_PLANNER', 'keyword:SLY', ['grants']],
  ['card:WELL_LAID_PLANS', 'keyword:RETAIN', ['grants']],
  ['card:MALAISE', 'power:STRENGTH_POWER', ['reduces']],
  ['card:PIERCING_WAIL', 'power:STRENGTH_POWER', ['reduces']],
  ['card:WRAITH_FORM', 'power:DEXTERITY_POWER', ['reduces']],
  ['card:EXPOSE', 'power:ARTIFACT_POWER', ['removes']],
  ['card:EXPOSE', 'mechanic:BLOCK', ['removes']],
  ['card:BLUR', 'mechanic:BLOCK', ['retains']],
  ['card:SHADOWMELD', 'mechanic:BLOCK', ['modifies']],
  ['card:GRAND_FINALE', 'mechanic:DRAW_PILE', ['requires empty']],
  ['card:KNIFE_TRAP', 'mechanic:EXHAUST_PILE', ['plays from']],
  ['card:ENVENOM', 'effect:DAMAGE', ['triggers on damage']],
  ['card:STORM_OF_STEEL', 'effect:DISCARD', ['discards', 'scales with discard']],
  ['card:BURST', 'mechanic:REPLAY', ['grants']]
];

function buildDetectedEdges(nodes, cardPowers) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const cards = nodes.filter(n => n.type === 'card');
  const powers = nodes.filter(n => n.type === 'power');

  const candidateGroups = new Map();
  for (const candidate of nodes.filter(n => !['keyword','effect'].includes(n.type) && n.name && n.name.length >= 4)) {
    const key = norm(candidate.name);
    if (!candidateGroups.has(key)) candidateGroups.set(key, []);
    candidateGroups.get(key).push(candidate);
  }
  const candidates = [...candidateGroups.values()]
    .filter(group => group.length === 1)
    .map(group => group[0]);

  const keywords = nodes.filter(n => n.type === 'keyword');
  const effects = new Map(EFFECT_DEFS.map(effect => [effect.id, effect]));
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

      if (slug(keyword) === 'SLY') {
        push(card.id, nodeId('effect', 'DISCARD'), 'benefits from discard', 'explicit');
      }
    }

    for (const tag of card.tags || []) {
      const target = nodeId('tag', slug(tag));
      if (byId.has(target)) push(card.id, target, 'has tag', 'explicit');
    }

    for (const power of (cardPowers && cardPowers[card.sourceId]) || []) {
      const target = nodeId('power', power.id);
      const powerNode = byId.get(target);
      if (powerNode) push(card.id, target, inferPowerRelation(card, powerNode), 'explicit');
    }
  }

  for (const source of nodes) {
    for (const target of candidates) {
      if (target.id === source.id) continue;
      if (containsEntityName(source.description, target.name)) {
        for (const relation of inferRelations(source.description, target.name)) {
          const provenance = ['creates','transforms','applies','scales with','grants','plays','discards','exhausts','requires','triggers','triggers on','modifies'].includes(relation)
            ? 'derived'
            : 'description';
          push(source.id, target.id, relation, provenance);
        }
      }
    }

    for (const keyword of keywords) {
      if (containsEntityName(source.description, keyword.name)) {
        const relation = inferKeywordRelation(source.description, keyword.name);
        if (relation) {
          push(
            source.id,
            keyword.id,
            relation,
            relation === 'uses keyword' ? 'description' : 'derived'
          );
        }
      }
    }

    addPileRelations(source, source.description || '', push);

    for (const [effectId, effect] of effects) {
      if (effect.patterns.some(pattern => pattern.test(source.description || ''))) {
        push(
          source.id,
          nodeId('effect', effectId),
          inferEffectRelation(effectId, source.description || '', effect.relation),
          'derived'
        );
      }
    }

    const block = byId.get(nodeId('mechanic','BLOCK'));
    const energy = byId.get(nodeId('mechanic','ENERGY'));
    const hp = byId.get(nodeId('mechanic','HIT_POINTS'));

    if (block && /\bgain(?:s)?\b[^.\n]*\bBlock\b/i.test(source.description || '')) push(source.id, block.id, 'grants', 'derived');
    if (block && /\bremove\b[^.\n]{0,42}\bBlock\b/i.test(source.description || '')) push(source.id, block.id, 'removes', 'derived');
    if (block && /\bBlock\s+gain\b/i.test(source.description || '')) push(source.id, block.id, 'modifies', 'derived');
    if (block && /\bBlock\s+is\s+not\s+removed\b/i.test(source.description || '')) push(source.id, block.id, 'retains', 'derived');
    if (energy && /\bgain(?:s)?\b[^.\n]*(?:\[E\]|Energy)/i.test(source.description || '')) push(source.id, energy.id, 'grants', 'derived');
    if (energy && /\blose(?:s)?\b[^.\n]*(?:\[E\]|Energy)/i.test(source.description || '')) push(source.id, energy.id, 'consumes', 'derived');
    if (hp && /\bheal(?:s|ed|ing)?\b/i.test(source.description || '')) push(source.id, hp.id, 'restores', 'derived');
    if (hp && /\blose(?:s)?\b[^.\n]*\bHP\b/i.test(source.description || '')) push(source.id, hp.id, 'reduces', 'derived');
  }

  const ontologyEdges = [
    ['effect:DRAW', 'mechanic:DRAW_PILE', 'draws from'],
    ['effect:DISCARD', 'mechanic:DISCARD_PILE', 'moves to'],
    ['keyword:EXHAUST', 'mechanic:EXHAUST_PILE', 'moves to'],
    ['keyword:SLY', 'effect:DISCARD', 'triggers when discarded'],
    ['effect:HEAL', 'mechanic:HIT_POINTS', 'restores'],
    ['effect:LOSE_HP', 'mechanic:HIT_POINTS', 'reduces'],
    ['effect:COST_CHANGE', 'mechanic:ENERGY', 'modifies cost']
  ];

  for (const [source, target, relation] of ontologyEdges) {
    push(source, target, relation, 'explicit');
  }

  for (const card of cards) {
    for (const power of powers) {
      const base = power.name.replace(/\s+Power$/i, '');
      if (norm(card.name) === norm(base)) push(card.id, power.id, 'grants', 'name-match');
    }
  }

  for (const [source, target, relations] of SILENT_SEMANTIC_OVERRIDES) {
    if (!byId.has(source) || !byId.has(target)) continue;

    for (let i = edges.length - 1; i >= 0; i -= 1) {
      const edge = edges[i];
      if (edge.source === source && edge.target === target && edge.provenance !== 'explicit') {
        seen.delete(edge.source + '|' + edge.target + '|' + edge.relation);
        edges.splice(i, 1);
      }
    }

    for (const relation of relations) push(source, target, relation, 'curated');
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

  const detected = buildDetectedEdges(nodes, raw.cardPowers);
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
