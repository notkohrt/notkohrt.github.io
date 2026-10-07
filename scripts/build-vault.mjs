import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const VAULT = path.join(ROOT, 'vault');
const MANUAL_LINKS_PATH = path.join(ROOT, 'data', 'manual-links.json');

const SOURCES = {
  card: 'data/sts2/cards.json',
  relic: 'data/sts2/relics.json',
  power: 'data/sts2/powers.json',
  potion: 'data/sts2/potions.json',
  enchantment: 'data/sts2/enchantments.json',
  keyword: 'data/sts2/keywords.json',
  mechanics: 'data/sts2/mechanics.json',
  cardPowers: 'data/sts2/card_powers.json'
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

const CARD_TYPE_MECHANICS = [
  { id:'CARD_TYPE_ATTACK', name:'Attack Cards', description:'Cards with the Attack type.' },
  { id:'CARD_TYPE_SKILL', name:'Skill Cards', description:'Cards with the Skill type.' },
  { id:'CARD_TYPE_POWER', name:'Power Cards', description:'Cards with the Power type.' },
  { id:'CARD_TYPE_STATUS', name:'Status Cards', description:'Cards with the Status type.' },
  { id:'CARD_TYPE_COLORLESS', name:'Colorless Cards', description:'Cards from the Colorless pool.' }
];

const SYSTEM_MECHANICS = [
  { id:'ORB_SYSTEM', name:'Orbs', description:'The Defect orb system and channeled Orb state.', group:'orbs' },
  { id:'ORB_SLOTS', name:'Orb Slots', description:'Capacity for Channeled Orbs.', group:'orbs' },
  { id:'OSTY', name:'Osty', description:'The Necrobinder companion controlled through Summon and Osty-specific cards.', group:'character_mechanics' }
];

const EFFECT_DEFS = [
  { id:'DRAW', name:'Draw', description:'Draw cards from the Draw Pile into the Hand.', patterns:[/\bdraw(?:s|n)?\b(?!\s+pile)/i], relation:'draws' },
  { id:'DISCARD', name:'Discard', description:'Move cards from the Hand to the Discard Pile.', patterns:[/\bdiscard(?:s|ed|ing)?\b(?!\s+pile)/i], relation:'discards' },
  { id:'EXHAUST_CARD', name:'Exhaust Card', description:'Exhaust a card and move it to the Exhaust Pile.', patterns:[/\bexhaust(?:s|ed|ing)?\b(?!\s+pile)/i], relation:'exhausts cards' },
  { id:'PLAY_CARD', name:'Play Card', description:'Play cards from the Hand or by another effect.', patterns:[/\bplay(?:s|ed|ing)?\b/i], relation:'plays cards' },
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

async function load(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error('Failed to load ' + source + ': ' + response.status);
    return response.json();
  }

  const file = path.join(ROOT, source);
  return JSON.parse(await readFile(file, 'utf8'));
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

  for (const item of SYSTEM_MECHANICS) {
    nodes.push({
      id: nodeId('mechanic', item.id),
      sourceId: item.id,
      type: 'mechanic',
      name: item.name,
      description: item.description,
      mechanicGroup: item.group,
      systemDerived: true
    });
  }

  for (const item of CARD_TYPE_MECHANICS) {
    nodes.push({
      id: nodeId('mechanic', item.id),
      sourceId: item.id,
      type: 'mechanic',
      name: item.name,
      description: item.description,
      mechanicGroup: 'card_types',
      systemDerived: true
    });
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

  if (/\b(?:whenever|when|each time|first time|if|every\s+\d+\s+times)\b/.test(clauseBefore) &&
      /\b(?:play|apply|draw|discard|exhaust|gain|lose|create|deal)\b/.test(clauseBefore)) {
    return 'triggers on';
  }

  if (/\b(?:add|create|shuffle|put)\b[^.\n]{0,42}$/.test(clauseBefore)) return 'creates';
  if (/\btransform\b[^.\n]{0,34}$/.test(clauseBefore)) return 'transforms';
  if (/\bremove\b[^.\n]{0,34}$/.test(clauseBefore)) return 'removes';
  if (/\b(?:lose|loses|reduce|reduces)\b[^.\n]{0,34}$/.test(clauseBefore)) return 'reduces';
  if (/\b(?:apply|inflict)\b[^.\n]{0,30}$/.test(clauseBefore)) return 'applies';
  if (/\bequal to\b[^.\n]{0,24}$/.test(clauseBefore)) return 'scales with';
  if (/\b(?:gain|give)\b[^.\n]{0,34}$/.test(clauseBefore)) return 'grants';
  if (/\bfor each\b[^.\n]{0,46}$/.test(clauseBefore)) return 'scales with';
  if (/\bdouble\b[^.\n]{0,30}$/.test(clauseBefore)) return 'modifies';
  if (/\bif\b[^.\n]{0,52}$/.test(clauseBefore)) return 'requires';
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

  if (effectId === 'EXHAUST_CARD') {
    if (/\b(?:whenever|when|each time|first time)\b[^.\n]{0,56}\bexhaust(?:s|ed|ing)?\b/.test(t)) return 'triggers on exhaust';
    if (/\bfor each\b[^.\n]{0,48}\bexhausted\b/.test(t)) return 'scales with exhaust';
    if (/\bif\b[^.\n]{0,48}\bexhausted\b/.test(t)) return 'requires exhaust';
    return 'exhausts cards';
  }

  if (effectId === 'LOSE_HP') {
    if (/\b(?:whenever|when|each time|first time)\b[^.\n]{0,56}\b(?:lose|lost)\b[^.\n]{0,24}\bhp\b/.test(t)) return 'triggers on HP loss';
    if (/\bfor each\b[^.\n]{0,56}\b(?:lose|lost)\b[^.\n]{0,24}\bhp\b/.test(t)) return 'scales with HP loss';
    if (/\bif\b[^.\n]{0,48}\b(?:lose|lost)\b[^.\n]{0,24}\bhp\b/.test(t)) return 'requires HP loss';
    return 'loses HP';
  }

  if (effectId === 'PLAY_CARD') {
    if (/\b(?:whenever|when|each time)\b[^.\n]{0,52}\bplay(?:s|ed|ing)?\b/.test(t)) return 'triggers on card play';
    if (/\bfirst\b[^.\n]{0,34}\bplay(?:s|ed|ing)?\b/.test(t)) return 'triggers on card play';
    if (/\bfor each\b[^.\n]{0,46}\bplayed\b/.test(t)) return 'scales with cards played';
    if (/\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) return 'repeats card play';
    if (/\bnext\b[^.\n]{0,36}\b(?:skill|attack|card)\b[^.\n]{0,30}\bplay(?:ed)?\b/.test(t)) return 'modifies next card play';
    if (/\bfree\s+to\s+play\b/.test(t)) return 'modifies card play';
    if (/\b(?:can only|cannot|can't|may not)\b[^.\n]{0,28}\bplayed?\b/.test(t)) return 'restricts card play';
    return 'plays cards';
  }

  if (effectId === 'CREATE_CARD') {
    if (/\b(?:whenever|when|each time|first time)\b[^.\n]{0,52}\bcreate(?:s|d|ing)?\s+(?:a\s+)?card\b/.test(t)) return 'triggers on card creation';
    if (/\bfor each\b[^.\n]{0,48}\bcard\s+(?:you\s+)?created\b/.test(t)) return 'scales with card creation';
    if (/\bcopy\s+of\s+this\s+card\b/.test(t)) return 'creates copy of self';
    if (/\bcopy\b[^.\n]{0,36}\binto\s+your\s+hand\b/.test(t)) return 'creates copy';
    return fallback;
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

  if (k === 'exhaust') return null;

  if (k === 'sly' && /\b(?:add|gain|gains)\b[^.\n]{0,36}\bsly\b/.test(t)) return 'grants';
  if (k === 'retain' && /\b(?:gain|gains|retain)\b[^.\n]{0,36}\bretain\b|\bretain\b[^.\n]{0,24}\bcard/.test(t)) return 'grants';

  const relation = inferRelation(text, keywordName);
  return relation === 'references' ? 'uses keyword' : relation;
}

function addPileRelations(source, text, push) {
  if (/\bdraw\s+pile\b/i.test(text)) {
    if (/(?:no cards|empty)[^.\n]{0,28}\bdraw\s+pile\b|\bdraw\s+pile\b[^.\n]{0,28}(?:empty|no cards)/i.test(text)) {
      push(source.id, nodeId('mechanic','DRAW_PILE'), 'requires empty', 'derived');
    }
  }

  if (/\bfrom\s+(?:your\s+)?discard\s+pile\b[^.\n]{0,52}\b(?:hand|draw\s+pile)\b/i.test(text) ||
      /\bput\b[^.\n]{0,46}\bdiscard\s+pile\b[^.\n]{0,46}\b(?:hand|draw\s+pile)\b/i.test(text)) {
    push(source.id, nodeId('mechanic','DISCARD_PILE'), 'moves from', 'derived');
  }
  if (/\bdiscard\s+pile\b[^.\n]{0,60}\bdraw\s+pile\b/i.test(text)) push(source.id, nodeId('mechanic','DRAW_PILE'), 'moves to', 'derived');
  if (/\bfrom\s+(?:your\s+)?draw\s+pile\b[^.\n]{0,52}\bhand\b/i.test(text) ||
      /\bput\b[^.\n]{0,46}\bdraw\s+pile\b[^.\n]{0,46}\bhand\b/i.test(text)) {
    push(source.id, nodeId('mechanic','DRAW_PILE'), 'moves from', 'derived');
  }
  if (/\bfrom\s+(?:your\s+)?hand\b[^.\n]{0,52}\b(?:top of )?(?:your\s+)?draw\s+pile\b/i.test(text) ||
      /\bput\b[^.\n]{0,38}\bhand\b[^.\n]{0,46}\bdraw\s+pile\b/i.test(text)) {
    push(source.id, nodeId('mechanic','DRAW_PILE'), 'moves to', 'derived');
  }
  if (/\bplay\b[^.\n]{0,46}\bfrom\s+(?:your\s+)?draw\s+pile\b|\bplay\s+the\s+top\b[^.\n]{0,34}\bdraw\s+pile\b/i.test(text)) {
    push(source.id, nodeId('mechanic','DRAW_PILE'), 'plays from', 'derived');
  }

  if (/\bexhaust\s+pile\b/i.test(text)) {
    let relation = null;
    if (/\bplay\b[^.\n]{0,42}\bexhaust\s+pile\b/i.test(text)) relation = 'plays from';
    else if (/\bfor each\b[^.\n]{0,52}\bexhaust\s+pile\b/i.test(text)) relation = 'scales with pile size';
    else if (/\bif\b[^.\n]{0,52}\bexhaust\s+pile\b/i.test(text)) relation = 'requires pile state';
    if (relation) push(source.id, nodeId('mechanic','EXHAUST_PILE'), relation, 'derived');
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

const IRONCLAD_SEMANTIC_OVERRIDES = [
  ['card:ASHEN_STRIKE', 'mechanic:EXHAUST_PILE', ['scales with pile size']],
  ['card:BODY_SLAM', 'mechanic:BLOCK', ['scales with']],
  ['card:BARRICADE', 'mechanic:BLOCK', ['retains']],
  ['card:BULLY', 'power:VULNERABLE_POWER', ['scales with']],
  ['card:DISMANTLE', 'power:VULNERABLE_POWER', ['requires']],
  ['card:DOMINATE', 'power:VULNERABLE_POWER', ['applies', 'scales with']],
  ['card:MOLTEN_FIST', 'power:VULNERABLE_POWER', ['modifies']],
  ['card:COLOSSUS', 'power:VULNERABLE_POWER', ['requires']],
  ['card:CRUELTY', 'power:VULNERABLE_POWER', ['modifies damage vs']],
  ['card:VICIOUS', 'power:VULNERABLE_POWER', ['triggers on application']],
  ['card:COLOSSUS', 'effect:DAMAGE', ['reduces incoming damage vs Vulnerable']],
  ['card:CRUELTY', 'effect:DAMAGE', ['increases damage vs Vulnerable']],
  ['card:BATTLE_TRANCE', 'effect:DRAW', ['draws', 'modifies draw']],
  ['card:HELLRAISER', 'effect:DRAW', ['triggers on draw']],
  ['card:HELLRAISER', 'effect:PLAY_CARD', ['plays drawn cards']],
  ['card:JUGGERNAUT', 'mechanic:BLOCK', ['triggers on']],
  ['card:UNMOVABLE', 'mechanic:BLOCK', ['modifies']],
  ['card:FIGHT_ME', 'power:STRENGTH_POWER', ['grants to self & enemy']],
  ['card:MANGLE', 'power:STRENGTH_POWER', ['reduces']],
  ['card:RUPTURE', 'effect:LOSE_HP', ['triggers on HP loss']],
  ['card:INFERNO', 'effect:LOSE_HP', ['loses HP', 'triggers on HP loss']],
  ['card:SPITE', 'effect:LOSE_HP', ['requires HP loss']],
  ['card:TEAR_ASUNDER', 'effect:LOSE_HP', ['scales with HP loss']],
  ['card:DRUM_OF_BATTLE', 'effect:EXHAUST_CARD', ['triggers on exhaust']],
  ['card:EVIL_EYE', 'effect:EXHAUST_CARD', ['requires exhaust']],
  ['card:FEEL_NO_PAIN', 'effect:EXHAUST_CARD', ['triggers on exhaust']],
  ['card:DARK_EMBRACE', 'effect:EXHAUST_CARD', ['triggers on exhaust']],
  ['card:FORGOTTEN_RITUAL', 'effect:EXHAUST_CARD', ['requires exhaust']],
  ['card:FIEND_FIRE', 'effect:EXHAUST_CARD', ['exhausts cards', 'scales with exhaust']],
  ['card:SECOND_WIND', 'effect:EXHAUST_CARD', ['exhausts cards', 'scales with exhaust']],
  ['card:STOKE', 'effect:EXHAUST_CARD', ['exhausts cards', 'scales with exhaust']],
  ['card:CORRUPTION', 'effect:EXHAUST_CARD', ['triggers on card play', 'exhausts cards']],
  ['card:HAVOC', 'mechanic:DRAW_PILE', ['plays from']],
  ['card:HEADBUTT', 'mechanic:DISCARD_PILE', ['moves from']],
  ['card:HEADBUTT', 'mechanic:DRAW_PILE', ['moves to']],
  ['card:CASCADE', 'mechanic:DRAW_PILE', ['plays from']],
  ['card:HOWL_FROM_BEYOND', 'mechanic:EXHAUST_PILE', ['plays from']],
  ['card:PACTS_END', 'mechanic:EXHAUST_PILE', ['requires pile state']],
  ['card:FEED', 'mechanic:HIT_POINTS', ['increases Max HP']],
  ['relic:CHARONS_ASHES', 'effect:EXHAUST_CARD', ['triggers on exhaust']],
  ['relic:DEMON_TONGUE', 'effect:LOSE_HP', ['triggers on HP loss']],
  ['relic:SELF_FORMING_CLAY', 'effect:LOSE_HP', ['triggers on HP loss']],
  ['relic:RED_SKULL', 'mechanic:HIT_POINTS', ['requires low HP']],
  ['relic:RED_SKULL', 'power:STRENGTH_POWER', ['grants']],
  ['relic:RUINED_HELMET', 'power:STRENGTH_POWER', ['modifies']],
  ['relic:PAPER_PHROG', 'power:VULNERABLE_POWER', ['modifies']],
  ['relic:PAPER_PHROG', 'effect:DAMAGE', ['increases damage vs Vulnerable']],
  ['relic:BRIMSTONE', 'power:STRENGTH_POWER', ['grants to self & enemies']]
];

const DEFECT_SEMANTIC_OVERRIDES = [
  ['card:BIASED_COGNITION', 'power:FOCUS_POWER', ['grants', 'reduces over time']],
  ['relic:DATA_DISK', 'power:FOCUS_POWER', ['grants']],
  ['card:BULK_UP', 'mechanic:ORB_SLOTS', ['reduces']],
  ['card:CAPACITOR', 'mechanic:ORB_SLOTS', ['grants']],
  ['card:MODDED', 'mechanic:ORB_SLOTS', ['grants']],
  ['relic:RUNIC_CAPACITOR', 'mechanic:ORB_SLOTS', ['grants']],
  ['card:BARRAGE', 'mechanic:ORB_SYSTEM', ['scales with Channeled Orbs']],
  ['card:COMPILE_DRIVER', 'mechanic:ORB_SYSTEM', ['scales with unique Orbs']],
  ['card:COOLANT', 'mechanic:ORB_SYSTEM', ['scales with unique Orbs']],
  ['card:SYNCHRONIZE', 'mechanic:ORB_SYSTEM', ['scales with unique Orbs']],
  ['card:LOOP', 'mechanic:ORB_SYSTEM', ['triggers passive']],
  ['relic:EMOTION_CHIP', 'effect:LOSE_HP', ['requires HP loss']],
  ['relic:EMOTION_CHIP', 'mechanic:ORB_SYSTEM', ['triggers passive']],
  ['relic:GOLD_PLATED_CABLES', 'mechanic:ORB_SYSTEM', ['triggers passive']],
  ['relic:METRONOME', 'mechanic:ORB_SYSTEM', ['triggers after 7 Channels']],
  ['card:DARKNESS', 'mechanic:DARK', ['channels', 'triggers passive']],
  ['card:THUNDER', 'mechanic:LIGHTNING', ['triggers on Evoke']],
  ['card:VOLTAIC', 'mechanic:LIGHTNING', ['scales with previously Channeled']]
];

const NECROBINDER_SEMANTIC_OVERRIDES = [
  ['card:DEATHS_DOOR', 'power:DOOM_POWER', ['requires Doom application']],
  ['card:END_OF_DAYS', 'power:DOOM_POWER', ['applies', 'kills at Doom ≥ HP']],
  ['card:NO_ESCAPE', 'power:DOOM_POWER', ['applies', 'scales with existing Doom']],
  ['card:TIMES_UP', 'power:DOOM_POWER', ['scales with Doom']],
  ['card:SHROUD', 'power:DOOM_POWER', ['triggers on Doom application']],
  ['card:REAPER_FORM', 'power:DOOM_POWER', ['applies from Attack damage']],
  ['relic:BOOK_REPAIR_KNIFE', 'power:DOOM_POWER', ['triggers on Doom kill']],
  ['relic:UNDYING_SIGIL', 'power:DOOM_POWER', ['modifies damage at Doom ≥ HP']],
  ['card:DEVOUR_LIFE', 'card:SOUL', ['triggers on Soul play']],
  ['card:HAUNT', 'card:SOUL', ['triggers on Soul play']],
  ['card:SOUL_STORM', 'card:SOUL', ['scales with Souls in Exhaust Pile']],
  ['card:SEANCE', 'card:SOUL', ['transforms into']],
  ['relic:BONE_FLUTE', 'mechanic:OSTY', ['triggers on attack']],
  ['card:NECRO_MASTERY', 'mechanic:OSTY', ['triggers on HP loss']],
  ['card:BONE_SHARDS', 'mechanic:OSTY', ['requires alive', 'sacrifices']],
  ['card:SACRIFICE', 'mechanic:OSTY', ['requires alive', 'sacrifices']],
  ['card:FLATTEN', 'mechanic:OSTY', ['requires prior attack']],
  ['card:SQUEEZE', 'mechanic:OSTY', ['scales with Osty Attacks']],
  ['card:PROTECTOR', 'mechanic:OSTY', ['scales with Max HP']],
  ['card:UNLEASH', 'mechanic:OSTY', ['scales with HP']],
  ['card:SIC_EM', 'mechanic:OSTY', ['triggers on hit']]
];

const REGENT_SEMANTIC_OVERRIDES = [
  ['card:CRESCENT_SPEAR', 'mechanic:STAR_COUNT', ['scales with Star-cost cards']],
  ['card:RADIATE', 'mechanic:STAR_COUNT', ['scales with Stars gained']],
  ['card:CHILD_OF_THE_STARS', 'mechanic:STAR_COUNT', ['triggers on Stars spent', 'scales with Stars spent']],
  ['relic:GALACTIC_DUST', 'mechanic:STAR_COUNT', ['scales with Stars spent']],
  ['relic:MINI_REGENT', 'mechanic:STAR_COUNT', ['triggers on Stars spent']],
  ['card:CONQUEROR', 'card:SOVEREIGN_BLADE', ['modifies damage']],
  ['card:PARRY', 'card:SOVEREIGN_BLADE', ['grants Block']],
  ['card:SEEKING_EDGE', 'card:SOVEREIGN_BLADE', ['modifies target scope']],
  ['card:SWORD_SAGE', 'card:SOVEREIGN_BLADE', ['grants Replay']],
  ['card:SUMMON_FORTH', 'card:SOVEREIGN_BLADE', ['moves to Hand']],
  ['card:I_AM_INVINCIBLE', 'mechanic:DRAW_PILE', ['plays from top']],
  ['card:FOREGONE_CONCLUSION', 'mechanic:DRAW_PILE', ['moves from']],
  ['card:GLIMMER', 'mechanic:DRAW_PILE', ['moves to']],
  ['card:PHOTON_CUT', 'mechanic:DRAW_PILE', ['moves to']],
  ['card:SHINING_STRIKE', 'mechanic:DRAW_PILE', ['moves to']],
  ['card:HEIRLOOM_HAMMER', 'mechanic:CARD_TYPE_COLORLESS', ['copies Colorless card']],
  ['relic:VITRUVIAN_MINION', 'tag:MINION', ['modifies Minion cards']]
];

function addCardTypeRelations(source, text, push) {
  const t = norm(text);
  const attack = nodeId('mechanic','CARD_TYPE_ATTACK');
  const skill = nodeId('mechanic','CARD_TYPE_SKILL');
  const power = nodeId('mechanic','CARD_TYPE_POWER');

  if (/\bwhenever\b[^.\n]{0,42}\bplay\s+an?\s+attack\b/.test(t)) push(source.id, attack, 'triggers on Attack play', 'derived');
  if (/\bfirst\b[^.\n]{0,34}\battack\b[^.\n]{0,30}\bplay/.test(t)) push(source.id, attack, 'triggers on Attack play', 'derived');
  if (/\bnext\s+attack\b[^.\n]{0,44}\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) push(source.id, attack, 'repeats next Attack', 'derived');
  if (/\bnext\s+attack\b[^.\n]{0,44}\bcosts?\s+0\b/.test(t)) push(source.id, attack, 'modifies next Attack cost', 'derived');
  if (/\bfor each\s+attack\b[^.\n]{0,30}\bin your hand\b/.test(t)) push(source.id, attack, 'scales with Attacks in hand', 'derived');
  if (/\bfor each\s+attack\b[^.\n]{0,30}\bplayed\b/.test(t) || /\bfor each\s+attack\s+played\b/.test(t)) push(source.id, attack, 'scales with Attacks played', 'derived');
  if (/\bcosts?\s+\d+\s+less\b[^.\n]{0,34}\bfor each attack played\b/.test(t)) push(source.id, attack, 'scales cost with Attacks played', 'derived');
  if (/\brandom\s+attack\b[^.\n]{0,42}\bdiscard pile\b[^.\n]{0,42}\bhand\b/.test(t)) push(source.id, attack, 'moves Attack from Discard to Hand', 'derived');
  if (/\badd\b[^.\n]{0,28}\brandom\s+attack\b[^.\n]{0,34}\bhand\b/.test(t)) push(source.id, attack, 'creates', 'derived');
  if (/\btransform\s+all\s+attacks\b/.test(t)) push(source.id, attack, 'transforms Attacks', 'derived');
  if (/\bdraw\s+cards\s+until\s+you\s+draw\s+a\s+non-attack\b/.test(t)) push(source.id, attack, 'draw condition', 'derived');
  if (/\brandom\s+attack\b[^.\n]{0,28}\bis played\b/.test(t)) push(source.id, attack, 'plays Attack', 'derived');

  if (/\bskills?\s+cost\s+0\b/.test(t)) push(source.id, skill, 'modifies Skill cost', 'derived');
  if (/\bwhenever\b[^.\n]{0,38}\bplay\s+a\s+skill\b[^.\n]{0,38}\bexhaust\b/.test(t)) push(source.id, skill, 'exhausts Skills on play', 'derived');
  if (/\bnext\s+skill\b[^.\n]{0,42}\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) push(source.id, skill, 'repeats next Skill', 'derived');
  if (/\bwhen\b[^.\n]{0,36}\bplay\s+a\s+skill\b/.test(t)) push(source.id, skill, 'triggers on Skill play', 'derived');
  if (/\badd\s+sly\s+to\s+a\s+skill\b/.test(t)) push(source.id, skill, 'modifies Skill', 'derived');
  if (/\bfor each\s+skill\s+played\b/.test(t)) push(source.id, skill, 'scales with Skills played', 'derived');
  if (/\bdraw\s+a\s+skill\b/.test(t)) push(source.id, skill, 'requires drawn Skill', 'derived');

  if (/\bwhenever\b[^.\n]{0,38}\bplay\s+a\s+power\b/.test(t)) push(source.id, power, 'triggers on Power play', 'derived');
  if (/\bnext\s+power\b[^.\n]{0,42}\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) push(source.id, power, 'repeats next Power', 'derived');

  const status = nodeId('mechanic','CARD_TYPE_STATUS');
  const colorless = nodeId('mechanic','CARD_TYPE_COLORLESS');

  if (/\b(?:whenever|when|each time)\b[^.\n]{0,48}\bcreate(?:s|d|ing)?\s+(?:a\s+)?status\b/.test(t)) push(source.id, status, 'triggers on Status creation', 'derived');
  else if (/\b(?:create|creates|created)\s+(?:a\s+)?status\b/.test(t)) push(source.id, status, 'creates Status', 'derived');
  if (/\bexhaust\s+(?:all\s+)?(?:your\s+)?status\s+cards?\b/.test(t)) push(source.id, status, 'exhausts Status cards', 'derived');
  if (/\bdraw\s+(?:a\s+)?status\b/.test(t)) push(source.id, status, 'triggers on Status draw', 'derived');
  if (/\btransform\s+(?:all\s+)?status\s+cards?\b/.test(t)) push(source.id, status, 'transforms Status cards', 'derived');

  if (/\badd\b[^.\n]{0,34}\bcolorless\s+card/.test(t)) push(source.id, colorless, 'creates Colorless card', 'derived');
  if (/\bcopy\b[^.\n]{0,34}\bcolorless\s+card/.test(t)) push(source.id, colorless, 'copies Colorless card', 'derived');
}

function addTagSemanticRelations(source, text, push) {
  const t = norm(text);

  if (/\bcontaining\s+[“"]?strike[”"]?\b/.test(t) || /\bcards?\b[^.\n]{0,24}\bstrike\b/.test(t)) {
    const strike = nodeId('tag','STRIKE');

    if (/\bfor\s+(?:all|each)\b[^.\n]{0,42}\bstrike\b/.test(t)) push(source.id, strike, 'scales with Strike cards', 'derived');
    else if (/\bdraw\b[^.\n]{0,42}\bstrike\b/.test(t)) push(source.id, strike, 'triggers on drawing Strike', 'derived');
  }

  if (/\bcards?\s+containing\s+[“"]?minion[”"]?\b/.test(t)) {
    push(source.id, nodeId('tag','MINION'), 'modifies Minion cards', 'derived');
  }
}

function addCharacterMechanicRelations(source, text, push) {
  const t = norm(text);
  const orbSystem = nodeId('mechanic','ORB_SYSTEM');
  const orbSlots = nodeId('mechanic','ORB_SLOTS');
  const osty = nodeId('mechanic','OSTY');
  const summon = nodeId('mechanic','SUMMON');
  const forge = nodeId('mechanic','FORGE');
  const replay = nodeId('mechanic','REPLAY');
  const fatal = nodeId('mechanic','FATAL');
  const stars = nodeId('mechanic','STAR_COUNT');

  const orbNames = [['LIGHTNING','lightning'],['FROST','frost'],['DARK','dark'],['PLASMA','plasma'],['GLASS','glass']];
  for (const [id, name] of orbNames) {
    if (new RegExp('\\bchannel(?:s|ed|ing)?\\b[^.\\n]{0,30}\\b' + name + '\\b').test(t)) push(source.id, nodeId('mechanic',id), 'channels', 'derived');
    if (new RegExp('\\bevoke(?:s|d|ing)?\\b[^.\\n]{0,30}\\b' + name + '\\b').test(t)) push(source.id, nodeId('mechanic',id), 'evokes', 'derived');
    if (new RegExp('\\btrigger\\b[^.\\n]{0,40}\\bpassive\\b[^.\\n]{0,34}\\b' + name + '\\b').test(t)) push(source.id, nodeId('mechanic',id), 'triggers passive', 'derived');
  }

  if (/\bchannel(?:s|ed|ing)?\b[^.\n]{0,34}\borbs?\b|\bchanneled\s+orb\b/.test(t)) {
    const relation = /\bfor each\b[^.\n]{0,42}\b(?:channeled\s+)?orb\b/.test(t) ? 'scales with Channeled Orbs' : 'channels';
    push(source.id, orbSystem, relation, 'derived');
  }
  if (/\bevoke(?:s|d|ing)?\b[^.\n]{0,34}\borbs?\b/.test(t)) push(source.id, orbSystem, 'evokes', 'derived');
  if (/\btrigger\b[^.\n]{0,42}\bpassive\b[^.\n]{0,38}\borbs?\b/.test(t)) push(source.id, orbSystem, 'triggers passive', 'derived');
  if (/\bfor each unique orb\b/.test(t)) push(source.id, orbSystem, 'scales with unique Orbs', 'derived');

  if (/\bgain\s+\d+\s+(?:additional\s+)?orb slots?\b/.test(t)) push(source.id, orbSlots, 'grants', 'derived');
  if (/\blose\s+\d+\s+orb slots?\b/.test(t)) push(source.id, orbSlots, 'reduces', 'derived');
  if (/\badditional\s+orb slots?\b/.test(t) && !/\bgain\b/.test(t)) push(source.id, orbSlots, 'grants', 'derived');

  if (/\bsummon\b/.test(t)) push(source.id, summon, 'summons / strengthens Osty', 'derived');
  if (/\bosty\b/.test(t)) {
    let relation = 'interacts with';
    if (/\bosty\b[^.\n]{0,30}\b(?:deal|deals|attack|attacks)\b/.test(t)) relation = 'commands attack';
    if (/\bosty\b[^.\n]{0,30}\bheal(?:s|ed|ing)?\b/.test(t)) relation = 'heals';
    if (/\bosty\b[^.\n]{0,30}\bdies?\b/.test(t)) relation = 'sacrifices';
    if (/\bif\s+osty\s+is\s+alive\b/.test(t)) relation = 'requires alive';
    if (/\bosty(?:'s)?\s+current\s+hp\b/.test(t)) relation = 'scales with HP';
    if (/\bosty(?:'s)?\s+attacks?\b[^.\n]{0,34}\badditional\s+damage\b/.test(t)) relation = 'modifies damage';
    push(source.id, osty, relation, 'derived');
  }

  if (/\bforge\b/.test(t)) push(source.id, forge, /\bwhenever\b[^.\n]{0,30}\bforge\b/.test(t) ? 'triggers on Forge' : 'forges', 'derived');
  if (/\breplay\b/.test(t)) push(source.id, replay, 'grants Replay', 'derived');
  if (/\bfatal\b|\bif this kills?\b/.test(t)) push(source.id, fatal, 'triggers on kill', 'derived');

  if (/\[s\]/.test(t)) {
    let relation = 'uses Stars';
    if (/\bwhenever\s+you\s+(?:spend|gain)\b[^.\n]{0,22}\[s\]/.test(t) || /\bfirst time\s+you\s+spend\b[^.\n]{0,22}\[s\]/.test(t)) relation = 'triggers on Stars';
    else if (/\bfor (?:each|every)\b[^.\n]{0,42}\[s\]/.test(t) || /\[s\]\s+cost/.test(t) || /\beach\s+\[s\]\s+spent\b/.test(t)) relation = 'scales with Stars';
    else if (/\bspend\b[^.\n]{0,24}\[s\]/.test(t)) relation = 'spends Stars';
    else if (/\bgain\b[^.\n]{0,30}\[s\]/.test(t)) relation = 'gains Stars';
    push(source.id, stars, relation, 'derived');
  }
}

function buildDetectedEdges(nodes, cardPowers) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const cards = nodes.filter(n => n.type === 'card');
  const powers = nodes.filter(n => n.type === 'power');

  const candidateGroups = new Map();
  const dedicatedMechanics = new Set([
    'mechanic:BLOCK',
    'mechanic:ENERGY',
    'mechanic:HIT_POINTS',
    'mechanic:DRAW_PILE',
    'mechanic:DISCARD_PILE',
    'mechanic:EXHAUST_PILE',
    'mechanic:ORB_SYSTEM',
    'mechanic:ORB_SLOTS',
    'mechanic:OSTY',
    'mechanic:SUMMON',
    'mechanic:FORGE',
    'mechanic:REPLAY',
    'mechanic:FATAL',
    'mechanic:STAR_COUNT',
    'mechanic:CARD_TYPE_ATTACK',
    'mechanic:CARD_TYPE_SKILL',
    'mechanic:CARD_TYPE_POWER',
    'mechanic:CARD_TYPE_STATUS',
    'mechanic:CARD_TYPE_COLORLESS',
    'mechanic:LIGHTNING',
    'mechanic:FROST',
    'mechanic:DARK',
    'mechanic:PLASMA',
    'mechanic:GLASS'
  ]);

  for (const candidate of nodes.filter(n =>
    !['keyword','effect'].includes(n.type) &&
    !dedicatedMechanics.has(n.id) &&
    n.name &&
    n.name.length >= 4
  )) {
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

      if (slug(keyword) === 'EXHAUST') {
        push(card.id, nodeId('effect', 'EXHAUST_CARD'), 'self-exhausts', 'explicit');
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
          if (relation === 'references') continue;
          push(source.id, target.id, relation, 'derived');
        }
      }
    }

    for (const keyword of keywords) {
      if (containsEntityName(source.description, keyword.name)) {
        const relation = inferKeywordRelation(source.description, keyword.name);
        if (relation && relation !== 'uses keyword') {
          push(source.id, keyword.id, relation, 'derived');
        }
      }
    }

    addPileRelations(source, source.description || '', push);

    for (const [effectId, effect] of effects) {
      const text = source.description || '';
      if (!effect.patterns.some(pattern => pattern.test(text))) continue;

      const relation = inferEffectRelation(effectId, text, effect.relation);

      // Plain damage/play edges turn the graph into high-degree hubs without
      // adding interaction meaning. Keep modifiers, triggers, requirements, etc.
      if (effectId === 'DAMAGE' && relation === 'deals damage') continue;
      if (effectId === 'PLAY_CARD' && relation === 'plays cards') continue;

      // Prefer a concrete generated-card edge over a second generic Create Card edge.
      if (effectId === 'CREATE_CARD') {
        const hasConcreteCreate = edges.some(edge =>
          edge.source === source.id &&
          edge.relation === 'creates' &&
          byId.get(edge.target)?.type !== 'effect'
        );
        if (hasConcreteCreate) continue;
      }

      push(source.id, nodeId('effect', effectId), relation, 'derived');
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
    if (hp && /\b(?:raise|increase)\b[^.\n]{0,42}\bMax HP\b/i.test(source.description || '')) push(source.id, hp.id, 'increases Max HP', 'derived');
    if (hp && /\bHP\b[^.\n]{0,24}\b(?:at or below|below|less than|under)\b[^.\n]{0,18}\b\d+%/i.test(source.description || '')) push(source.id, hp.id, 'requires low HP', 'derived');
  }

  const ontologyEdges = [
    ['effect:DRAW', 'mechanic:DRAW_PILE', 'draws from'],
    ['effect:DISCARD', 'mechanic:DISCARD_PILE', 'moves to'],
    ['keyword:EXHAUST', 'mechanic:EXHAUST_PILE', 'moves to'],
    ['effect:EXHAUST_CARD', 'mechanic:EXHAUST_PILE', 'moves cards to'],
    ['keyword:SLY', 'effect:DISCARD', 'triggers when discarded'],
    ['effect:HEAL', 'mechanic:HIT_POINTS', 'restores'],
    ['effect:LOSE_HP', 'mechanic:HIT_POINTS', 'reduces'],
    ['effect:COST_CHANGE', 'mechanic:ENERGY', 'modifies cost'],
    ['power:FOCUS_POWER', 'mechanic:ORB_SYSTEM', 'modifies effectiveness'],
    ['mechanic:ORB_SLOTS', 'mechanic:ORB_SYSTEM', 'sets capacity'],
    ['mechanic:SUMMON', 'mechanic:OSTY', 'summons / strengthens'],
    ['mechanic:FORGE', 'card:SOVEREIGN_BLADE', 'modifies damage'],
    ['mechanic:FORGE', 'card:SOVEREIGN_BLADE', 'creates on first Forge'],
    ['mechanic:REPLAY', 'effect:PLAY_CARD', 'repeats card play']
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

  for (const [source, target, relations] of [
    ...SILENT_SEMANTIC_OVERRIDES,
    ...IRONCLAD_SEMANTIC_OVERRIDES,
    ...DEFECT_SEMANTIC_OVERRIDES,
    ...NECROBINDER_SEMANTIC_OVERRIDES,
    ...REGENT_SEMANTIC_OVERRIDES
  ]) {
    if (!byId.has(source) || !byId.has(target)) continue;

    for (let i = edges.length - 1; i >= 0; i -= 1) {
      const edge = edges[i];
      if (edge.source === source && edge.target === target) {
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

  // Names are user-facing, but they are not guaranteed unique. Use the source
  // ID only when a folder/name collision exists so normal notes stay clean.
  const basePathCounts = new Map();
  for (const node of nodes) {
    const base = path.posix.join(FOLDERS[node.type], safeFileName(node.name));
    basePathCounts.set(base, (basePathCounts.get(base) || 0) + 1);
  }

  for (const node of nodes) {
    const base = path.posix.join(FOLDERS[node.type], safeFileName(node.name));
    const fileStem = (basePathCounts.get(base) || 0) > 1
      ? base + ' [' + safeFileName(node.sourceId) + ']'
      : base;
    const relative = fileStem + '.md';

    nodePaths.set(node.id, relative);
    pathToId.set(fileStem, node.id);
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
  console.log('Vault notes:', nodePaths.size);
  console.log('Collision-safe note paths:', [...basePathCounts.values()].filter(count => count > 1).length);
  console.log('Detected relationships:', detected.length);
  console.log('Curated links exported:', manualLinks.length);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
