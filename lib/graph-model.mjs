// Pure graph model shared by the website, validation and Obsidian generator.
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

const SOURCE_META_URL = 'data/sts2/meta.json';

const TYPE_FOLDERS = {
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

const RELATION_FAMILIES = {
  creation: { label: 'Create / transform', color: '#72b6d9' },
  application: { label: 'Apply / grant', color: '#70b58a' },
  trigger: { label: 'Triggers / payoffs', color: '#d5a85f' },
  scaling: { label: 'Scaling', color: '#b985d6' },
  requirement: { label: 'Requirements', color: '#d27b72' },
  movement: { label: 'Move / play', color: '#7f9fd1' },
  modification: { label: 'Modify / retain', color: '#c58aa8' },
  resource: { label: 'Resources / actions', color: '#8da56e' },
  property: { label: 'Keywords / tags', color: '#9a875f' },
  other: { label: 'Other', color: '#6f747c' }
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
  { id:'UPGRADE', name:'Upgrade', description:'Upgrade a card.', patterns:[/\bupgrad(?:e[sd]?|ing)\b/i], relation:'upgrades' },
  { id:'TRANSFORM', name:'Transform', description:'Transform one card into another.', patterns:[/\btransform(?:s|ed|ing)?\b/i], relation:'transforms' },
  { id:'CREATE_CARD', name:'Create Card', description:'Create a card or add one to the Hand, a pile, or the Deck.', patterns:[/\bcreat(?:e[sd]?|ing)\b[^.\n]*\b(?:cards?|status|copies|copy|attacks?|skills?|powers?)\b/i,/\badd\b[^.\n]*\b(?:cards?|shivs?|status|curses?|attacks?|skills?|powers?|copies|copy)\b[^.\n]*\b(?:hand|pile|deck)\b/i,/\badd\s+(?:a\s+)?random\s+(?:attacks?|skills?|powers?|status|curse)\b/i], relation:'creates' },
  { id:'SHUFFLE', name:'Shuffle', description:'Shuffle cards or a pile.', patterns:[/\bshuffl(?:e[sd]?|ing)\b/i], relation:'shuffles' },
  { id:'CHANNEL', name:'Channel', description:'Channel an Orb.', patterns:[/\bchannel(?:s|ed|ing)?\b/i], relation:'channels' },
  { id:'EVOKE', name:'Evoke', description:'Evoke an Orb.', patterns:[/\bevok(?:e[sd]?|ing)\b/i], relation:'evokes' },
  { id:'COST_CHANGE', name:'Cost Modification', description:'Change the Energy cost of a card.', patterns:[/\bcosts?\b/i,/\bfree to play\b/i], relation:'modifies cost' }
];

const norm = value => String(value ?? '').toLowerCase().trim();
const slug = value => String(value ?? '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
const nodeId = (type, id) => type + ':' + id;

const ACTION_FORMS = {
  add: ['add', 'adds', 'added', 'adding'], create: ['create', 'creates', 'created', 'creating'],
  shuffle: ['shuffle', 'shuffles', 'shuffled', 'shuffling'], put: ['put', 'puts', 'putting'],
  transform: ['transform', 'transforms', 'transformed', 'transforming'],
  remove: ['remove', 'removes', 'removed', 'removing'], lose: ['lose', 'loses', 'lost', 'losing'],
  reduce: ['reduce', 'reduces', 'reduced', 'reducing'], apply: ['apply', 'applies', 'applied', 'applying'],
  inflict: ['inflict', 'inflicts', 'inflicted', 'inflicting'], gain: ['gain', 'gains', 'gained', 'gaining'],
  give: ['give', 'gives', 'given', 'giving'], double: ['double', 'doubles', 'doubled', 'doubling'],
  play: ['play', 'plays', 'played', 'playing'], discard: ['discard', 'discards', 'discarded', 'discarding'],
  exhaust: ['exhaust', 'exhausts', 'exhausted', 'exhausting']
};
const ACTION_STEMS = new Map(Object.entries(ACTION_FORMS).flatMap(([stem, forms]) => forms.map(form => [form, stem])));
const ACTION_PATTERN = new RegExp('\\b(' + [...ACTION_STEMS.keys()].join('|') + ')\\b', 'g');

function isMechanicalRelation(relation) {
  return typeof relation === 'string' && Boolean(relation.trim()) &&
    !/^(?:(?:related|references|synergizes)(?:\s+with)?|interacts\s+with|uses\s+(?:Stars|keyword))$/i.test(relation.trim());
}

function normalizeData(raw) {
  const nodes = [];

  for (const card of raw.card) {
    nodes.push({
      id: nodeId('card', card.id),
      sourceId: card.id,
      type: 'card',
      name: card.name,
      description: card.description || '',
      color: card.color || 'unknown',
      rarity: card.rarity || '',
      cardType: card.type || '',
      cost: card.cost,
      starCost: card.star_cost,
      keywords: card.keywords || [],
      tags: card.tags || [],
      target: card.target || '',
      vars: card.vars || {},
      upgrade: card.upgrade || {},
      imageUrl: card.image_url || ''
    });
  }

  for (const relic of raw.relic) {
    nodes.push({
      id: nodeId('relic', relic.id),
      sourceId: relic.id,
      type: 'relic',
      name: relic.name,
      description: relic.description || '',
      color: relic.color || 'shared',
      rarity: relic.tier || ''
    });
  }

  for (const power of raw.power) {
    nodes.push({
      id: nodeId('power', power.id),
      sourceId: power.id,
      type: 'power',
      name: power.name,
      description: power.description || '',
      rarity: power.type || '',
      stackable: power.stackable
    });
  }

  for (const potion of raw.potion) {
    nodes.push({
      id: nodeId('potion', potion.id),
      sourceId: potion.id,
      type: 'potion',
      name: potion.name,
      description: potion.description || '',
      rarity: potion.rarity || '',
      color: potion.color || '',
      target: potion.target || ''
    });
  }

  for (const ench of raw.enchantment) {
    nodes.push({
      id: nodeId('enchantment', ench.id),
      sourceId: ench.id,
      type: 'enchantment',
      name: ench.name,
      description: ench.description || '',
      rarity: ench.rarity || ''
    });
  }

  for (const kw of raw.keyword) {
    nodes.push({
      id: nodeId('keyword', kw.id),
      sourceId: kw.id,
      type: 'keyword',
      name: (kw.names && kw.names[0]) || kw.id,
      description: kw.description || ''
    });
  }

  const mechanicGroups = ['core_concepts', 'orbs', 'character_mechanics'];
  for (const group of mechanicGroups) {
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
      id: nodeId('tag', slug(tag)),
      sourceId: slug(tag),
      type: 'tag',
      name: tag,
      description: 'Card tag used by Slay the Spire 2.'
    });
  }

  for (const effect of EFFECT_DEFS) {
    nodes.push({
      id: nodeId('effect', effect.id),
      sourceId: effect.id,
      type: 'effect',
      name: effect.name,
      description: effect.description,
      systemDerived: true
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
  const before = t.slice(0, mention.index);
  const after = t.slice(mention.index + mention.alias.length, mention.index + mention.alias.length + 72);
  // A comma separates a condition from its reward. Classify the clause that
  // contains this mention, rather than letting an earlier trigger claim it.
  const clauseBefore = before.split(/[.\n;,]/).pop() || '';
  const clauseAfter = after.split(/[.\n]/)[0] || after;

  if (/\b(?:whenever|when|each time|first time|every\s+(?:\d+\s+)?(?:time|times))\b/.test(clauseBefore) &&
      ([...clauseBefore.matchAll(ACTION_PATTERN)].length || /\b(?:draw|draws|drawn|deal|deals|take|takes)\b/.test(clauseBefore))) {
    return 'triggers on';
  }

  if (/\bif\b/.test(clauseBefore)) return 'requires';
  if (/\bequal to\b[^.\n]{0,24}$/.test(clauseBefore)) return 'scales with';
  if (/\bfor each\b[^.\n]{0,46}$/.test(clauseBefore)) return 'scales with';

  // The nearest action owns its object: "lose Strength and gain Dexterity"
  // must not reduce Dexterity just because "lose" appeared first.
  const actions = [...clauseBefore.matchAll(ACTION_PATTERN)];
  const action = actions.at(-1);
  if (action && clauseBefore.length - action.index < 80) {
    const stem = ACTION_STEMS.get(action[1]);
    const previous = actions.at(-2);
    const prefix = clauseBefore.slice(previous ? previous.index + previous[0].length : 0, action.index);
    if (/\b(?:cannot|can't|no longer|may not|do not)\b/.test(prefix)) {
      return 'prevents ' + stem;
    }
    if (['add', 'create', 'shuffle', 'put'].includes(stem)) return 'creates';
    if (stem === 'transform') return 'transforms';
    if (stem === 'remove') return 'removes';
    if (['lose', 'reduce'].includes(stem)) return 'reduces';
    if (['apply', 'inflict'].includes(stem)) return 'applies';
    if (['gain', 'give'].includes(stem)) return 'grants';
    if (stem === 'double') return 'modifies';
    if (stem === 'play') return 'plays';
    if (stem === 'discard') return 'discards';
    if (stem === 'exhaust') return 'exhausts';
  }

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

// Line breaks in the published descriptions often wrap a sentence. Commas,
// periods and semicolons delimit conditions and rewards, including repeated
// uses of the same mechanic. Match effects separately in each such clause.
function mechanicClauses(text) {
  return String(text ?? '').replace(/\s+/g, ' ').split(/[.;,]+/).map(clause => clause.trim()).filter(Boolean);
}

// A negation belongs to its first action. Carry it across an explicit "or"
// list ("cannot be removed or transformed"), but not into an independent
// reward ("cannot discard and draw 1 card"). Keep this scope vocabulary
// separate from the entity-mention verbs, which assign different object roles.
const EFFECT_ACTION_PATTERN = new RegExp('\\b(?:' + [...ACTION_STEMS.keys()].join('|') +
  '|draw(?:s|n|ing)?|heal(?:s|ed|ing)?|upgrad(?:e[sd]?|ing)|channel(?:s|ed|ing)?|evok(?:e[sd]?|ing)|deal(?:s)?|take(?:s)?|spend(?:s|ing)?)\\b', 'g');

function effectMatches(effectId, text) {
  const effect = EFFECT_DEFS.find(item => item.id === effectId);
  return effect.patterns.flatMap(pattern => [...text.matchAll(new RegExp(pattern.source, 'gi'))])
    .sort((a, b) => a.index - b.index);
}

// A past participle before a card noun can describe its state. An actor or
// auxiliary immediately before it instead identifies an action, e.g. "you
// Upgraded a card" or "have Upgraded cards". Keep character/type adjectives.
function isCardStateModifier(text, match) {
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return /^\s+(?:(?:\w[\w-]*|\d+)\s+){0,2}(?:cards?|attacks?|skills?|powers?|shivs?|copies|copy)\b/.test(after) &&
    !/\b(?:(?:you|we|they|i)(?:'ve|'d)?|(?:he|she|it|who)(?:'s|'d)?|player|ally|enemy|(?:have|has|had|is|are|was|were)(?:n't)?|be|been|being)(?:\s+(?:not|never|no longer))?\s*$/.test(before);
}

function isNegatedEffectAction(text, at) {
  const prefix = text.slice(0, at);
  const cue = [...prefix.matchAll(/\b(?:cannot|can't|no longer|may not|must not|do not|does not|did not|don't|doesn't|didn't|haven't|hasn't|hadn't|isn't|aren't|wasn't|weren't|not(?!\s+only)|never|prevent(?:s|ed|ing)?)\b/g)].at(-1);
  if (!cue) return false;
  const start = cue.index + cue[0].length;
  const actions = [...prefix.slice(start).matchAll(EFFECT_ACTION_PATTERN)];
  return actions.every((action, index) => {
    const end = start + action.index + action[0].length;
    const next = index + 1 < actions.length ? start + actions[index + 1].index : at;
    return /\bor\s+(?:be\s+)?$/.test(text.slice(end, next));
  });
}

function negatedEffectRelation(text, at, concept, prevention = 'prevents ' + concept) {
  if (!isNegatedEffectAction(text, at)) return null;
  const prefix = text.slice(0, at);
  if (/\bif\b/.test(prefix)) return 'requires no ' + concept;
  if (/\b(?:whenever|when|each time)\b/.test(prefix)) return 'triggers on prevented ' + concept;
  return prevention;
}

function cardCreationAction(text) {
  const actions = [...text.matchAll(/\b(?:creat(?:e[sd]?|ing)|add)\b/g)];
  for (const [index, action] of actions.entries()) {
    const segment = text.slice(action.index, actions[index + 1]?.index);
    if (!EFFECT_DEFS.find(effect => effect.id === 'CREATE_CARD').patterns.some(pattern => pattern.test(segment))) continue;
    if (action[0] === 'add') {
      const destination = segment.match(/\b(?:to|into)\b/);
      const object = destination ? segment.slice(0, destination.index) : segment;
      // In "add Replay to a card in your Hand", the card is the recipient.
      // Actual creation has a card/type object before the destination.
      if (!/\b(?:cards?|shivs?|status|curses?|attacks?|skills?|powers?|copies|copy)\b/.test(object)) continue;
      if (/\bto\s+(?:(?:a|an|the|your|chosen|selected|random)\s+)*(?:cards?|attacks?|skills?|powers?)\b/.test(segment)) continue;
      if (!/\b(?:copy|copies)\b/.test(object) && /\bfrom\s+(?:(?:your|the|a|an)\s+)?(?:hand|deck|(?:draw|discard|exhaust)\s+pile)\b/.test(segment)) continue;
    }
    return action;
  }
  return null;
}

function hasCostModification(text) {
  const changesCostBefore = /\b(?:reduc(?:e[sd]?|ing)|increas(?:e[sd]?|ing)|randomiz(?:e[sd]?|ing)|chang(?:e[sd]?|ing)|set(?:s|ting)?|lower(?:s|ed|ing)?|rais(?:e[sd]?|ing))\s+(?:(?:the|a|an|this|that|its|their|your|all|selected|chosen|random|next|[a-z]+'s|cards?'?|energy)\s+)*$/;
  for (const match of text.matchAll(/\bcosts?\b|\bfree to play\b/g)) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    // A relative clause or condition selects cards by their existing cost.
    // It does not assign a new cost: "play a card that costs 2 or more".
    if (/\b(?:that|which|with(?:\s+a)?|do not|does not|don't|doesn't)\s*$/.test(before)) continue;
    if (/^\s+(?:x|\d+)\s+cards?\b/.test(after)) continue;
    const changedBefore = changesCostBefore.test(before);
    if (/\b(?:if|whenever|when|each time)\b/.test(before) && !changedBefore) continue;
    if (match[0] === 'free to play') {
      if (/\b(?:that|which)\s+(?:is|are)\s*$/.test(before)) continue;
      return true;
    }
    if (changedBefore || /^\s+(?:(?:\d+|a|an|\[e\]|energy)\s*)*(?:less|more|extra|additional)\b/.test(after) ||
        /^(?:\s+of\b[\w\s'’\[\]-]*?)?\s+(?:is|are|was|were|becomes?|be)\s+(?:randomized|reduced|increased|changed|set|lowered|raised)\b/.test(after) ||
        /^\s+(?:0\b|zero\b|\d+\s*(?:\[e\]|energy\b))/.test(after)) return true;
  }
  return false;
}

function inferEffectRelations(effectId, text) {
  const effect = EFFECT_DEFS.find(item => item.id === effectId);
  if (!effect) return [];
  const clauses = mechanicClauses(text);
  const relations = clauses
    .filter(clause => effect.patterns.some(pattern => pattern.test(clause)))
    .map(clause => inferEffectRelation(effectId, clause, effect.relation)).filter(Boolean);
  // An explicit HP-loss condition can supply the omitted object of its reward:
  // "Whenever you would lose HP, lose 1 less."
  if (effectId === 'LOSE_HP' && clauses.some((clause, index) =>
    index > 0 && /\blose\s+\d+\s+less\b/i.test(clause) && effect.patterns.some(pattern => pattern.test(clauses[index - 1]))
  )) relations.push('modifies HP loss');
  return [...new Set(relations)];
}

function addResourceRelations(source, text, pushEdge) {
  const emit = (target, relation) => pushEdge(source.id, 'mechanic:' + target, relation, 'derived');
  for (const clause of mechanicClauses(text)) {
    const startsWithBlock = /\bstart(?:s)?\b.{0,32}\bwith\s+\d+\s+Block\b/i.test(clause);
    if (startsWithBlock) emit('BLOCK', 'grants');
    for (const relation of inferRelations(clause, 'Block')) {
      if (['grants', 'removes', 'modifies', 'prevents gain'].includes(relation)) emit('BLOCK', relation);
      if (relation === 'triggers on') {
        const addsBlockCard = /\badd\b.{0,24}\bcard\s+that\s+gains?\s+Block\b/i.test(clause);
        emit('BLOCK', addsBlockCard ? 'triggers on adding Block cards' : 'triggers on Block gain');
      }
      if (relation === 'requires' && !startsWithBlock) emit('BLOCK', /\b(?:without|no)\s+Block\b/i.test(clause) ? 'requires no Block' : 'requires Block');
    }
    if (/\bBlock\s+is\s+not\s+removed\b/i.test(clause)) emit('BLOCK', 'retains');

    const energyText = clause.replace(/\[E\]/gi, ' Energy ');
    for (const mention of findEntityMentions(energyText, 'Energy')) {
      const relation = inferRelationAt(energyText, mention);
      if (['grants', 'prevents gain'].includes(relation)) emit('ENERGY', relation);
      // Reducing a card's Energy cost is not consuming Energy.
      const actions = [...norm(energyText).slice(0, mention.index).matchAll(ACTION_PATTERN)];
      if (relation === 'reduces' && ACTION_STEMS.get(actions.at(-1)?.[1]) === 'lose') emit('ENERGY', 'consumes');
      if (relation === 'triggers on' && /\bgain(?:s)?\b/i.test(energyText)) emit('ENERGY', 'triggers on Energy gain');
    }
  }

  for (const relation of inferEffectRelations('LOSE_HP', text)) emit('HIT_POINTS', relation === 'loses HP' ? 'reduces' : relation);
  for (const relation of inferEffectRelations('HEAL', text)) emit('HIT_POINTS', relation === 'heals' ? 'restores' : relation);
  if (/\b(?:raise|increase)\b[^.\n]{0,42}\bMax HP\b/i.test(text)) emit('HIT_POINTS', 'increases Max HP');
  if (/\bHP\b[^.\n]{0,24}\b(?:at or below|below|less than|under)\b[^.\n]{0,18}\b\d+%/i.test(text)) emit('HIT_POINTS', 'requires low HP');
}

function inferEffectRelation(effectId, text, fallback) {
  const t = norm(text);
  const matches = effectMatches(effectId, t);
  let at = matches[0]?.index ?? Infinity;

  if (effectId === 'UPGRADE') {
    const action = matches.find(match => match[0] !== 'upgraded' || !isCardStateModifier(t, match));
    if (!action) {
      if (!matches.length) return null;
      const prefix = t.slice(0, at);
      if (/\bfor (?:each|every)\b/.test(prefix)) return 'scales with upgraded cards';
      // Creating an already upgraded card does not upgrade an existing card.
      if (cardCreationAction(t)) return null;
      if (/\b(?:deal(?:s)?|gain(?:s)?|give(?:s)?|cost(?:s)?|play(?:s|ed)?)\b/.test(t.slice(at))) return 'requires upgraded cards';
      return null;
    }
    at = action.index;
  }

  // The generic Transform effect is a card operation. Explicit self-
  // transformation into another entity kind must not become that card edge.
  if (effectId === 'TRANSFORM' && /^transform(?:s|ed|ing)?\s+into\s+[^.]*\b(?:relics?|potions?|orbs?)\b/.test(t.slice(at))) return null;

  if (effectId === 'DISCARD') {
    // Consuming a potion is distinct from the card-discard mechanic.
    if (/\bpotion\s+is\s+discarded\b/.test(t) && !/\bcards?\b/.test(t)) return null;
    const negated = negatedEffectRelation(t, at, 'discard');
    if (negated) return negated;
    if (/\b(?:whenever|when|each time)\b[^.\n]{0,48}\bdiscard(?:s|ed|ing)?\b/.test(t)) return 'triggers on discard';
    if (/\bfor each\b[^.\n]{0,42}\bdiscarded\b/.test(t)) return 'scales with discard';
    if (/\bif\b[^.\n]{0,42}\bdiscarded\b/.test(t)) return 'benefits from discard';
    return 'discards';
  }

  if (effectId === 'DRAW') {
    const negated = negatedEffectRelation(t, at, 'draw', 'modifies draw');
    if (negated) return negated;
    if (/\b(?:whenever|when|each time|first time|every\s+\d+\s+cards?)\b[^.\n]{0,52}\bdraw(?:s|n)?\b/.test(t)) return 'triggers on draw';
    if (/\bfor each\b[^.\n]{0,42}\bdrawn\b/.test(t)) return 'scales with draw';
    if (/\bif\b[^.\n]{0,48}\bdraw(?:s|n)?\b/.test(t)) return 'requires draw';
    if (/\b(?:cannot|may not)\s+draw\b|\bdraw\s+\d+\s+fewer\b/.test(t)) return 'modifies draw';
    return 'draws';
  }

  if (effectId === 'EXHAUST_CARD') {
    const negated = negatedEffectRelation(t, at, 'exhaust');
    if (negated) return negated;
    if (/\b(?:whenever|when|each time|first time)\b[^.\n]{0,56}\bexhaust(?:s|ed|ing)?\b/.test(t)) return 'triggers on exhaust';
    if (/\bfor each\b[^.\n]{0,48}\bexhausted\b/.test(t)) return 'scales with exhaust';
    if (/\bif\b[^.\n]{0,48}\bexhausted\b/.test(t)) return 'requires exhaust';
    return 'exhausts cards';
  }

  if (effectId === 'LOSE_HP') {
    if (/\bcannot\s+lose\s+more\s+than\b/.test(t)) return 'limits HP loss';
    if (/\b(?:cannot|can't|no longer|may not|do not)\b[^.\n]{0,24}\blose\b/.test(t)) return 'prevents HP loss';
    if (/\blose\b[^.\n]{0,28}\b(?:less|fewer)\b/.test(t)) return 'modifies HP loss';
    if (/\b(?:whenever|when|each time|first time)\b[^.\n]{0,56}\b(?:lose|loses|lost)\b[^.\n]{0,24}\bhp\b/.test(t)) return 'triggers on HP loss';
    if (/\bfor each\b[^.\n]{0,56}\b(?:lose|loses|lost)\b[^.\n]{0,24}\bhp\b/.test(t)) return 'scales with HP loss';
    if (/\bif\b[^.\n]{0,48}\b(?:lose|loses|lost)\b[^.\n]{0,24}\bhp\b/.test(t)) return 'requires HP loss';
    return 'loses HP';
  }

  if (effectId === 'PLAY_CARD') {
    if (/\bif\b[^.\n]{0,32}\b(?:do not|did not|have not)\s+play\b/.test(t)) {
      const type = t.match(/\bplay\s+(?:any\s+)?(attacks?|skills?|powers?)\b/)?.[1];
      return 'requires no ' + (type ? type.replace(/s$/, '').replace(/^./, char => char.toUpperCase()) : 'card') + ' play';
    }
    const negated = negatedEffectRelation(t, at, 'card play', 'restricts card play');
    if (negated) return negated;
    if (/\bif\b[^.\n]{0,64}\bplay(?:s|ed|ing)?\b/.test(t)) return 'requires card play';
    if (/\b(?:whenever|when|each time)\b[^.\n]{0,52}\bplay(?:s|ed|ing)?\b/.test(t)) return 'triggers on card play';
    if (/\bfirst\b[^.\n]{0,34}\bplay(?:s|ed|ing)?\b/.test(t)) return 'triggers on card play';
    if (/\bevery\s+\d+\s+cards?\b[^.\n]{0,24}\bplay\b/.test(t)) return 'triggers on card play';
    if (/\bfor each\b[^.\n]{0,46}\bplayed\b/.test(t)) return 'scales with cards played';
    if (/\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) return 'repeats card play';
    if (/\bnext\b[^.\n]{0,36}\b(?:skill|attack|card)\b[^.\n]{0,30}\bplay(?:ed)?\b/.test(t)) return 'modifies next card play';
    if (/\bfree\s+to\s+play\b/.test(t)) return 'modifies card play';
    if (/\bcan only\b[^.\n]{0,28}\bplay(?:ed)?\b/.test(t)) return 'restricts card play';
    if (/^(?:it|this card|cards?)\s+(?:is|are)\s+played\b/.test(t)) return 'plays cards automatically';
    return 'plays cards';
  }

  if (effectId === 'CREATE_CARD') {
    const action = cardCreationAction(t);
    if (!action) return null;
    const concept = action[0] === 'add' ? 'card addition' : 'card creation';
    const negated = negatedEffectRelation(t, action.index, concept);
    if (negated) return negated;
    if (/\b(?:whenever|when|each time|first time)\b/.test(t.slice(0, action.index))) return 'triggers on ' + concept;
    if (/\bfor each\b[^.\n]{0,48}\bcard\s+(?:you\s+)?created\b/.test(t)) return 'scales with card creation';
    if (/\bcopy\s+of\s+this\s+card\b/.test(t)) return 'creates copy of self';
    if (/\bcopy\b[^.\n]{0,36}\binto\s+your\s+hand\b/.test(t)) return 'creates copy';
    return fallback;
  }

  if (effectId === 'COST_CHANGE') return hasCostModification(t) ? fallback : null;

  if (effectId === 'DAMAGE') {
    if (/\b(?:whenever|when|each time)\b[^.\n]{0,56}\b(?:deal|deals|take|takes)\b[^.\n]{0,28}\bdamage\b/.test(t)) return 'triggers on damage';
    if (/\b(?:additional|double|half|more|less)\s+damage\b|\bdamage\b[^.\n]{0,28}\b(?:increased|reduced|doubled)\b/.test(t)) return 'modifies damage';
    if (/\btake(?:s)?\b[^.\n]{0,28}\bdamage\b/.test(t)) return 'takes damage';
    if (/\bdeal(?:s)?\b[^.\n]{0,34}\bdamage\b/.test(t)) return 'deals damage';
  }

  const concept = { HEAL: 'heal', UPGRADE: 'upgrade', TRANSFORM: 'transformation', SHUFFLE: 'shuffle', CHANNEL: 'channel', EVOKE: 'evoke' }[effectId];
  if (concept) {
    if (effectId === 'CHANNEL' && !/\bchannel(?:s|ing)?\b/.test(t) && !/\b(?:is|are|was|were|be)\s+channeled\b/.test(t)) return null;
    const prefix = t.slice(0, at);
    const negated = negatedEffectRelation(t, at, concept);
    if (negated) return negated;
    if (/\b(?:whenever|when|each time|first time)\b/.test(prefix)) return 'triggers on ' + concept;
    if (/\bfor (?:each|every)\b/.test(prefix)) return 'scales with ' + concept;
    if (/\bif\b/.test(prefix)) return 'requires ' + concept;
  }

  return fallback;
}

function inferPowerRelations(card, powerNode) {
  const text = card.description || '';
  const name = powerNode.name || '';
  const fallback = powerNode.rarity === 'Debuff' ? 'applies' : 'grants';
  // A same-named card and persistent power are ambiguous in prose ("Hang
  // cards"). The explicit mapping identifies the applied effect in that case.
  if (norm(card.name) === norm(name)) return [fallback];
  const relations = inferRelations(text, name).filter(relation => relation !== 'references');
  // Explicit card/power metadata also describes unnamed persistent effects.
  // Named effects can have several roles, such as both granting and reducing.
  return relations.length ? relations : [fallback];
}

function inferKeywordRelation(text, keywordName) {
  const t = norm(text);
  const k = norm(keywordName);

  if (k === 'exhaust') return null;

  if (k === 'sly' && /\b(?:add|gain|gains)\b[^.\n]{0,36}\bsly\b/.test(t)) return 'grants';
  if (k === 'retain' && /\b(?:gain|gains|retain)\b[^.\n]{0,36}\bretain\b|\bretain\b[^.\n]{0,24}\bcard/.test(t)) return 'grants';

  const relation = inferRelation(text, keywordName);
  // Keywords are granted to cards; adding Ethereal does not create an entity.
  if (relation === 'creates') return 'grants';
  return relation === 'references' ? 'uses keyword' : relation;
}

function addPileRelations(source, text, pushEdge) {
  if (/\bdraw\s+pile\b/i.test(text)) {
    if (/(?:no cards|empty)[^.\n]{0,28}\bdraw\s+pile\b|\bdraw\s+pile\b[^.\n]{0,28}(?:empty|no cards)/i.test(text)) {
      pushEdge(source.id, nodeId('mechanic','DRAW_PILE'), 'requires empty', 'derived');
    }
  }

  if (/\bfrom\s+(?:your\s+)?discard\s+pile\b[^.\n]{0,52}\b(?:hand|draw\s+pile)\b/i.test(text) ||
      /\bput\b[^.\n]{0,46}\bdiscard\s+pile\b[^.\n]{0,46}\b(?:hand|draw\s+pile)\b/i.test(text)) {
    pushEdge(source.id, nodeId('mechanic','DISCARD_PILE'), 'moves from', 'derived');
  }
  if (/\bdiscard\s+pile\b[^.\n]{0,60}\bdraw\s+pile\b/i.test(text)) {
    pushEdge(source.id, nodeId('mechanic','DRAW_PILE'), 'moves to', 'derived');
  }
  if (/\bfrom\s+(?:your\s+)?draw\s+pile\b[^.\n]{0,52}\bhand\b/i.test(text) ||
      /\bput\b[^.\n]{0,46}\bdraw\s+pile\b[^.\n]{0,46}\bhand\b/i.test(text)) {
    pushEdge(source.id, nodeId('mechanic','DRAW_PILE'), 'moves from', 'derived');
  }
  if (/\bfrom\s+(?:your\s+)?hand\b[^.\n]{0,52}\b(?:top of )?(?:your\s+)?draw\s+pile\b/i.test(text) ||
      /\bput\b[^.\n]{0,38}\bhand\b[^.\n]{0,46}\bdraw\s+pile\b/i.test(text)) {
    pushEdge(source.id, nodeId('mechanic','DRAW_PILE'), 'moves to', 'derived');
  }
  if (/\bplay\b[^.\n]{0,46}\bfrom\s+(?:your\s+)?draw\s+pile\b|\bplay\s+the\s+top\b[^.\n]{0,34}\bdraw\s+pile\b/i.test(text)) {
    pushEdge(source.id, nodeId('mechanic','DRAW_PILE'), 'plays from', 'derived');
  }

  if (/\bexhaust\s+pile\b/i.test(text)) {
    let relation = null;
    if (/\bplay\b[^.\n]{0,42}\bexhaust\s+pile\b/i.test(text)) relation = 'plays from';
    else if (/\bfor each\b[^.\n]{0,52}\bexhaust\s+pile\b/i.test(text)) relation = 'scales with pile size';
    else if (/\bif\b[^.\n]{0,52}\bexhaust\s+pile\b/i.test(text)) relation = 'requires pile state';
    if (relation) pushEdge(source.id, nodeId('mechanic','EXHAUST_PILE'), relation, 'derived');
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

function addCardTypeRelations(source, text, pushEdge) {
  const t = norm(text);
  const attack = nodeId('mechanic','CARD_TYPE_ATTACK');
  const skill = nodeId('mechanic','CARD_TYPE_SKILL');
  const power = nodeId('mechanic','CARD_TYPE_POWER');

  if (/\bwhenever\b[^.\n]{0,42}\bplay\s+an?\s+attack\b/.test(t)) {
    pushEdge(source.id, attack, 'triggers on Attack play', 'derived');
  }
  if (/\bfirst\b[^.\n]{0,34}\battack\b[^.\n]{0,30}\bplay/.test(t)) {
    pushEdge(source.id, attack, 'triggers on Attack play', 'derived');
  }
  if (/\bnext\s+attack\b[^.\n]{0,44}\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) {
    pushEdge(source.id, attack, 'repeats next Attack', 'derived');
  }
  if (/\bnext\s+attack\b[^.\n]{0,44}\bcosts?\s+0\b/.test(t)) {
    pushEdge(source.id, attack, 'modifies next Attack cost', 'derived');
  }
  if (/\bfor each\s+attack\b[^.\n]{0,30}\bin your hand\b/.test(t)) {
    pushEdge(source.id, attack, 'scales with Attacks in hand', 'derived');
  }
  if (/\bfor each\s+attack\b[^.\n]{0,30}\bplayed\b/.test(t) || /\bfor each\s+attack\s+played\b/.test(t)) {
    pushEdge(source.id, attack, 'scales with Attacks played', 'derived');
  }
  if (/\bcosts?\s+\d+\s+less\b[^.\n]{0,34}\bfor each attack played\b/.test(t)) {
    pushEdge(source.id, attack, 'scales cost with Attacks played', 'derived');
  }
  if (/\brandom\s+attack\b[^.\n]{0,42}\bdiscard pile\b[^.\n]{0,42}\bhand\b/.test(t)) {
    pushEdge(source.id, attack, 'moves Attack from Discard to Hand', 'derived');
  }
  if (/\badd\b[^.\n]{0,28}\brandom\s+attack\b[^.\n]{0,34}\bhand\b/.test(t)) {
    pushEdge(source.id, attack, 'creates', 'derived');
  }
  if (/\btransform\s+all\s+attacks\b/.test(t)) {
    pushEdge(source.id, attack, 'transforms Attacks', 'derived');
  }
  if (/\bdraw\s+cards\s+until\s+you\s+draw\s+a\s+non-attack\b/.test(t)) {
    pushEdge(source.id, attack, 'draw condition', 'derived');
  }
  if (/\brandom\s+attack\b[^.\n]{0,28}\bis played\b/.test(t)) {
    pushEdge(source.id, attack, 'plays Attack', 'derived');
  }

  if (/\bskills?\s+cost\s+0\b/.test(t)) {
    pushEdge(source.id, skill, 'modifies Skill cost', 'derived');
  }
  if (/\bwhenever\b[^.\n]{0,38}\bplay\s+a\s+skill\b[^.\n]{0,38}\bexhaust\b/.test(t)) {
    pushEdge(source.id, skill, 'exhausts Skills on play', 'derived');
  }
  if (/\bnext\s+skill\b[^.\n]{0,42}\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) {
    pushEdge(source.id, skill, 'repeats next Skill', 'derived');
  }
  if (/\bwhen\b[^.\n]{0,36}\bplay\s+a\s+skill\b/.test(t)) {
    pushEdge(source.id, skill, 'triggers on Skill play', 'derived');
  }
  if (/\badd\s+sly\s+to\s+a\s+skill\b/.test(t)) {
    pushEdge(source.id, skill, 'modifies Skill', 'derived');
  }
  if (/\bfor each\s+skill\s+played\b/.test(t)) {
    pushEdge(source.id, skill, 'scales with Skills played', 'derived');
  }
  if (/\bdraw\s+a\s+skill\b/.test(t)) {
    pushEdge(source.id, skill, 'requires drawn Skill', 'derived');
  }

  if (/\bwhenever\b[^.\n]{0,38}\bplay\s+a\s+power\b/.test(t)) {
    pushEdge(source.id, power, 'triggers on Power play', 'derived');
  }
  if (/\bnext\s+power\b[^.\n]{0,42}\bplayed\s+an\s+(?:extra|additional)\s+time\b/.test(t)) {
    pushEdge(source.id, power, 'repeats next Power', 'derived');
  }

  const status = nodeId('mechanic','CARD_TYPE_STATUS');
  const colorless = nodeId('mechanic','CARD_TYPE_COLORLESS');

  if (/\b(?:whenever|when|each time)\b[^.\n]{0,48}\bcreate(?:s|d|ing)?\s+(?:a\s+)?status\b/.test(t)) pushEdge(source.id, status, 'triggers on Status creation', 'derived');
  else if (/\b(?:create|creates|created)\s+(?:a\s+)?status\b/.test(t)) pushEdge(source.id, status, 'creates Status', 'derived');
  if (/\bexhaust\s+(?:all\s+)?(?:your\s+)?status\s+cards?\b/.test(t)) pushEdge(source.id, status, 'exhausts Status cards', 'derived');
  if (/\bdraw\s+(?:a\s+)?status\b/.test(t)) pushEdge(source.id, status, 'triggers on Status draw', 'derived');
  if (/\btransform\s+(?:all\s+)?status\s+cards?\b/.test(t)) pushEdge(source.id, status, 'transforms Status cards', 'derived');

  if (/\badd\b[^.\n]{0,34}\bcolorless\s+card/.test(t)) pushEdge(source.id, colorless, 'creates Colorless card', 'derived');
  if (/\bcopy\b[^.\n]{0,34}\bcolorless\s+card/.test(t)) pushEdge(source.id, colorless, 'copies Colorless card', 'derived');

  // Creation can coordinate several card types in one object list. Keep the
  // list intact here; a comma inside it does not introduce a trigger reward.
  for (const match of t.matchAll(/\badd\s+([^.;\n]{1,120}?)\s+(?:into|to)\s+(?:your\s+)?hand\b/g)) {
    const objects = match[1];
    const residue = objects.replace(/\b(?:a|an|\d+|x|random|upgraded|ethereal|cards?|attacks?|skills?|powers?|status|colorless|and|or)\b/g, '').replace(/[\s,]/g, '');
    if (residue) continue;
    for (const type of ['attack', 'skill', 'power', 'status', 'colorless']) {
      if (new RegExp('\\b' + type + '(?:s)?\\b').test(objects)) {
        pushEdge(source.id, 'mechanic:CARD_TYPE_' + type.toUpperCase(), type === 'colorless' ? 'creates Colorless card' : 'creates', 'derived');
      }
    }
  }
}

function addTagSemanticRelations(source, text, pushEdge) {
  const t = norm(text);

  if (/\bcontaining\s+[“"]?strike[”"]?\b/.test(t) || /\bcards?\b[^.\n]{0,24}\bstrike\b/.test(t)) {
    const strike = nodeId('tag','STRIKE');

    if (/\bfor\s+(?:all|each)\b[^.\n]{0,42}\bstrike\b/.test(t)) {
      pushEdge(source.id, strike, 'scales with Strike cards', 'derived');
    } else if (/\bdraw\b[^.\n]{0,42}\bstrike\b/.test(t)) {
      pushEdge(source.id, strike, 'triggers on drawing Strike', 'derived');
    }
  }

  if (/\bcards?\s+containing\s+[“"]?minion[”"]?\b/.test(t)) {
    pushEdge(source.id, nodeId('tag','MINION'), 'modifies Minion cards', 'derived');
  }
}

function addCharacterMechanicRelations(source, text, pushEdge) {
  const t = norm(text);
  const orbSystem = nodeId('mechanic','ORB_SYSTEM');
  const orbSlots = nodeId('mechanic','ORB_SLOTS');
  const osty = nodeId('mechanic','OSTY');
  const summon = nodeId('mechanic','SUMMON');
  const forge = nodeId('mechanic','FORGE');
  const replay = nodeId('mechanic','REPLAY');
  const fatal = nodeId('mechanic','FATAL');
  const stars = nodeId('mechanic','STAR_COUNT');

  const orbNames = [
    ['LIGHTNING','lightning'],
    ['FROST','frost'],
    ['DARK','dark'],
    ['PLASMA','plasma'],
    ['GLASS','glass']
  ];

  for (const [id, name] of orbNames) {
    for (const clause of mechanicClauses(t)) {
      if (new RegExp('\\bchannel(?:s|ed|ing)?\\b[^.\\n]{0,30}\\b' + name + '\\b').test(clause)) {
        const relation = inferEffectRelation('CHANNEL', clause, 'channels');
        if (relation) pushEdge(source.id, nodeId('mechanic',id), relation === 'triggers on channel' ? 'triggers on Channel' : relation, 'derived');
      }
      if (new RegExp('\\bevok(?:e[sd]?|ing)\\b[^.\\n]{0,30}\\b' + name + '\\b').test(clause)) {
        const relation = inferEffectRelation('EVOKE', clause, 'evokes');
        pushEdge(source.id, nodeId('mechanic',id), relation === 'triggers on evoke' ? 'triggers on Evoke' : relation, 'derived');
      }
    }
    if (new RegExp('\\btrigger\\b[^.\\n]{0,40}\\bpassive\\b[^.\\n]{0,34}\\b' + name + '\\b').test(t)) {
      pushEdge(source.id, nodeId('mechanic',id), 'triggers passive', 'derived');
    }
  }

  if (/\bchannel(?:s|ing)?\b[^.\n]{0,34}\borbs?\b(?!\s+slots?)/.test(t)) {
    const relation = /\bfor each\b[^.\n]{0,42}\b(?:channeled\s+)?orb\b/.test(t) ? 'scales with Channeled Orbs' : 'channels';
    pushEdge(source.id, orbSystem, relation, 'derived');
  }
  if (/\bevoke(?:s|d|ing)?\b[^.\n]{0,34}\borbs?\b/.test(t)) pushEdge(source.id, orbSystem, 'evokes', 'derived');
  if (/\btrigger\b[^.\n]{0,42}\bpassive\b[^.\n]{0,38}\borbs?\b/.test(t)) pushEdge(source.id, orbSystem, 'triggers passive', 'derived');
  if (/\bfor each unique orb\b/.test(t)) pushEdge(source.id, orbSystem, 'scales with unique Orbs', 'derived');

  if (/\bgain\s+\d+\s+(?:additional\s+)?orb slots?\b/.test(t)) pushEdge(source.id, orbSlots, 'grants', 'derived');
  if (/\blose\s+\d+\s+orb slots?\b/.test(t)) pushEdge(source.id, orbSlots, 'reduces', 'derived');
  if (/\badditional\s+orb slots?\b/.test(t) && !/\bgain\b/.test(t)) pushEdge(source.id, orbSlots, 'grants', 'derived');
  if (/\bfor each\b[^.\n]{0,40}\borb slots?\b/.test(t)) pushEdge(source.id, orbSlots, 'scales with Orb Slots', 'derived');

  if (/\bsummon\s+(?:\d+|x)\b/.test(t)) pushEdge(source.id, summon, 'summons / strengthens Osty', 'derived');
  if (/\bosty\b/.test(t)) {
    let relation = 'interacts with';
    if (/\bosty\s+(?:deal|deals|attack|attacks)\b/.test(t)) relation = 'commands attack';
    if (/\bosty\b[^.\n]{0,30}\bheal(?:s|ed|ing)?\b/.test(t)) relation = 'heals';
    if (/\bosty\b[^.\n]{0,30}\bdies?\b/.test(t)) relation = 'sacrifices';
    if (/\bif\s+osty\s+is\s+alive\b/.test(t)) relation = 'requires alive';
    if (/\bosty(?:'s)?\s+current\s+hp\b/.test(t)) relation = 'scales with HP';
    if (/\bosty(?:'s)?\s+attacks?\b[^.\n]{0,34}\badditional\s+damage\b/.test(t)) relation = 'modifies damage';
    if (/\bosty\s+absorbs?\b/.test(t)) relation = 'absorbs damage';
    if (/\b(?:whenever|when|each time)\b[^.\n]{0,24}\bosty\s+loses?\s+hp\b/.test(t)) relation = 'triggers on HP loss';
    if (relation !== 'interacts with') pushEdge(source.id, osty, relation, 'derived');
  }

  if (/\bforge\b/.test(t)) {
    const relation = /\bwhenever\b[^.\n]{0,30}\bforge\b/.test(t) ? 'triggers on Forge' : 'forges';
    pushEdge(source.id, forge, relation, 'derived');
  }
  if (/\breplay\b/.test(t)) pushEdge(source.id, replay, 'grants Replay', 'derived');
  if (/\bfatal\b|\bif this kills?\b/.test(t)) pushEdge(source.id, fatal, 'triggers on kill', 'derived');

  if (/\[s\]/.test(t)) {
    let relation = 'uses Stars';
    if (/\bwhenever\s+you\s+(?:spend|gain)\b[^.\n]{0,22}\[s\]/.test(t) || /\bfirst time\s+you\s+spend\b[^.\n]{0,22}\[s\]/.test(t)) relation = 'triggers on Stars';
    else if (/\bfor (?:each|every)\b[^.\n]{0,42}\[s\]/.test(t) || /\[s\]\s+cost/.test(t) || /\beach\s+\[s\]\s+spent\b/.test(t)) relation = 'scales with Stars';
    else if (/\bspend\b[^.\n]{0,24}\[s\]/.test(t)) relation = 'spends Stars';
    else if (/\bgain\b[^.\n]{0,30}\[s\]/.test(t)) relation = 'gains Stars';
    if (relation !== 'uses Stars') pushEdge(source.id, stars, relation, 'derived');
  }
}

function buildEdges(nodes, manualLinks = [], cardPowers = {}) {
  const edges = [];
  const edgeIds = new Set();
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
    .flatMap(group => {
      if (group.length === 1) return group;
      // A metadata tag must not hide an unambiguous card with the same name
      // (Shiv). Multiple cards or powers still require explicit disambiguation.
      const cards = group.filter(node => node.type === 'card');
      return cards.length === 1 && group.every(node => ['card', 'tag'].includes(node.type)) ? cards : [];
    });

  const keywords = nodes.filter(n => n.type === 'keyword');
  const effects = new Map(EFFECT_DEFS.map(effect => [effect.id, effect]));

  const pushEdge = (source, target, relation, provenance, note) => {
    if (!byId.has(source) || !byId.has(target) || source === target) return;
    const id = source + '|' + target + '|' + relation;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({
      id,
      source,
      target,
      relation,
      provenance: provenance || 'description',
      note: note || ''
    });
  };

  for (const card of cards) {
    for (const kw of card.keywords || []) {
      const target = nodeId('keyword', slug(kw));
      if (byId.has(target)) pushEdge(card.id, target, 'has keyword', 'explicit');

      if (slug(kw) === 'SLY') {
        pushEdge(card.id, nodeId('effect', 'DISCARD'), 'benefits from discard', 'explicit');
      }

      if (slug(kw) === 'EXHAUST') {
        pushEdge(card.id, nodeId('effect', 'EXHAUST_CARD'), 'self-exhausts', 'explicit');
      }
    }

    for (const tag of card.tags || []) {
      const target = nodeId('tag', slug(tag));
      if (byId.has(target)) pushEdge(card.id, target, 'has tag', 'explicit');
    }

    for (const power of (cardPowers && cardPowers[card.sourceId]) || []) {
      const target = nodeId('power', power.id);
      const powerNode = byId.get(target);
      if (powerNode) {
        for (const relation of inferPowerRelations(card, powerNode)) {
          pushEdge(card.id, target, relation, 'explicit');
        }
      }
    }
  }

  for (const source of nodes) {
    const text = source.description || '';
    if (!text) continue;

    const mentions = candidates.flatMap(target =>
      findEntityMentions(text, target.name).map(mention => ({ target, mention }))
    );
    for (const { target, mention } of mentions) {
      if (target.id === source.id) continue;
      // A named entity owns its full span. "Minion Sacrifice" must not also
      // create a relationship to the unrelated Necrobinder card "Sacrifice".
      const shadowed = mentions.some(other =>
        other.mention.alias.length > mention.alias.length &&
        other.mention.index <= mention.index &&
        other.mention.index + other.mention.alias.length >= mention.index + mention.alias.length
      );
      if (shadowed) continue;
      const relation = inferRelationAt(text, mention);
      if (relation !== 'references') pushEdge(source.id, target.id, relation, 'derived');
    }

    for (const keyword of keywords) {
      if (containsEntityName(text, keyword.name)) {
        const relation = inferKeywordRelation(text, keyword.name);
        if (relation && relation !== 'uses keyword') {
          pushEdge(source.id, keyword.id, relation, 'derived');
        }
      }
    }

    addPileRelations(source, text, pushEdge);
    addCardTypeRelations(source, text, pushEdge);
    addTagSemanticRelations(source, text, pushEdge);
    addCharacterMechanicRelations(source, text, pushEdge);

    for (const effectId of effects.keys()) {
      for (const relation of inferEffectRelations(effectId, text)) {
        // Plain damage/play edges turn the graph into high-degree hubs without
        // adding interaction meaning. Keep modifiers, triggers, requirements, etc.
        if (effectId === 'DAMAGE' && relation === 'deals damage') continue;
        if (effectId === 'PLAY_CARD' && relation === 'plays cards') continue;

        // Prefer concrete creation over a second generic Create Card edge.
        // A trigger on creation remains meaningful alongside a created reward.
        if (effectId === 'CREATE_CARD' && relation === 'creates') {
          const hasConcreteCreate = edges.some(edge =>
            edge.source === source.id &&
            edge.relation === 'creates' &&
            byId.get(edge.target)?.type !== 'effect'
          );
          if (hasConcreteCreate) continue;
        }

        pushEdge(source.id, nodeId('effect', effectId), relation, 'derived');
      }
    }

    addResourceRelations(source, text, pushEdge);
  }

  for (const [source, target, relation] of ONTOLOGY_EDGES) {
    pushEdge(source, target, relation, 'explicit');
  }

  for (const card of cards) {
    for (const power of powers) {
      const base = power.name.replace(/\s+Power$/i, '');
      if (norm(card.name) === norm(base)) {
        const mapped = (cardPowers[card.sourceId] || []).some(item => nodeId('power', item.id) === power.id);
        if (!mapped) pushEdge(card.id, power.id, power.rarity === 'Debuff' ? 'applies' : 'grants', 'name-match');
      }
    }
  }

  for (const [source, target, relations] of SEMANTIC_OVERRIDES) {
    if (!byId.has(source) || !byId.has(target)) continue;

    for (let i = edges.length - 1; i >= 0; i -= 1) {
      const edge = edges[i];
      if (edge.source === source && edge.target === target) {
        edgeIds.delete(edge.id);
        edges.splice(i, 1);
      }
    }

    for (const relation of relations) pushEdge(source, target, relation, 'curated');
  }

  // Description-role overrides do not negate independent printed costs.
  for (const card of cards) {
    if (Number.isInteger(card.starCost) && card.starCost > 0) {
      pushEdge(card.id, nodeId('mechanic', 'STAR_COUNT'), 'requires Stars', 'explicit', 'Printed cost: ' + card.starCost + ' Stars');
    }
  }

  for (const link of manualLinks || []) {
    pushEdge(link.source, link.target, link.relation || 'related', 'curated', link.note || '');
  }

  return edges;
}

function relationFamily(relation) {
  const r = norm(relation);

  // Semantic role takes precedence over the vocabulary in its object:
  // "triggers on card creation" is a trigger, not card creation.
  if (/trigger|benefit/.test(r)) return 'trigger';
  if (/scale|equal to/.test(r)) return 'scaling';
  if (/require|restrict|condition/.test(r)) return 'requirement';
  if (/prevent|limit/.test(r)) return 'modification';
  if (/^has (?:keyword|tag)$/.test(r)) return 'property';
  if (/creat|cop(?:y|ies)|transform/.test(r)) return 'creation';
  if (/appl|grant|restore|heal|gains? stars|increases? max hp/.test(r)) return 'application';
  if (/move|play from|plays from|moves to|moves from|return|shuffl/.test(r) || /^plays?\b/.test(r)) return 'movement';
  if (/modif|reduce|remove|retain|double|repeat|forg|increase|upgrad|absorb|target scope|sets capacity/.test(r)) return 'modification';
  if (/draw|discard|exhaust|channel|evoke|summon|spend|consume|commands attack|loses? hp|takes? damage|sacrific|kills? at|self-exhaust/.test(r)) return 'resource';
  return 'other';
}

function safeFileName(name) {
  return String(name || 'Untitled')
    .replace(/[\\/:*?"<>|#^\[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function createNodePaths(nodes) {
  const bases = nodes.map(node => TYPE_FOLDERS[node.type] + '/' + safeFileName(node.name));
  const counts = new Map();
  for (const base of bases) counts.set(base, (counts.get(base) || 0) + 1);
  return new Map(nodes.map((node, index) => {
    const base = bases[index];
    const suffix = counts.get(base) > 1 ? ' [' + safeFileName(node.sourceId) + ']' : '';
    return [node.id, base + suffix + '.md'];
  }));
}

const ONTOLOGY_EDGES = [
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

const SEMANTIC_OVERRIDES = [
  ...SILENT_SEMANTIC_OVERRIDES,
  ...IRONCLAD_SEMANTIC_OVERRIDES,
  ...DEFECT_SEMANTIC_OVERRIDES,
  ...NECROBINDER_SEMANTIC_OVERRIDES,
  ...REGENT_SEMANTIC_OVERRIDES
];

export { SOURCES, SOURCE_META_URL, TYPE_FOLDERS, RELATION_FAMILIES, EFFECT_DEFS, ONTOLOGY_EDGES, SEMANTIC_OVERRIDES, normalizeData, buildEdges, relationFamily, inferRelations, inferEffectRelations, isMechanicalRelation, createNodePaths };
