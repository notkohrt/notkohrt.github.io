import { createNodePaths } from './graph-model.mjs';
import { cardCosts, costText, upgradeFacts } from './card-facts.mjs';

export const DECK_FORMAT = 'sts2-stars-deck-v1';
export const MAX_DECK_SIZE = 500;
export const CHARACTER_COLORS = ['ironclad', 'silent', 'defect', 'necrobinder', 'regent'];
export const SILENT_EXAMPLE = {
  format: DECK_FORMAT,
  entries: [
    ['STRIKE_SILENT', 4], ['DEFEND_SILENT', 4], ['SURVIVOR', 1], ['NEUTRALIZE', 1], ['BLADE_DANCE', 2], ['ACCURACY', 1], ['BACKFLIP', 2], ['ACROBATICS', 2], ['CLOAK_AND_DAGGER', 1], ['PREPARED', 1], ['DAGGER_THROW', 1]
  ].map(([id, count]) => ({ id: 'card:' + id, count, upgraded: false })),
  relics: []
};
export const ANALYSIS_ASSUMPTIONS = [
  'Draw odds sample cards uniformly without replacement from the entire entered deck. They do not simulate turns or reshuffles.',
  'Innate, starting-hand relics, tutors, extra draw, and cards created during combat are not included in draw odds. Set the sample size yourself.',
  'Mechanic coverage uses detected base-card relationships, including one hop through explicitly granted powers. Upgrade-exclusive relationships may be absent.',
  'Costs are printed values. Conditional discounts, refunds, X payments, and unrecorded Star costs are not estimated.',
  'Enablers and uses/payoffs sharing a mechanic are candidates to investigate, not proof of a working combo, infinite, or stronger deck.',
  'This snapshot contains no run outcomes, reward weights, or encounter simulation; coverage is not a win rate or reward probability.'
];

// These are classifications of existing mechanical roles, never new edges.
// Keeping exact verbs prevents costs, requirements, and mere mentions from
// becoming producers. Every reported role retains its original edge evidence.
export const MECHANIC_PROFILES = [
  { id: 'draw', label: 'Draw', targets: ['effect:DRAW'], enablers: ['draws'], payoffs: ['triggers on draw', 'scales with draw', 'requires draw'] },
  { id: 'discard', label: 'Discard', targets: ['effect:DISCARD'], enablers: ['discards'], payoffs: ['benefits from discard', 'triggers on discard', 'scales with discard'] },
  { id: 'exhaust', label: 'Exhaust', targets: ['effect:EXHAUST_CARD'], enablers: ['self-exhausts', 'exhausts cards'], payoffs: ['triggers on exhaust', 'scales with exhaust', 'requires exhaust'] },
  { id: 'shiv', label: 'Shivs', targets: ['card:SHIV'], enablers: ['creates'], payoffs: ['modifies', 'plays', 'triggers on'] },
  { id: 'poison', label: 'Poison', targets: ['power:POISON_POWER'], enablers: ['applies'], payoffs: ['triggers', 'triggers on', 'scales with', 'requires'] },
  { id: 'doom', label: 'Doom', targets: ['power:DOOM_POWER'], enablers: ['applies', 'applies from Attack damage'], payoffs: ['requires Doom application', 'kills at Doom ≥ HP', 'scales with existing Doom', 'scales with Doom', 'triggers on Doom application', 'triggers on Doom kill', 'modifies damage at Doom ≥ HP'] },
  { id: 'forge', label: 'Forge', targets: ['mechanic:FORGE'], enablers: ['forges'], payoffs: ['triggers on Forge'] },
  { id: 'stars', label: 'Stars', targets: ['mechanic:STAR_COUNT'], enablers: ['gains Stars'], payoffs: ['requires Stars', 'triggers on Stars', 'scales with Star-cost cards', 'scales with Stars gained', 'triggers on Stars spent', 'scales with Stars spent'] },
  { id: 'orbs', label: 'Orbs', targets: ['mechanic:ORB_SYSTEM', 'mechanic:LIGHTNING', 'mechanic:FROST', 'mechanic:DARK', 'mechanic:PLASMA', 'mechanic:GLASS'], enablers: ['channels'], payoffs: ['evokes', 'triggers passive', 'scales with Channeled Orbs', 'scales with unique Orbs', 'triggers after 7 Channels', 'triggers on Evoke', 'scales with previously Channeled', 'modifies effectiveness'] },
  { id: 'osty', label: 'Osty', targets: ['mechanic:SUMMON', 'mechanic:OSTY'], enablers: ['summons / strengthens Osty'], payoffs: ['commands attack', 'modifies damage', 'triggers on attack', 'requires alive', 'requires prior attack', 'scales with Osty Attacks', 'scales with Max HP', 'scales with HP', 'sacrifices', 'triggers on hit', 'triggers on HP loss'] },
  { id: 'block', label: 'Block', targets: ['mechanic:BLOCK'], enablers: ['grants'], payoffs: ['triggers on Block gain', 'scales with', 'triggers on', 'retains'] }
];

function integer(value, label, max = MAX_DECK_SIZE) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(label + ' must be a whole number from 0 to ' + max + '.');
  return value;
}

// Dynamic hypergeometric distribution avoids factorial overflow and uses no
// Monte Carlo randomness. It remains stable for full-deck samples and 0 copies.
export function drawProbability(size, copies, draws, minimum = 1) {
  integer(size, 'Deck size'); integer(copies, 'Copies'); integer(draws, 'Cards drawn'); integer(minimum, 'Required copies');
  if (copies > size || draws > size) throw new Error('Copies and cards drawn cannot exceed deck size.');
  if (minimum === 0) return 1;
  if (minimum > copies || minimum > draws) return 0;
  let distribution = [1];
  for (let drawn = 0; drawn < draws; drawn++) {
    const next = new Array(Math.min(drawn + 1, copies) + 1).fill(0);
    for (let found = 0; found < distribution.length; found++) {
      const probability = distribution[found];
      if (!probability) continue;
      const remaining = size - drawn;
      const hit = (copies - found) / remaining;
      if (found + 1 < next.length) next[found + 1] += probability * hit;
      next[found] += probability * (1 - hit);
    }
    distribution = next;
  }
  return Math.max(0, Math.min(1, distribution.slice(minimum).reduce((sum, probability) => sum + probability, 0)));
}

// The two groups must be distinct card IDs. Upgraded and base copies of the
// same card are a single group; the UI does not treat them as independent.
export function pairProbability(size, firstCopies, secondCopies, draws) {
  integer(firstCopies, 'First copies'); integer(secondCopies, 'Second copies');
  if (firstCopies + secondCopies > size) throw new Error('The two card groups must be disjoint.');
  const first = drawProbability(size, firstCopies, draws);
  const second = drawProbability(size, secondCopies, draws);
  const either = drawProbability(size, firstCopies + secondCopies, draws);
  return Math.max(0, Math.min(1, first + second - either));
}

export function createDeckIndex(nodes, edges, meta = {}) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) outgoing.get(edge.source)?.push(edge);
  const facts = new Map();
  for (const node of nodes.filter(item => ['card', 'relic'].includes(item.type))) {
    const direct = outgoing.get(node.id) || [];
    const evidence = direct.map(edge => ({ edge, path: [edge.id] }));
    for (const grant of direct.filter(edge => edge.relation === 'grants' && byId.get(edge.target)?.type === 'power')) {
      for (const edge of outgoing.get(grant.target) || []) evidence.push({ edge, path: [grant.id, edge.id] });
    }
    facts.set(node.id, evidence);
  }
  return { byId, facts, paths: createNodePaths(nodes), meta, cards: nodes.filter(node => node.type === 'card'), relics: nodes.filter(node => node.type === 'relic') };
}

export function normalizeDeck(index, draft = {}) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('Expected a deck object.');
  if (draft.format && draft.format !== DECK_FORMAT) throw new Error('Unsupported deck format.');
  if (!Array.isArray(draft.entries === undefined ? [] : draft.entries) || !Array.isArray(draft.relics === undefined ? [] : draft.relics)) throw new Error('Deck entries and relics must be lists.');
  const merged = new Map();
  for (const entry of draft.entries || []) {
    if (!entry || index.byId.get(entry.id)?.type !== 'card') throw new Error('Unknown card: ' + String(entry?.id));
    const count = integer(entry.count, 'Card copies', 99);
    if (entry.upgraded !== undefined && typeof entry.upgraded !== 'boolean') throw new Error('Upgraded must be true or false.');
    if (!count) continue;
    const upgraded = entry.upgraded === true;
    const key = entry.id + '|' + upgraded;
    const previous = merged.get(key)?.count || 0;
    if (previous + count > 99) throw new Error('A card variant cannot have more than 99 copies.');
    merged.set(key, { id: entry.id, count: previous + count, upgraded });
  }
  const entries = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id, 'en') || Number(a.upgraded) - Number(b.upgraded));
  const size = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (size > MAX_DECK_SIZE) throw new Error('Deck size cannot exceed ' + MAX_DECK_SIZE + ' cards.');
  const relics = [...new Set(draft.relics || [])].sort();
  for (const id of relics) if (index.byId.get(id)?.type !== 'relic') throw new Error('Unknown relic: ' + String(id));
  return { format: DECK_FORMAT, snapshot: index.meta.source_commit || '', entries, relics };
}

export function readDeckDocument(index, draft) {
  const normalized = normalizeDeck(index, draft);
  const draws = integer(draft.draws ?? 5, 'Sample size');
  const combo = draft.combo === undefined ? [] : draft.combo;
  if (!Array.isArray(combo) || combo.length > 2) throw new Error('Combo must be a list of up to two card IDs.');
  const ids = new Set(normalized.entries.map(entry => entry.id));
  for (const id of combo) {
    if (typeof id !== 'string') throw new Error('Combo card IDs must be text.');
    if (id && !ids.has(id)) throw new Error('A combo card is missing from the deck.');
  }
  if (combo[0] && combo[0] === combo[1]) throw new Error('Combo cards must have different IDs.');
  if (draft.snapshot !== undefined && (typeof draft.snapshot !== 'string' || (draft.snapshot && !/^[a-f0-9]{40}$/.test(draft.snapshot)))) throw new Error('Snapshot must be a full source commit ID.');
  return { normalized, draws, combo };
}

export function analyzeDeck(index, draft, { draws = 5, firstId = '', secondId = '' } = {}) {
  const deck = normalizeDeck(index, draft);
  const size = deck.entries.reduce((sum, entry) => sum + entry.count, 0);
  integer(draws, 'Cards drawn');
  if (draws > size) throw new Error('Cards drawn cannot exceed deck size.');
  const counts = new Map();
  const curve = new Map();
  let fixedEnergy = 0, fixedEnergyCards = 0, starCards = 0, xCards = 0, unknownCosts = 0;
  const cardRows = deck.entries.map(entry => {
    const node = index.byId.get(entry.id), costs = cardCosts(node, entry.upgraded);
    counts.set(entry.id, (counts.get(entry.id) || 0) + entry.count);
    const label = costs.unplayable ? 'Unplayable' : costText(costs.energy);
    curve.set(label, (curve.get(label) || 0) + entry.count);
    if (!costs.unplayable && Number.isInteger(costs.energy) && costs.energy >= 0) { fixedEnergy += costs.energy * entry.count; fixedEnergyCards += entry.count; }
    if (costs.energy === -1) xCards += entry.count;
    if (label === 'Unknown') unknownCosts += entry.count;
    if (Number.isInteger(costs.stars) && costs.stars > 0) starCards += entry.count;
    return { ...entry, name: node.name, color: node.color, costs, upgrades: upgradeFacts(node) };
  });
  const selected = [...counts].map(([id, copies]) => ({ id, copies, type: 'card' })).concat(deck.relics.map(id => ({ id, copies: 1, type: 'relic' })));
  const mechanics = MECHANIC_PROFILES.map(profile => {
    const roles = {};
    for (const role of ['enablers', 'payoffs']) {
      roles[role] = selected.flatMap(item => {
        const evidence = (index.facts.get(item.id) || []).filter(fact => profile.targets.includes(fact.edge.target) && profile[role].includes(fact.edge.relation));
        if (!evidence.length) return [];
        return [{ ...item, name: index.byId.get(item.id).name, evidence: evidence.map(({ edge, path }) => ({ edgeId: edge.id, source: edge.source, target: edge.target, relation: edge.relation, path })) }];
      });
    }
    return { id: profile.id, label: profile.label, ...roles };
  }).filter(profile => profile.enablers.length || profile.payoffs.length);
  const odds = [...counts].map(([id, copies]) => ({ id, name: index.byId.get(id).name, copies, probability: drawProbability(size, copies, draws) }));
  let combo = null;
  if ((firstId && !counts.has(firstId)) || (secondId && !counts.has(secondId))) throw new Error('Choose cards that are in this deck.');
  if (firstId && secondId) {
    if (firstId === secondId) throw new Error('Choose two different card names for a pair.');
    combo = { firstId, secondId, probability: pairProbability(size, counts.get(firstId), counts.get(secondId), draws) };
  }
  return {
    deck, size, draws, cardRows, odds, combo, mechanics,
    curve: [...curve].sort(([a], [b]) => (Number.isFinite(Number(a)) ? Number(a) : Infinity) - (Number.isFinite(Number(b)) ? Number(b) : Infinity) || a.localeCompare(b, 'en')),
    costs: { fixedEnergyCards, averageEnergy: fixedEnergyCards ? fixedEnergy / fixedEnergyCards : null, starCards, xCards, unknownCosts },
    meta: index.meta, importedSnapshot: draft.snapshot || '',
    assumptions: draft.snapshot && draft.snapshot !== index.meta.source_commit
      ? ['This deck was saved against a different source snapshot. Results use the current pinned data; review changed card mechanics.'].concat(ANALYSIS_ASSUMPTIONS)
      : [...ANALYSIS_ASSUMPTIONS]
  };
}

export function percent(probability) { return (probability * 100).toFixed(1) + '%'; }

export function analyzePool(index, color) {
  if (!CHARACTER_COLORS.includes(color)) throw new Error('Choose a supported character pool.');
  const cards = index.cards.filter(card => card.color === color && ['Common', 'Uncommon', 'Rare'].includes(card.rarity));
  const report = analyzeDeck(index, { entries: cards.map(card => ({ id: card.id, count: 1 })) }, { draws: 0 });
  return {
    color, total: cards.length,
    rarities: Object.fromEntries(['Common', 'Uncommon', 'Rare'].map(rarity => [rarity, cards.filter(card => card.rarity === rarity).length])),
    zeroEnergy: cards.filter(card => card.cost === 0).length,
    zeroEnergyWithRecordedStars: cards.filter(card => card.cost === 0 && Number.isInteger(card.starCost) && card.starCost > 0).length,
    mechanics: report.mechanics, meta: index.meta
  };
}

export function deckMarkdown(index, report) {
  const safe = text => String(text ?? '').replace(/[\r\n|\[\]<>]/g, ' ').replace(/&/g, '&amp;');
  const link = id => '[[' + index.paths.get(id).replace(/\.md$/, '') + '|' + safe(index.byId.get(id).name) + ']]';
  const lines = ['# STS2 Stars deck analysis', '', 'Game data: ' + safe(report.meta.game_data_version) + ' · source commit: ' + safe(report.meta.source_commit), '', '## Deck', '', '| Card | Copies | Energy | Recorded Stars |', '| --- | ---: | --- | --- |'];
  for (const row of report.cardRows) lines.push('| ' + link(row.id) + (row.upgraded ? ' +' : '') + ' | ' + row.count + ' | ' + (row.costs.unplayable ? 'Unplayable' : costText(row.costs.energy)) + ' | ' + (row.costs.stars === undefined ? 'Not recorded' : costText(row.costs.stars)) + ' |');
  lines.push('', 'Relics: ' + (report.deck.relics.map(link).join(', ') || 'None entered.'), '', '## Uniform draw sample', '', 'Sample: ' + report.draws + ' cards from a ' + report.size + '-card deck, without replacement.', '', '| Card | Chance of at least one |', '| --- | ---: |');
  for (const item of report.odds) lines.push('| ' + link(item.id) + ' | ' + percent(item.probability) + ' |');
  if (report.combo) lines.push('', 'At least one of each: ' + link(report.combo.firstId) + ' + ' + link(report.combo.secondId) + ' → **' + percent(report.combo.probability) + '**. This measures drawing the pair, not being able to play it.');
  lines.push('', '## Detected mechanic coverage', '', 'Counts use base-card relationships. Upgrades change listed costs; upgrade-exclusive relationships may be absent.', '');
  for (const profile of report.mechanics) {
    lines.push('### ' + profile.label, '');
    for (const role of ['enablers', 'payoffs']) {
      lines.push('**' + (role === 'enablers' ? 'Enablers' : 'Uses / payoffs') + '**');
      for (const item of profile[role]) {
        lines.push('- ' + link(item.id) + ' ×' + item.copies + ': ' + [...new Set(item.evidence.map(e => safe(e.relation)))].join('; '));
        for (const evidence of item.evidence) if (evidence.source !== item.id) lines.push('  - Via granted power ' + link(evidence.source) + '.');
      }
      if (!profile[role].length) lines.push('- None detected among entered cards and relics.');
      lines.push('');
    }
  }
  if (!report.mechanics.length) lines.push('No supported mechanic roles detected among entered items.', '');
  lines.push('## Assumptions', '', ...report.assumptions.map(text => '- ' + text), '', 'Slay the Spire 2 by [Mega Crit](https://www.megacrit.com/). Unofficial fan project.', '');
  return lines.join('\n');
}
