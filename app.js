(() => {
  const SOURCES = {
    card: '/data/sts2/cards.json',
    relic: '/data/sts2/relics.json',
    power: '/data/sts2/powers.json',
    potion: '/data/sts2/potions.json',
    enchantment: '/data/sts2/enchantments.json',
    keyword: '/data/sts2/keywords.json',
    mechanics: '/data/sts2/mechanics.json',
    cardPowers: '/data/sts2/card_powers.json'
  };

  const SOURCE_META_URL = '/data/sts2/meta.json';

  const RELATION_FAMILY_LABELS = {
    creation: 'Create / transform',
    application: 'Apply / grant',
    trigger: 'Triggers / payoffs',
    scaling: 'Scaling',
    requirement: 'Requirements',
    movement: 'Move / play',
    modification: 'Modify / retain',
    resource: 'Resources / actions',
    other: 'Other'
  };

  const RELATION_FAMILY_COLORS = {
    creation: 0x72b6d9,
    application: 0x70b58a,
    trigger: 0xd5a85f,
    scaling: 0xb985d6,
    requirement: 0xd27b72,
    movement: 0x7f9fd1,
    modification: 0xc58aa8,
    resource: 0x8da56e,
    other: 0x6f747c
  };

  const RELATION_FAMILY_CSS = {
    creation: '#72b6d9',
    application: '#70b58a',
    trigger: '#d5a85f',
    scaling: '#b985d6',
    requirement: '#d27b72',
    movement: '#7f9fd1',
    modification: '#c58aa8',
    resource: '#8da56e',
    other: '#6f747c'
  };

  const TYPE_COLORS = {
    card: 0x8b83d6,
    relic: 0xc19a63,
    power: 0xa276bd,
    potion: 0x65a7a1,
    enchantment: 0xc9829f,
    keyword: 0x7f9a72,
    mechanic: 0x6f8fb5,
    tag: 0x9a875f,
    effect: 0x7f8794
  };

  const TYPE_CSS = {
    card: '#8b83d6',
    relic: '#c19a63',
    power: '#a276bd',
    potion: '#65a7a1',
    enchantment: '#c9829f',
    keyword: '#7f9a72',
    mechanic: '#6f8fb5',
    tag: '#9a875f',
    effect: '#7f8794'
  };

  const TYPE_LABELS = {
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

  const state = {
    nodes: [],
    edges: [],
    byId: new Map(),
    outAdj: new Map(),
    inAdj: new Map(),

    pixi: null,
    world: null,
    edgeLayer: null,
    nodeLayer: null,
    labelLayer: null,
    overlayLayer: null,
    hoverLabel: null,
    focusLabel: null,
    nodeViews: new Map(),
    staticLabels: new Map(),

    visibleNodes: [],
    visibleEdges: [],
    simEdges: [],
    simulation: null,

    focusedId: null,
    hoveredId: null,
    viewMode: 'global',
    depth: 1,
    visibleTypes: new Set(Object.keys(TYPE_LABELS)),
    visibleProvenance: new Set(),
    visibleRelationFamilies: new Set(),
    datasetMeta: {},

    paletteIndex: 0,
    paletteMatches: [],

    draggingNode: null,
    panning: false,
    panStart: null,
    worldStart: null,
    panMoved: false,

    touchPointers: new Map(),
    pinchStart: null,

    settings: {
      center: 0.012,
      repel: 170,
      link: 0.28,
      distance: 92
    }
  };

  const $ = id => document.getElementById(id);
  const norm = s => String(s == null ? '' : s).toLowerCase().trim();
  const slug = s => String(s == null ? '' : s).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
  const nodeId = (type, id) => type + ':' + id;
  const htmlEsc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  async function loadJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load ' + url);
    return res.json();
  }

  async function loadOptionalJson(url, fallback) {
    try {
      return await loadJson(url);
    } catch (_) {
      return fallback;
    }
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
    const name = powerNode.name || '';
    const relations = inferRelations(text, name);

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
      if (new RegExp('\\bchannel(?:s|ed|ing)?\\b[^.\\n]{0,30}\\b' + name + '\\b').test(t)) {
        pushEdge(source.id, nodeId('mechanic',id), 'channels', 'derived');
      }
      if (new RegExp('\\bevoke(?:s|d|ing)?\\b[^.\\n]{0,30}\\b' + name + '\\b').test(t)) {
        pushEdge(source.id, nodeId('mechanic',id), 'evokes', 'derived');
      }
      if (new RegExp('\\btrigger\\b[^.\\n]{0,40}\\bpassive\\b[^.\\n]{0,34}\\b' + name + '\\b').test(t)) {
        pushEdge(source.id, nodeId('mechanic',id), 'triggers passive', 'derived');
      }
    }

    if (/\bchannel(?:s|ed|ing)?\b[^.\n]{0,34}\borbs?\b|\bchanneled\s+orb\b/.test(t)) {
      const relation = /\bfor each\b[^.\n]{0,42}\b(?:channeled\s+)?orb\b/.test(t) ? 'scales with Channeled Orbs' : 'channels';
      pushEdge(source.id, orbSystem, relation, 'derived');
    }
    if (/\bevoke(?:s|d|ing)?\b[^.\n]{0,34}\borbs?\b/.test(t)) pushEdge(source.id, orbSystem, 'evokes', 'derived');
    if (/\btrigger\b[^.\n]{0,42}\bpassive\b[^.\n]{0,38}\borbs?\b/.test(t)) pushEdge(source.id, orbSystem, 'triggers passive', 'derived');
    if (/\bfor each unique orb\b/.test(t)) pushEdge(source.id, orbSystem, 'scales with unique Orbs', 'derived');

    if (/\bgain\s+\d+\s+(?:additional\s+)?orb slots?\b/.test(t)) pushEdge(source.id, orbSlots, 'grants', 'derived');
    if (/\blose\s+\d+\s+orb slots?\b/.test(t)) pushEdge(source.id, orbSlots, 'reduces', 'derived');
    if (/\badditional\s+orb slots?\b/.test(t) && !/\bgain\b/.test(t)) pushEdge(source.id, orbSlots, 'grants', 'derived');

    if (/\bsummon\b/.test(t)) pushEdge(source.id, summon, 'summons / strengthens Osty', 'derived');
    if (/\bosty\b/.test(t)) {
      let relation = 'interacts with';
      if (/\bosty\b[^.\n]{0,30}\b(?:deal|deals|attack|attacks)\b/.test(t)) relation = 'commands attack';
      if (/\bosty\b[^.\n]{0,30}\bheal(?:s|ed|ing)?\b/.test(t)) relation = 'heals';
      if (/\bosty\b[^.\n]{0,30}\bdies?\b/.test(t)) relation = 'sacrifices';
      if (/\bif\s+osty\s+is\s+alive\b/.test(t)) relation = 'requires alive';
      if (/\bosty(?:'s)?\s+current\s+hp\b/.test(t)) relation = 'scales with HP';
      if (/\bosty(?:'s)?\s+attacks?\b[^.\n]{0,34}\badditional\s+damage\b/.test(t)) relation = 'modifies damage';
      pushEdge(source.id, osty, relation, 'derived');
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
      pushEdge(source.id, stars, relation, 'derived');
    }
  }

  function buildEdges(nodes, manualLinks, cardPowers) {
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
      .filter(group => group.length === 1)
      .map(group => group[0]);

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
          pushEdge(card.id, target, inferPowerRelation(card, powerNode), 'explicit');
        }
      }
    }

    for (const source of nodes) {
      const text = source.description || '';
      if (!text) continue;

      for (const target of candidates) {
        if (target.id === source.id) continue;
        if (containsEntityName(text, target.name)) {
          for (const relation of inferRelations(text, target.name)) {
            if (relation === 'references') continue;
            pushEdge(source.id, target.id, relation, 'derived');
          }
        }
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

      for (const [effectId, effect] of effects) {
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

        pushEdge(source.id, nodeId('effect', effectId), relation, 'derived');
      }

      const block = byId.get(nodeId('mechanic','BLOCK'));
      const energy = byId.get(nodeId('mechanic','ENERGY'));
      const hp = byId.get(nodeId('mechanic','HIT_POINTS'));

      if (block && /\bgain(?:s)?\b[^.\n]*\bBlock\b/i.test(text)) pushEdge(source.id, block.id, 'grants', 'derived');
      if (block && /\bremove\b[^.\n]{0,42}\bBlock\b/i.test(text)) pushEdge(source.id, block.id, 'removes', 'derived');
      if (block && /\bBlock\s+gain\b/i.test(text)) pushEdge(source.id, block.id, 'modifies', 'derived');
      if (block && /\bBlock\s+is\s+not\s+removed\b/i.test(text)) pushEdge(source.id, block.id, 'retains', 'derived');
      if (energy && /\bgain(?:s)?\b[^.\n]*(?:\[E\]|Energy)/i.test(text)) pushEdge(source.id, energy.id, 'grants', 'derived');
      if (energy && /\blose(?:s)?\b[^.\n]*(?:\[E\]|Energy)/i.test(text)) pushEdge(source.id, energy.id, 'consumes', 'derived');
      if (hp && /\bheal(?:s|ed|ing)?\b/i.test(text)) pushEdge(source.id, hp.id, 'restores', 'derived');
      if (hp && /\blose(?:s)?\b[^.\n]*\bHP\b/i.test(text)) pushEdge(source.id, hp.id, 'reduces', 'derived');
      if (hp && /\b(?:raise|increase)\b[^.\n]{0,42}\bMax HP\b/i.test(text)) pushEdge(source.id, hp.id, 'increases Max HP', 'derived');
      if (hp && /\bHP\b[^.\n]{0,24}\b(?:at or below|below|less than|under)\b[^.\n]{0,18}\b\d+%/i.test(text)) pushEdge(source.id, hp.id, 'requires low HP', 'derived');
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
      pushEdge(source, target, relation, 'explicit');
    }

    for (const card of cards) {
      for (const power of powers) {
        const base = power.name.replace(/\s+Power$/i, '');
        if (norm(card.name) === norm(base)) {
          pushEdge(card.id, power.id, 'grants', 'name-match');
        }
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
          edgeIds.delete(edge.id);
          edges.splice(i, 1);
        }
      }

      for (const relation of relations) pushEdge(source, target, relation, 'curated');
    }

    for (const link of manualLinks || []) {
      pushEdge(link.source, link.target, link.relation || 'related', 'curated', link.note || '');
    }

    return edges;
  }

  function buildAdjacency() {
    state.byId = new Map(state.nodes.map(n => [n.id, n]));
    state.outAdj = new Map();
    state.inAdj = new Map();

    for (const node of state.nodes) {
      state.outAdj.set(node.id, []);
      state.inAdj.set(node.id, []);
    }

    for (const edge of state.edges) {
      if (state.outAdj.has(edge.source)) state.outAdj.get(edge.source).push(edge);
      if (state.inAdj.has(edge.target)) state.inAdj.get(edge.target).push(edge);
    }

    for (const node of state.nodes) {
      node.degree = (state.outAdj.get(node.id) || []).length + (state.inAdj.get(node.id) || []).length;
      node.radius = 4.8 + Math.min(8.5, Math.sqrt(node.degree + 1) * 1.25);
      if (!Number.isFinite(node.x)) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 260;
        node.x = Math.cos(angle) * distance;
        node.y = Math.sin(angle) * distance;
      }
    }
  }

  function initPixi() {
    const host = $('graph-canvas');

    state.pixi = new PIXI.Application({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    host.appendChild(state.pixi.view);

    state.pixi.stage.eventMode = 'static';
    state.pixi.stage.hitArea = state.pixi.screen;

    state.world = new PIXI.Container();
    state.edgeLayer = new PIXI.Graphics();
    state.nodeLayer = new PIXI.Container();
    state.labelLayer = new PIXI.Container();
    state.overlayLayer = new PIXI.Container();

    state.world.addChild(state.edgeLayer, state.nodeLayer, state.labelLayer, state.overlayLayer);
    state.pixi.stage.addChild(state.world);

    centerWorld();

    state.hoverLabel = makeOverlayLabel();
    state.focusLabel = makeOverlayLabel();
    state.overlayLayer.addChild(state.hoverLabel, state.focusLabel);
    state.hoverLabel.visible = false;
    state.focusLabel.visible = false;

    state.pixi.stage.on('pointerdown', onStagePointerDown);
    state.pixi.stage.on('pointermove', onStagePointerMove);
    state.pixi.stage.on('pointerup', onStagePointerUp);
    state.pixi.stage.on('pointerupoutside', onStagePointerUp);

    state.pixi.view.addEventListener('wheel', onWheel, { passive: false });
    state.pixi.view.addEventListener('touchstart', onTouchStart, { passive: false });
    state.pixi.view.addEventListener('touchmove', onTouchMove, { passive: false });
    state.pixi.view.addEventListener('touchend', onTouchEnd, { passive: false });
    state.pixi.view.addEventListener('touchcancel', onTouchEnd, { passive: false });

    new ResizeObserver(() => {
      state.pixi.stage.hitArea = state.pixi.screen;
    }).observe(host);

    state.pixi.ticker.add(renderFrame);
  }

  function makeOverlayLabel() {
    const label = new PIXI.Text('', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      fill: 0xe0e0e0,
      stroke: 0x1e1e1e,
      strokeThickness: 4,
      align: 'center'
    });
    label.anchor.set(0.5, 0);
    label.eventMode = 'none';
    return label;
  }

  function centerWorld() {
    if (!state.pixi || !state.world) return;
    state.world.scale.set(1);
    state.world.position.set(state.pixi.screen.width / 2, state.pixi.screen.height / 2);
  }

  function createNodeView(node) {
    const view = new PIXI.Container();
    const circle = new PIXI.Graphics();

    view.addChild(circle);
    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new PIXI.Circle(0, 0, node.radius + 8);
    view._nodeId = node.id;
    view._circle = circle;

    view.on('pointerdown', e => {
      e.stopPropagation();
      if (state.touchPointers.size >= 2) return;

      state.draggingNode = node;
      node._dragMoved = false;
      node._pointerStartX = e.global.x;
      node._pointerStartY = e.global.y;

      const p = state.world.toLocal(e.global);
      node.fx = node.x;
      node.fy = node.y;
      node._dragOffsetX = node.x - p.x;
      node._dragOffsetY = node.y - p.y;

      if (state.simulation) state.simulation.alphaTarget(0.22).restart();
    });

    view.on('pointertap', e => {
      e.stopPropagation();

      if (node._dragMoved) {
        node._dragMoved = false;
        return;
      }

      if (state.focusedId === node.id) clearFocus();
      else focusNode(node.id);
    });

    view.on('pointerover', () => {
      state.hoveredId = node.id;
      styleNodeView(node);
      state.hoverLabel.text = node.name;
      state.hoverLabel.visible = true;
    });

    view.on('pointerout', () => {
      if (state.hoveredId === node.id) state.hoveredId = null;
      styleNodeView(node);
      state.hoverLabel.visible = false;
    });

    styleNodeView(node);
    return view;
  }

  function styleNodeView(node) {
    const view = state.nodeViews.get(node.id);
    if (!view) return;

    const selected = state.focusedId === node.id;
    const hovered = state.hoveredId === node.id;
    const related = !state.focusedId || state.viewMode === 'local' || isDirectNeighbor(node.id);
    const circle = view._circle;

    circle.clear();

    if (selected) circle.lineStyle(2.3, 0xb8adff, 1);
    else if (hovered) circle.lineStyle(1.8, 0x9c8df4, 1);
    else circle.lineStyle(0.8, 0x161616, 0.95);

    circle.beginFill(TYPE_COLORS[node.type], selected || hovered ? 1 : 0.88);
    circle.drawCircle(0, 0, selected ? node.radius + 2.2 : node.radius);
    circle.endFill();

    view.alpha = related ? 1 : 0.1;
  }

  function isDirectNeighbor(id) {
    if (!state.focusedId) return true;
    if (id === state.focusedId) return true;

    return (state.outAdj.get(state.focusedId) || []).some(e => e.target === id) ||
      (state.inAdj.get(state.focusedId) || []).some(e => e.source === id);
  }

  function shouldShowStaticLabel(node) {
    if (state.viewMode === 'local') return state.visibleNodes.length <= 160 || node.degree >= 3;
    if (state.visibleNodes.length <= 170) return true;
    return node.degree >= 9;
  }

  function createStaticLabel(node) {
    const label = new PIXI.Text(node.name, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 9.5,
      fill: 0xbebebe,
      stroke: 0x1e1e1e,
      strokeThickness: 3
    });
    label.anchor.set(0.5, 0);
    label.eventMode = 'none';
    state.labelLayer.addChild(label);
    state.staticLabels.set(node.id, label);
  }

  function rebuildScene() {
    for (const child of state.nodeLayer.removeChildren()) child.destroy({ children: true });
    for (const child of state.labelLayer.removeChildren()) child.destroy();
    state.nodeViews.clear();
    state.staticLabels.clear();

    for (const node of state.visibleNodes) {
      const view = createNodeView(node);
      state.nodeViews.set(node.id, view);
      state.nodeLayer.addChild(view);

      if (shouldShowStaticLabel(node)) createStaticLabel(node);
    }

    state.focusLabel.visible = Boolean(state.focusedId && state.byId.has(state.focusedId));
    updateAllNodeStyles();
    rebuildSimulation();
    renderFrame();
  }

  function rebuildSimulation() {
    if (state.simulation) state.simulation.stop();

    state.simEdges = state.visibleEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      family: relationFamily(edge.relation),
      provenance: edge.provenance
    }));

    const linkForce = d3.forceLink(state.simEdges)
      .id(d => d.id)
      .distance(state.settings.distance)
      .strength(state.settings.link);

    state.simulation = d3.forceSimulation(state.visibleNodes)
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength(-state.settings.repel).distanceMax(650))
      .force('x', d3.forceX(0).strength(state.settings.center))
      .force('y', d3.forceY(0).strength(state.settings.center))
      .force('collide', d3.forceCollide(d => d.radius + 4).strength(0.7).iterations(1))
      .velocityDecay(0.34)
      .alphaDecay(0.024)
      .alphaMin(0.002)
      .alpha(0.9)
      .restart();

    $('physics-badge').classList.add('active');
  }

  function updatePhysics() {
    state.settings.center = Number($('center-force').value) / 1000;
    state.settings.repel = Number($('repel-force').value);
    state.settings.link = Number($('link-force').value) / 100;
    state.settings.distance = Number($('link-distance').value);

    if (!state.simulation) return;

    state.simulation.force('charge').strength(-state.settings.repel);
    state.simulation.force('x').strength(state.settings.center);
    state.simulation.force('y').strength(state.settings.center);

    const link = state.simulation.force('link');
    link.distance(state.settings.distance).strength(state.settings.link);

    state.simulation.alpha(0.72).restart();
    $('physics-badge').classList.add('active');
  }

  function restructureGraph() {
    for (const node of state.visibleNodes) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 45 + Math.random() * 260;
      node.x = Math.cos(angle) * distance;
      node.y = Math.sin(angle) * distance;
      node.vx = (Math.random() - 0.5) * 5;
      node.vy = (Math.random() - 0.5) * 5;

      if (!$('pin-dragged').checked) {
        node.fx = null;
        node.fy = null;
      }
    }

    if (state.simulation) state.simulation.alpha(1).restart();
    $('physics-badge').classList.add('active');
  }

  function renderFrame() {
    if (!state.edgeLayer || !state.world) return;

    drawEdges();

    for (const node of state.visibleNodes) {
      const view = state.nodeViews.get(node.id);
      if (view) view.position.set(node.x || 0, node.y || 0);

      const label = state.staticLabels.get(node.id);
      if (label) {
        label.position.set(node.x || 0, (node.y || 0) + node.radius + 4);
        label.alpha = !state.focusedId || state.viewMode === 'local' || isDirectNeighbor(node.id) ? 0.9 : 0.08;
        label.visible = state.world.scale.x >= 0.38 || state.viewMode === 'local';
      }
    }

    if (state.hoveredId) {
      const node = state.byId.get(state.hoveredId);
      if (node) state.hoverLabel.position.set(node.x || 0, (node.y || 0) + node.radius + 6);
    }

    if (state.focusedId) {
      const node = state.byId.get(state.focusedId);
      if (node && state.nodeViews.has(node.id)) {
        state.focusLabel.text = node.name;
        state.focusLabel.position.set(node.x || 0, (node.y || 0) + node.radius + 7);
        state.focusLabel.visible = !state.staticLabels.has(node.id);
      } else {
        state.focusLabel.visible = false;
      }
    } else {
      state.focusLabel.visible = false;
    }

    if (state.simulation) {
      const active = state.simulation.alpha() > 0.015 || Boolean(state.draggingNode);
      $('physics-badge').classList.toggle('active', active);
    }
  }

  function drawEdges() {
    state.edgeLayer.clear();

    for (const edge of state.simEdges) {
      const source = edge.source;
      const target = edge.target;
      if (!source || !target || !Number.isFinite(source.x) || !Number.isFinite(target.x)) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;

      const ux = dx / length;
      const uy = dy / length;
      const sourceRadius = source.radius || 4;
      const targetRadius = target.radius || 4;
      const startX = source.x + ux * Math.min(sourceRadius + 1, length * 0.25);
      const startY = source.y + uy * Math.min(sourceRadius + 1, length * 0.25);
      const endX = target.x - ux * Math.min(targetRadius + 2, length * 0.3);
      const endY = target.y - uy * Math.min(targetRadius + 2, length * 0.3);

      const family = edge.family || relationFamily(edge.relation);
      let color = RELATION_FAMILY_COLORS[family] || RELATION_FAMILY_COLORS.other;
      let alpha = edge.provenance === 'description' ? 0.12 : 0.24;
      let width = 0.8;
      let emphasize = false;

      if (edge.provenance === 'curated') {
        alpha = 0.7;
        width = 1.45;
      } else if (edge.provenance === 'explicit') {
        alpha = 0.42;
        width = 1;
      }

      if (state.focusedId) {
        const touches = source.id === state.focusedId || target.id === state.focusedId;
        emphasize = touches;
        if (state.viewMode === 'global') {
          alpha = touches ? Math.max(alpha, 0.82) : 0.018;
          width = touches ? Math.max(width, 1.35) : 0.5;
        } else if (touches) {
          alpha = Math.max(alpha, 0.76);
          width = Math.max(width, 1.25);
        }
      }

      state.edgeLayer.lineStyle(width, color, alpha);
      state.edgeLayer.moveTo(startX, startY);
      state.edgeLayer.lineTo(endX, endY);

      const showArrow = emphasize || (state.viewMode === 'local' && state.visibleEdges.length <= 90);
      if (showArrow && alpha > 0.08) {
        const arrowLength = 7;
        const arrowWidth = 3.4;
        const baseX = endX - ux * arrowLength;
        const baseY = endY - uy * arrowLength;
        const px = -uy;
        const py = ux;

        state.edgeLayer.beginFill(color, Math.min(0.9, alpha + 0.08));
        state.edgeLayer.drawPolygon([
          endX, endY,
          baseX + px * arrowWidth, baseY + py * arrowWidth,
          baseX - px * arrowWidth, baseY - py * arrowWidth
        ]);
        state.edgeLayer.endFill();
      }
    }
  }

  function onStagePointerDown(e) {
    if (state.touchPointers.size >= 2) return;
    if (state.draggingNode) return;
    state.panning = true;
    state.panMoved = false;
    state.panStart = { x: e.global.x, y: e.global.y };
    state.worldStart = { x: state.world.position.x, y: state.world.position.y };
  }

  function onStagePointerMove(e) {
    if (state.touchPointers.size >= 2) return;

    if (state.draggingNode) {
      const node = state.draggingNode;
      const dx = e.global.x - (node._pointerStartX || e.global.x);
      const dy = e.global.y - (node._pointerStartY || e.global.y);

      if (Math.hypot(dx, dy) > 6) node._dragMoved = true;

      const p = state.world.toLocal(e.global);
      node.fx = p.x + (node._dragOffsetX || 0);
      node.fy = p.y + (node._dragOffsetY || 0);
      return;
    }

    if (state.panning && state.panStart && state.worldStart) {
      const dx = e.global.x - state.panStart.x;
      const dy = e.global.y - state.panStart.y;
      if (Math.hypot(dx, dy) > 5) state.panMoved = true;

      state.world.position.set(
        state.worldStart.x + dx,
        state.worldStart.y + dy
      );
    }
  }

  function onStagePointerUp() {
    const wasDraggingNode = Boolean(state.draggingNode);
    const wasBackgroundTap = state.panning && !state.panMoved && !wasDraggingNode;

    if (state.draggingNode) {
      if (!$('pin-dragged').checked) {
        state.draggingNode.fx = null;
        state.draggingNode.fy = null;
      }

      state.draggingNode._dragOffsetX = 0;
      state.draggingNode._dragOffsetY = 0;
      state.draggingNode._pointerStartX = null;
      state.draggingNode._pointerStartY = null;
      state.draggingNode = null;

      if (state.simulation) state.simulation.alphaTarget(0);
    }

    state.panning = false;
    state.panMoved = false;
    state.panStart = null;
    state.worldStart = null;

    if (wasBackgroundTap && state.focusedId) {
      clearFocus();
    }
  }

  function onTouchStart(e) {
    if (e.touches.length < 2) return;
    e.preventDefault();

    state.panning = false;
    state.panMoved = false;

    if (state.draggingNode) {
      if (!$('pin-dragged').checked) {
        state.draggingNode.fx = null;
        state.draggingNode.fy = null;
      }
      state.draggingNode = null;
      if (state.simulation) state.simulation.alphaTarget(0);
    }

    const a = e.touches[0];
    const b = e.touches[1];
    const rect = state.pixi.view.getBoundingClientRect();
    const midpoint = {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top
    };
    const scale = state.world.scale.x;

    state.pinchStart = {
      distance: Math.max(1, Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)),
      scale,
      worldX: (midpoint.x - state.world.position.x) / scale,
      worldY: (midpoint.y - state.world.position.y) / scale
    };
  }

  function onTouchMove(e) {
    if (e.touches.length < 2 || !state.pinchStart) return;
    e.preventDefault();

    const a = e.touches[0];
    const b = e.touches[1];
    const rect = state.pixi.view.getBoundingClientRect();
    const midpoint = {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top
    };
    const distance = Math.max(1, Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY));
    const newScale = Math.max(0.12, Math.min(3.2,
      state.pinchStart.scale * (distance / state.pinchStart.distance)
    ));

    state.world.scale.set(newScale);
    state.world.position.set(
      midpoint.x - state.pinchStart.worldX * newScale,
      midpoint.y - state.pinchStart.worldY * newScale
    );
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      state.pinchStart = null;
      state.touchPointers.clear();
    }
  }

  function onWheel(e) {
    e.preventDefault();

    const rect = state.pixi.view.getBoundingClientRect();
    const point = new PIXI.Point(e.clientX - rect.left, e.clientY - rect.top);
    const oldScale = state.world.scale.x;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.12, Math.min(3.2, oldScale * factor));

    const worldX = (point.x - state.world.position.x) / oldScale;
    const worldY = (point.y - state.world.position.y) / oldScale;

    state.world.scale.set(newScale);
    state.world.position.set(
      point.x - worldX * newScale,
      point.y - worldY * newScale
    );
  }

  function zoomBy(factor) {
    const point = new PIXI.Point(state.pixi.screen.width / 2, state.pixi.screen.height / 2);
    const oldScale = state.world.scale.x;
    const newScale = Math.max(0.12, Math.min(3.2, oldScale * factor));
    const worldX = (point.x - state.world.position.x) / oldScale;
    const worldY = (point.y - state.world.position.y) / oldScale;

    state.world.scale.set(newScale);
    state.world.position.set(
      point.x - worldX * newScale,
      point.y - worldY * newScale
    );
  }

  function fitGraph() {
    if (!state.visibleNodes.length || !state.pixi) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of state.visibleNodes) {
      minX = Math.min(minX, node.x || 0);
      minY = Math.min(minY, node.y || 0);
      maxX = Math.max(maxX, node.x || 0);
      maxY = Math.max(maxY, node.y || 0);
    }

    const width = Math.max(140, maxX - minX);
    const height = Math.max(140, maxY - minY);
    const padding = state.viewMode === 'local' ? 110 : 75;
    const scale = Math.max(0.12, Math.min(2.3,
      Math.min(
        state.pixi.screen.width / (width + padding * 2),
        state.pixi.screen.height / (height + padding * 2)
      )
    ));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    state.world.scale.set(scale);
    state.world.position.set(
      state.pixi.screen.width / 2 - centerX * scale,
      state.pixi.screen.height / 2 - centerY * scale
    );
  }

  function renderTypeFilters() {
    $('type-filters').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<label class="check-item"><input type="checkbox" data-type="' + type + '" checked><span>' + label + '</span></label>'
    ).join('');

    $('type-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleTypes.add(input.dataset.type);
        else state.visibleTypes.delete(input.dataset.type);
        applyFilters(true);
      });
    });
  }

  function renderLegend() {
    $('legend-items').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<div class="legend-row"><span class="legend-left"><span class="legend-dot" style="background:' +
      TYPE_CSS[type] + '"></span>' + label + '</span></div>'
    ).join('');
  }

  function relationFamily(relation) {
    const r = norm(relation);

    if (/create|copy|transform/.test(r)) return 'creation';
    if (/appl|grant|restore|heal|increase|max hp/.test(r)) return 'application';
    if (/trigger|benefit/.test(r)) return 'trigger';
    if (/scale|equal to/.test(r)) return 'scaling';
    if (/require|restrict|condition/.test(r)) return 'requirement';
    if (/move|play from|plays from|moves to|moves from|return/.test(r)) return 'movement';
    if (/modif|reduce|remove|retain|double|repeat|forg|target scope|sets capacity/.test(r)) return 'modification';
    if (/draw|discard|exhaust|channel|evoke|summon|spend|consume|lose hp|self-exhaust/.test(r)) return 'resource';
    return 'other';
  }

  function edgePassesFilters(edge) {
    if (!state.visibleProvenance.has(edge.provenance || 'description')) return false;
    if (!state.visibleRelationFamilies.has(relationFamily(edge.relation))) return false;
    return true;
  }

  function renderEdgeFilters() {
    const provenanceCounts = new Map();
    const familyCounts = new Map();

    for (const edge of state.edges) {
      const provenance = edge.provenance || 'description';
      const family = relationFamily(edge.relation);
      provenanceCounts.set(provenance, (provenanceCounts.get(provenance) || 0) + 1);
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    }

    const provenances = [...provenanceCounts.keys()].sort();
    state.visibleProvenance = new Set(provenances);
    state.visibleRelationFamilies = new Set(Object.keys(RELATION_FAMILY_LABELS).filter(key => familyCounts.has(key)));

    $('provenance-filters').innerHTML = provenances.map(value =>
      '<label class="toggle-row compact-toggle"><input type="checkbox" data-provenance="' + htmlEsc(value) + '" checked>' +
      '<span>' + htmlEsc(value) + '</span><span class="filter-count">' + provenanceCounts.get(value) + '</span></label>'
    ).join('');

    $('relation-filters').innerHTML = Object.entries(RELATION_FAMILY_LABELS)
      .filter(([key]) => familyCounts.has(key))
      .map(([key, label]) =>
        '<label class="toggle-row compact-toggle"><input type="checkbox" data-relation-family="' + htmlEsc(key) + '" checked>' +
        '<span class="family-label"><span class="family-swatch" style="background:' + RELATION_FAMILY_CSS[key] + '"></span>' +
        htmlEsc(label) + '</span><span class="filter-count">' + familyCounts.get(key) + '</span></label>'
      ).join('');

    $('provenance-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleProvenance.add(input.dataset.provenance);
        else state.visibleProvenance.delete(input.dataset.provenance);
        applyFilters(true);
        if (state.focusedId) renderInspector(state.focusedId);
      });
    });

    $('relation-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleRelationFamilies.add(input.dataset.relationFamily);
        else state.visibleRelationFamilies.delete(input.dataset.relationFamily);
        applyFilters(true);
        if (state.focusedId) renderInspector(state.focusedId);
      });
    });
  }

  function setNodeInUrl(id, replace) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('node', id);
    else url.searchParams.delete('node');
    const stateValue = id ? { node: id } : {};
    if (replace) window.history.replaceState(stateValue, '', url);
    else window.history.pushState(stateValue, '', url);
  }

  function syncFocusFromUrl() {
    const id = new URL(window.location.href).searchParams.get('node');
    if (id && state.byId.has(id)) focusNode(id, false);
    else clearFocus(false);
  }

  function optionize(el, values, formatter) {
    formatter = formatter || (v => v);
    const first = el.options[0].outerHTML;

    el.innerHTML = first + values
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map(v => '<option value="' + htmlEsc(v) + '">' + htmlEsc(formatter(v)) + '</option>')
      .join('');
  }

  function setupControls() {
    renderTypeFilters();
    renderLegend();
    renderEdgeFilters();

    optionize($('color-filter'), [...new Set(state.nodes.map(n => n.color).filter(Boolean))]);
    optionize(
      $('rarity-filter'),
      [...new Set(
        state.nodes
          .filter(n => ['card', 'relic', 'potion', 'enchantment'].includes(n.type))
          .map(n => n.rarity)
          .filter(Boolean)
      )]
    );
    optionize($('card-type-filter'), [...new Set(state.nodes.filter(n => n.type === 'card').map(n => n.cardType).filter(Boolean))]);

    const costs = [...new Set(
      state.nodes
        .filter(n => n.type === 'card')
        .map(n => n.cost)
        .filter(v => v !== undefined && v !== null)
    )].sort((a, b) => Number(a) - Number(b));

    optionize($('cost-filter'), costs, v => v === -1 ? 'X' : v);

    ['search-input', 'color-filter', 'rarity-filter', 'card-type-filter', 'cost-filter', 'isolated-filter', 'incoming-filter', 'outgoing-filter'].forEach(id => {
      $(id).addEventListener(id === 'search-input' ? 'input' : 'change', () => applyFilters(true));
    });

    ['center-force', 'repel-force', 'link-force', 'link-distance'].forEach(id => {
      $(id).addEventListener('input', updatePhysics);
    });

    $('reheat-graph').addEventListener('click', restructureGraph);

    $('global-mode').addEventListener('click', () => setViewMode('global'));
    $('local-mode').addEventListener('click', () => setViewMode('local'));

    document.querySelectorAll('.depth-button').forEach(button => {
      button.addEventListener('click', () => {
        state.depth = Number(button.dataset.depth);
        document.querySelectorAll('.depth-button').forEach(b => b.classList.toggle('active', b === button));
        if (state.viewMode === 'local') applyFilters(true);
      });
    });

    $('reset-filters').addEventListener('click', resetFilters);
    $('clear-focus').addEventListener('click', clearFocus);
    $('copy-link').addEventListener('click', async () => {
      if (!state.focusedId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('node', state.focusedId);

      try {
        await navigator.clipboard.writeText(url.toString());
        const button = $('copy-link');
        const previous = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = previous; }, 1200);
      } catch (_) {
        window.prompt('Copy this node link:', url.toString());
      }
    });
    $('fit-graph').addEventListener('click', fitGraph);
    $('zoom-in').addEventListener('click', () => zoomBy(1.18));
    $('zoom-out').addEventListener('click', () => zoomBy(1 / 1.18));

    $('filters-toggle').addEventListener('click', () => $('filters-panel').classList.add('open'));
    $('filters-close').addEventListener('click', () => $('filters-panel').classList.remove('open'));
    $('inspector-toggle').addEventListener('click', () => $('inspector-panel').classList.add('open'));
    $('inspector-close').addEventListener('click', () => $('inspector-panel').classList.remove('open'));

    $('command-button').addEventListener('click', openPalette);
    $('palette-backdrop').addEventListener('mousedown', e => {
      if (e.target === $('palette-backdrop')) closePalette();
    });
    $('palette-input').addEventListener('input', updatePalette);
    $('palette-input').addEventListener('keydown', handlePaletteKeys);

    window.addEventListener('popstate', syncFocusFromUrl);

    document.addEventListener('keydown', e => {
      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';

      if (ctrlK) {
        e.preventDefault();
        openPalette();
        return;
      }

      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        $('search-input').focus();
      }

      if (e.key === 'Escape') {
        if (!$('palette-backdrop').classList.contains('hidden')) closePalette();
        else clearFocus();
      }
    });
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    $('global-mode').classList.toggle('active', mode === 'global');
    $('local-mode').classList.toggle('active', mode === 'local');
    $('depth-controls').classList.toggle('disabled', mode !== 'local');
    $('selection-hint').classList.toggle('hidden', !(mode === 'local' && !state.focusedId));
    applyFilters(true);
  }

  function matchesFilters(node) {
    if (!state.visibleTypes.has(node.type)) return false;

    const q = norm($('search-input').value);
    if (q && !(norm(node.name).includes(q) || norm(node.description).includes(q))) return false;

    const rarity = $('rarity-filter').value;
    if (rarity !== 'all' && ['card', 'relic', 'potion', 'enchantment'].includes(node.type)) {
      if (node.rarity !== rarity) return false;
    }

    const cardType = $('card-type-filter').value;
    if (cardType !== 'all' && node.type === 'card' && node.cardType !== cardType) return false;

    const cost = $('cost-filter').value;
    if (cost !== 'all' && node.type === 'card' && String(node.cost) !== cost) return false;

    return true;
  }

  function collectLocal(startId, baseAllowed) {
    if (!startId || !baseAllowed.has(startId)) return new Set();

    const incoming = $('incoming-filter').checked;
    const outgoing = $('outgoing-filter').checked;
    const found = new Set([startId]);
    let frontier = new Set([startId]);

    for (let step = 0; step < state.depth; step++) {
      const next = new Set();

      for (const id of frontier) {
        if (outgoing) {
          for (const edge of state.outAdj.get(id) || []) {
            if (!edgePassesFilters(edge)) continue;
            if (baseAllowed.has(edge.target) && !found.has(edge.target)) {
              found.add(edge.target);
              next.add(edge.target);
            }
          }
        }

        if (incoming) {
          for (const edge of state.inAdj.get(id) || []) {
            if (!edgePassesFilters(edge)) continue;
            if (baseAllowed.has(edge.source) && !found.has(edge.source)) {
              found.add(edge.source);
              next.add(edge.source);
            }
          }
        }
      }

      frontier = next;
      if (!frontier.size) break;
    }

    return found;
  }

  function applyFilters(shouldFit) {
    const baseAllowed = new Set(state.nodes.filter(matchesFilters).map(n => n.id));
    const eligibleEdges = state.edges.filter(edgePassesFilters);
    let visible = new Set(baseAllowed);

    const color = $('color-filter').value;
    if (color !== 'all') {
      const contextColors = new Set(['shared', 'colorless', 'status', 'curse', 'token', 'event', 'quest']);
      const seeds = new Set(
        state.nodes
          .filter(node => baseAllowed.has(node.id) && node.color === color)
          .map(node => node.id)
      );

      visible = new Set(seeds);

      for (const edge of eligibleEdges) {
        let otherId = null;

        if (seeds.has(edge.source)) otherId = edge.target;
        else if (seeds.has(edge.target)) otherId = edge.source;

        if (!otherId || !baseAllowed.has(otherId)) continue;

        const other = state.byId.get(otherId);
        if (!other) continue;

        if (!other.color || other.color === color || contextColors.has(other.color)) {
          visible.add(otherId);
        }
      }
    }

    if (state.viewMode === 'local' && state.focusedId && visible.has(state.focusedId)) {
      visible = collectLocal(state.focusedId, visible);
    }

    let visibleEdges = eligibleEdges.filter(e => visible.has(e.source) && visible.has(e.target));

    if ($('isolated-filter').checked && !$('search-input').value && state.viewMode === 'global') {
      const connected = new Set();

      for (const edge of visibleEdges) {
        connected.add(edge.source);
        connected.add(edge.target);
      }

      visible = new Set([...visible].filter(id => connected.has(id) || id === state.focusedId));
      visibleEdges = eligibleEdges.filter(e => visible.has(e.source) && visible.has(e.target));
    }

    if (state.focusedId && !visible.has(state.focusedId)) {
      state.focusedId = null;
      setNodeInUrl(null, true);
      $('clear-focus').disabled = true;
      $('copy-link').disabled = true;
      document.title = 'STS2 Bubble — Slay the Spire 2 Interaction Graph';
      $('entity-card').classList.add('hidden');
      $('inspector-empty').classList.remove('hidden');
      $('note-path').textContent = 'No note selected';
      $('note-panel-title').textContent = 'Reading view';
      $('inspector-panel').classList.remove('open');
    }

    state.visibleNodes = [...visible].map(id => state.byId.get(id)).filter(Boolean);
    state.visibleEdges = visibleEdges;

    rebuildScene();

    const modeLabel = state.viewMode === 'local' ? 'local · depth ' + state.depth : 'global';
    const colorLabel = $('color-filter').value !== 'all' ? ' · ' + $('color-filter').value : '';
    $('graph-summary').textContent = modeLabel + colorLabel + ' · ' + state.visibleNodes.length + ' nodes · ' + state.visibleEdges.length + ' links';
    $('selection-hint').classList.toggle('hidden', !(state.viewMode === 'local' && !state.focusedId));

    if (shouldFit) setTimeout(fitGraph, 160);
  }

  function updateAllNodeStyles() {
    for (const node of state.visibleNodes) styleNodeView(node);
  }

  function focusNode(id, writeUrl = true) {
    const node = state.byId.get(id);
    if (!node) return;

    state.focusedId = id;
    if (writeUrl) setNodeInUrl(id, false);
    document.title = node.name + ' — STS2 Bubble';
    $('clear-focus').disabled = false;
    $('copy-link').disabled = false;
    renderInspector(id);

    if (state.viewMode === 'local') {
      applyFilters(true);
    } else {
      updateAllNodeStyles();
      setTimeout(() => fitNeighborhood(id), 20);
    }

    if (window.innerWidth <= 900) $('inspector-panel').classList.add('open');
  }

  function fitNeighborhood(id) {
    const ids = new Set([id]);

    for (const edge of state.outAdj.get(id) || []) ids.add(edge.target);
    for (const edge of state.inAdj.get(id) || []) ids.add(edge.source);

    const nodes = [...ids].map(nodeIdValue => state.byId.get(nodeIdValue)).filter(node => node && state.nodeViews.has(node.id));
    if (!nodes.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x || 0);
      minY = Math.min(minY, node.y || 0);
      maxX = Math.max(maxX, node.x || 0);
      maxY = Math.max(maxY, node.y || 0);
    }

    const width = Math.max(90, maxX - minX);
    const height = Math.max(90, maxY - minY);
    const scale = Math.max(0.2, Math.min(2.2,
      Math.min(
        state.pixi.screen.width / (width + 220),
        state.pixi.screen.height / (height + 220)
      )
    ));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    state.world.scale.set(scale);
    state.world.position.set(
      state.pixi.screen.width / 2 - centerX * scale,
      state.pixi.screen.height / 2 - centerY * scale
    );
  }

  function clearFocus(writeUrl = true) {
    state.focusedId = null;
    if (writeUrl) setNodeInUrl(null, false);
    document.title = 'STS2 Bubble — Slay the Spire 2 Interaction Graph';
    $('clear-focus').disabled = true;
    $('copy-link').disabled = true;
    $('inspector-panel').classList.remove('open');

    $('entity-card').classList.add('hidden');
    $('inspector-empty').classList.remove('hidden');
    $('note-path').textContent = 'No note selected';
    $('note-panel-title').textContent = 'Reading view';

    if (state.viewMode === 'local') applyFilters(true);
    else updateAllNodeStyles();
  }

  function relationRow(edge, node, direction) {
    const provenance = edge.provenance === 'curated' ? 'curated' :
      edge.provenance === 'explicit' ? 'explicit' :
      edge.provenance === 'derived' ? 'derived' :
      edge.provenance === 'name-match' ? 'matched' : 'text';

    const family = relationFamily(edge.relation);
    return '<div class="relation" data-target="' + htmlEsc(node.id) + '">' +
      '<span class="relation-dot" style="background:' + TYPE_CSS[node.type] + '"></span>' +
      '<div><div class="relation-name">' + htmlEsc(node.name) + '</div>' +
      '<div class="relation-type"><span class="relation-family-dot" style="background:' + RELATION_FAMILY_CSS[family] + '"></span>' +
      htmlEsc(direction + ' · ' + edge.relation) +
      ' · <span class="relation-provenance">' + htmlEsc(provenance) + '</span></div></div></div>';
  }

  function renderInspector(id) {
    const node = state.byId.get(id);
    if (!node) return;

    $('inspector-empty').classList.add('hidden');
    $('entity-card').classList.remove('hidden');

    $('note-path').textContent = TYPE_FOLDERS[node.type] + ' / ' + node.name + '.md';
    $('note-panel-title').textContent = 'Reading view';
    $('entity-kicker').textContent = TYPE_LABELS[node.type].replace(/s$/, '');
    $('entity-name').textContent = node.name;

    const chips = [
      node.color,
      node.rarity,
      node.cardType,
      node.cost !== undefined && node.type === 'card' ? (node.cost === -1 ? 'X cost' : node.cost + ' cost') : '',
      node.degree ? node.degree + ' links' : ''
    ].filter(Boolean);

    $('entity-meta').innerHTML = chips.map(c => '<span class="chip">' + htmlEsc(c) + '</span>').join('');
    $('entity-description').textContent = node.description || 'No description available.';

    const facts = [];
    if (node.type === 'card') {
      if (node.target) facts.push(['Target', node.target]);
      if (node.keywords && node.keywords.length) facts.push(['Keywords', node.keywords.join(', ')]);
      if (node.tags && node.tags.length) facts.push(['Tags', node.tags.join(', ')]);
      if (node.vars && Object.keys(node.vars).length) {
        facts.push(['Base values', Object.entries(node.vars).map(([k,v]) => k.replace(/^power_/, '') + ': ' + v).join(' · ')]);
      }
    } else if (node.type === 'potion' && node.target) {
      facts.push(['Target', node.target]);
    } else if (node.type === 'mechanic' && node.mechanicGroup) {
      facts.push(['Mechanic group', node.mechanicGroup.replace(/_/g, ' ')]);
    }

    if (facts.length) {
      $('entity-facts').classList.remove('hidden');
      $('entity-facts').innerHTML = facts.map(([label, value]) =>
        '<div class="fact-card"><div class="fact-label">' + htmlEsc(label) + '</div><div class="fact-value">' + htmlEsc(value) + '</div></div>'
      ).join('');
    } else {
      $('entity-facts').classList.add('hidden');
      $('entity-facts').innerHTML = '';
    }

    const upgrade = node.type === 'card' ? (node.upgrade || {}) : {};
    if (Object.keys(upgrade).length) {
      $('upgrade-section').classList.remove('hidden');
      const description = upgrade.description ? '<div class="upgrade-card">' + htmlEsc(upgrade.description) + '</div>' : '';
      const deltas = Object.entries(upgrade)
        .filter(([key]) => key !== 'description')
        .map(([key, value]) =>
          '<div class="upgrade-delta"><span class="upgrade-key">' + htmlEsc(key.replace(/_/g, ' ')) +
          '</span><span class="upgrade-value">+' + htmlEsc(value) + '</span></div>'
        ).join('');
      $('upgrade-card').innerHTML = description + deltas;
    } else {
      $('upgrade-section').classList.add('hidden');
      $('upgrade-card').innerHTML = '';
    }

    const outgoing = (state.outAdj.get(id) || [])
      .filter(edgePassesFilters)
      .map(edge => ({ edge, node: state.byId.get(edge.target) }))
      .filter(item => item.node);

    const incoming = (state.inAdj.get(id) || [])
      .filter(edgePassesFilters)
      .map(edge => ({ edge, node: state.byId.get(edge.source) }))
      .filter(item => item.node);

    $('outgoing-count').textContent = outgoing.length;
    $('backlinks-count').textContent = incoming.length;

    $('outgoing-list').innerHTML = outgoing.length
      ? outgoing.slice(0, 150).map(item => relationRow(item.edge, item.node, 'to')).join('')
      : '<div class="empty-links">No outgoing links.</div>';

    $('backlinks-list').innerHTML = incoming.length
      ? incoming.slice(0, 150).map(item => relationRow(item.edge, item.node, 'from')).join('')
      : '<div class="empty-links">No backlinks.</div>';

    document.querySelectorAll('.relation[data-target]').forEach(el => {
      el.addEventListener('click', () => focusNode(el.dataset.target));
    });
  }

  function resetFilters() {
    $('search-input').value = '';
    $('color-filter').value = 'all';
    $('rarity-filter').value = 'all';
    $('card-type-filter').value = 'all';
    $('cost-filter').value = 'all';
    $('isolated-filter').checked = true;
    $('incoming-filter').checked = true;
    $('outgoing-filter').checked = true;

    $('center-force').value = 12;
    $('repel-force').value = 170;
    $('link-force').value = 28;
    $('link-distance').value = 92;
    $('pin-dragged').checked = false;

    state.visibleTypes = new Set(Object.keys(TYPE_LABELS));
    $('type-filters').querySelectorAll('input').forEach(i => i.checked = true);

    state.visibleProvenance = new Set([...$('provenance-filters').querySelectorAll('input')].map(i => i.dataset.provenance));
    $('provenance-filters').querySelectorAll('input').forEach(i => i.checked = true);
    state.visibleRelationFamilies = new Set([...$('relation-filters').querySelectorAll('input')].map(i => i.dataset.relationFamily));
    $('relation-filters').querySelectorAll('input').forEach(i => i.checked = true);

    updatePhysics();
    applyFilters(true);
  }

  function openPalette() {
    $('palette-backdrop').classList.remove('hidden');
    $('palette-input').value = '';
    state.paletteIndex = 0;
    updatePalette();
    setTimeout(() => $('palette-input').focus(), 0);
  }

  function closePalette() {
    $('palette-backdrop').classList.add('hidden');
  }

  function updatePalette() {
    const q = norm($('palette-input').value);

    state.paletteMatches = state.nodes
      .filter(node => !q || norm(node.name).includes(q) || norm(node.description).includes(q))
      .sort((a, b) => {
        const aExact = q && norm(a.name) === q ? 1 : 0;
        const bExact = q && norm(b.name) === q ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const aStart = q && norm(a.name).startsWith(q) ? 1 : 0;
        const bStart = q && norm(b.name).startsWith(q) ? 1 : 0;
        if (aStart !== bStart) return bStart - aStart;

        return (b.degree || 0) - (a.degree || 0) || a.name.localeCompare(b.name);
      })
      .slice(0, 14);

    state.paletteIndex = Math.min(state.paletteIndex, Math.max(0, state.paletteMatches.length - 1));

    $('palette-results').innerHTML = state.paletteMatches.length
      ? state.paletteMatches.map((node, index) =>
          '<div class="palette-result' + (index === state.paletteIndex ? ' active' : '') + '" data-id="' + htmlEsc(node.id) + '">' +
          '<span class="palette-result-dot" style="background:' + TYPE_CSS[node.type] + '"></span>' +
          '<span class="palette-result-name">' + htmlEsc(node.name) + '</span>' +
          '<span class="palette-result-meta">' + htmlEsc(TYPE_LABELS[node.type].replace(/s$/, '')) + '</span></div>'
        ).join('')
      : '<div class="empty-links">No matching notes.</div>';

    $('palette-results').querySelectorAll('.palette-result').forEach(el => {
      el.addEventListener('click', () => openPaletteResult(el.dataset.id));
    });
  }

  function handlePaletteKeys(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.paletteIndex = Math.min(state.paletteIndex + 1, state.paletteMatches.length - 1);
      updatePalette();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.paletteIndex = Math.max(state.paletteIndex - 1, 0);
      updatePalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = state.paletteMatches[state.paletteIndex];
      if (selected) openPaletteResult(selected.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  function openPaletteResult(id) {
    closePalette();

    const node = state.byId.get(id);
    if (!node) return;

    if (!matchesFilters(node)) {
      $('search-input').value = '';
      $('color-filter').value = 'all';
      $('rarity-filter').value = 'all';
      $('card-type-filter').value = 'all';
      $('cost-filter').value = 'all';

      state.visibleTypes.add(node.type);
      const typeBox = $('type-filters').querySelector('input[data-type="' + node.type + '"]');
      if (typeBox) typeBox.checked = true;

      applyFilters(false);
    }

    focusNode(id);
  }

  async function boot() {
    try {
      const [entries, datasetMeta] = await Promise.all([
        Promise.all(Object.entries(SOURCES).map(async pair => [pair[0], await loadJson(pair[1])])),
        loadOptionalJson(SOURCE_META_URL, {})
      ]);

      const raw = Object.fromEntries(entries);
      const manualLinks = await loadOptionalJson('./data/manual-links.json', []);
      state.datasetMeta = datasetMeta || {};

      state.nodes = normalizeData(raw);
      state.edges = buildEdges(state.nodes, manualLinks, raw.cardPowers);
      buildAdjacency();

      initPixi();
      setupControls();
      applyFilters(false);

      const initialNode = new URL(window.location.href).searchParams.get('node');
      if (initialNode && state.byId.has(initialNode)) {
        focusNode(initialNode, false);
      } else if (initialNode) {
        setNodeInUrl(null, true);
      }

      setTimeout(() => initialNode ? fitNeighborhood(initialNode) : fitGraph(), 500);

      $('loading-state').classList.add('hidden');
      $('dataset-status').classList.add('ready');
      const version = state.datasetMeta.game_data_version ? 'v' + state.datasetMeta.game_data_version : 'snapshot';
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>' + htmlEsc(version) + ' ready</span>';
      $('data-count').textContent = state.nodes.length + ' notes · ' + state.edges.length + ' links';
      if ($('data-snapshot')) {
        const shortSha = String(state.datasetMeta.source_commit || '').slice(0, 7);
        const date = state.datasetMeta.snapshot_date || '';
        $('data-snapshot').textContent = [version, date, shortSha].filter(Boolean).join(' · ');
      }
    } catch (err) {
      console.error(err);
      $('loading-state').innerHTML = '<strong>Could not load STS2 data</strong><span>' + htmlEsc(err.message) + '</span>';
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>Data unavailable</span>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();