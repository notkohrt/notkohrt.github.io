import test from 'node:test';
import assert from 'node:assert/strict';
import { drawProbability, pairProbability, createDeckIndex, analyzeDeck, analyzePool, normalizeDeck, readDeckDocument, deckMarkdown, MECHANIC_PROFILES, CHARACTER_COLORS, SILENT_EXAMPLE } from '../lib/deck-analysis.mjs';
import { cardCosts, upgradeFacts } from '../lib/card-facts.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';
import { validateModel } from '../lib/validate-model.mjs';
import { buildEdges, relationFamily } from '../lib/graph-model.mjs';
import { noteContent } from '../scripts/build-vault.mjs';

const snapshot = await loadSnapshot();
const { nodes, edges, errors } = validateModel(snapshot);
assert.deepEqual(errors, []);
const index = createDeckIndex(nodes, edges, snapshot.meta);
const deck = entries => ({ entries: entries.map(([id, count, upgraded = false]) => ({ id: 'card:' + id, count, upgraded })) });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, actual + ' ≠ ' + expected);

test('draw probabilities match exhaustive hands for every small deck, including multi-copy requirements', () => {
  for (let size = 0; size <= 8; size++) {
    for (let draws = 0; draws <= size; draws++) {
      const hands = [];
      for (let mask = 0; mask < 2 ** size; mask++) {
        const hand = Array.from({ length: size }, (_, i) => i).filter(i => mask & (1 << i));
        if (hand.length === draws) hands.push(hand);
      }
      for (let copies = 0; copies <= size; copies++) {
        for (let required = 0; required <= copies + 1; required++) {
          const hits = hands.filter(hand => hand.filter(i => i < copies).length >= required).length;
          close(drawProbability(size, copies, draws, required), hits / hands.length);
        }
        for (let second = 0; second <= size - copies; second++) {
          const pairs = hands.filter(hand => hand.some(i => i < copies) && hand.some(i => i >= copies && i < copies + second)).length;
          close(pairProbability(size, copies, second, draws), pairs / hands.length);
        }
      }
    }
  }
});

test('large decks remain finite and boundary probabilities are exact', () => {
  close(drawProbability(20, 1, 5), .25);
  close(drawProbability(20, 2, 5), 17 / 38);
  close(pairProbability(20, 1, 1, 5), 1 / 19);
  assert.equal(drawProbability(500, 500, 500), 1);
  assert.equal(drawProbability(500, 0, 500), 0);
  assert.equal(drawProbability(500, 1, 500), 1);
  close(drawProbability(500, 250, 250), 1);
  for (const args of [[-1, 1, 1], [10, 11, 1], [10, 1, 11], [10, 1, NaN], [10, 1, 1.5], [501, 1, 1]]) assert.throws(() => drawProbability(...args));
  assert.throws(() => pairProbability(10, 6, 6, 5), /disjoint/);
});

test('deck variants retain upgrade state but aggregate draw odds by card identity', () => {
  const report = analyzeDeck(index, deck([['DARK_EMBRACE', 1], ['DARK_EMBRACE', 1, true], ['STRIKE_IRONCLAD', 8]]), { draws: 5 });
  assert.equal(report.size, 10);
  assert.equal(report.odds.find(row => row.id === 'card:DARK_EMBRACE').copies, 2);
  close(report.odds.find(row => row.id === 'card:DARK_EMBRACE').probability, 7 / 9);
  assert.deepEqual(report.curve, [['1', 9], ['2', 1]]);
  assert.equal(report.mechanics.find(row => row.id === 'exhaust').payoffs[0].copies, 2);
  assert.throws(() => analyzeDeck(index, report.deck, { draws: 5, firstId: 'card:DARK_EMBRACE', secondId: 'card:DARK_EMBRACE' }), /different/);
});

test('normalization validates identities, quantities, bounds, formats, and relic types', () => {
  for (const invalid of [
    { entries: [{ id: 'power:POISON_POWER', count: 1 }] },
    deck([['MISSING', 1]]), deck([['SHIV', -1]]), deck([['SHIV', 1.5]]), deck([['SHIV', 100]]),
    { entries: [{ id: 'card:SHIV', count: 1, upgraded: 'false' }] },
    { relics: ['card:SHIV'] }, { entries: {} }, { entries: null }, { entries: false }, { relics: null }, { format: 'anything-else' }
  ]) assert.throws(() => normalizeDeck(index, invalid));
  const normalized = normalizeDeck(index, { ...deck([['SHIV', 1], ['SHIV', 2]]), relics: ['relic:TINGSHA', 'relic:TINGSHA'] });
  assert.equal(normalized.entries[0].count, 3);
  assert.equal(normalized.relics.length, 1);
  assert.throws(() => analyzeDeck(index, deck([['SHIV', 1]]), { draws: 2 }), /exceed/);
  assert.equal(analyzeDeck(index, deck([['SHIV', 1]]), { draws: 1, firstId: 'card:SHIV' }).combo, null);
});

test('portable documents validate sampling and partial combo settings consistently', () => {
  const draft = { ...deck([['SHIV', 1]]), draws: 5, combo: ['', 'card:SHIV'] };
  assert.deepEqual(readDeckDocument(index, draft).combo, ['', 'card:SHIV']);
  for (const mutate of [
    value => { value.combo = 'card:SHIV'; }, value => { value.combo = [null]; },
    value => { value.combo = ['card:SHIV', 'card:SHIV']; }, value => { value.combo = ['card:MISSING']; },
    value => { value.draws = '5'; }, value => { value.draws = -1; },
    value => { value.snapshot = 12; }, value => { value.snapshot = 'main'; }
  ]) { const invalid = structuredClone(draft); mutate(invalid); assert.throws(() => readDeckDocument(index, invalid)); }
});

test('mechanic coverage counts entered items, not edges or granted power duplicates', () => {
  const report = analyzeDeck(index, { ...deck([['BLADE_DANCE', 2], ['ACCURACY', 1], ['PREPARED', 1], ['TACTICIAN', 1]]), relics: ['relic:TINGSHA'] }, { draws: 3 });
  const shiv = report.mechanics.find(row => row.id === 'shiv');
  assert.equal(shiv.enablers.length, 1);
  assert.equal(shiv.enablers[0].copies, 2);
  assert.equal(shiv.payoffs.length, 1);
  assert.equal(shiv.payoffs[0].id, 'card:ACCURACY');
  assert.ok(shiv.payoffs[0].evidence.some(e => e.path.length === 2));
  const discard = report.mechanics.find(row => row.id === 'discard');
  assert.deepEqual(discard.enablers.map(row => row.id), ['card:PREPARED']);
  assert.deepEqual(discard.payoffs.map(row => row.id), ['card:TACTICIAN', 'relic:TINGSHA']);
  for (const profile of report.mechanics) for (const role of ['enablers', 'payoffs']) for (const item of profile[role]) {
    assert.ok(!item.id.startsWith('power:'));
    for (const evidence of item.evidence) assert.ok(edges.some(edge => edge.id === evidence.edgeId));
  }
});

test('ungranted power mentions, prevention, and property edges do not become producers', () => {
  const localNodes = [
    { id: 'card:A', type: 'card', name: 'A', cost: 1 },
    { id: 'power:P', type: 'power', name: 'P' },
    { id: 'effect:DISCARD', type: 'effect', name: 'Discard' }
  ];
  const make = (source, target, relation) => ({ id: [source, target, relation].join('|'), source, target, relation });
  const localIndex = createDeckIndex(localNodes, [make('card:A', 'power:P', 'requires'), make('power:P', 'effect:DISCARD', 'discards'), make('card:A', 'effect:DISCARD', 'prevents discard')]);
  assert.deepEqual(analyzeDeck(localIndex, { entries: [{ id: 'card:A', count: 1 }] }, { draws: 1 }).mechanics, []);
});

test('every class has a supported mechanic with grounded role evidence', () => {
  for (const [color, mechanic] of [['ironclad', 'exhaust'], ['silent', 'discard'], ['defect', 'orbs'], ['necrobinder', 'osty'], ['regent', 'forge']]) {
    const entries = index.cards.filter(c => c.color === color && ['Common', 'Uncommon', 'Rare'].includes(c.rarity)).map(c => ({ id: c.id, count: 1 }));
    const report = analyzeDeck(index, { entries }, { draws: 5 });
    assert.ok(report.mechanics.find(row => row.id === mechanic)?.enablers.length, color);
  }
  for (const profile of MECHANIC_PROFILES) for (const target of profile.targets) assert.ok(index.byId.has(target), target);
});

test('pool census excludes starter, token, Ancient, and event cards and separates Star costs', () => {
  for (const color of CHARACTER_COLORS) {
    const pool = analyzePool(index, color);
    assert.equal(pool.total, 82, color);
    assert.deepEqual(pool.rarities, { Common: 20, Uncommon: 36, Rare: 26 });
    for (const profile of pool.mechanics) for (const role of ['enablers', 'payoffs']) for (const item of profile[role]) {
      assert.equal(item.copies, 1);
      assert.equal(item.type, 'card');
      assert.equal(index.byId.get(item.id).color, color);
      assert.ok(['Common', 'Uncommon', 'Rare'].includes(index.byId.get(item.id).rarity));
    }
  }
  assert.equal(analyzePool(index, 'regent').zeroEnergy, 18);
  assert.equal(analyzePool(index, 'regent').zeroEnergyWithRecordedStars, 9);
  assert.equal(analyzePool(index, 'silent').mechanics.find(row => row.id === 'discard').enablers.length, 8);
  assert.throws(() => analyzePool(index, 'token'), /supported/);
  const example = analyzeDeck(index, SILENT_EXAMPLE, { draws: 5, firstId: 'card:BLADE_DANCE', secondId: 'card:ACCURACY' });
  assert.equal(example.size, 20);
  close(example.combo.probability, 11 / 114);
});

test('fixed Star charges survive normalization, analysis, and Obsidian generation', () => {
  const comet = index.byId.get('card:COMET');
  assert.equal(comet.starCost, 5);
  const report = analyzeDeck(index, deck([['COMET', 2], ['RESONANCE', 1]]), { draws: 1 });
  assert.equal(report.costs.starCards, 3);
  assert.equal(report.costs.averageEnergy, 1 / 3);
  assert.match(noteContent(comet, [], ''), /star_cost: 5/);
  assert.match(deckMarkdown(index, report), /\| 2 \| 0 \| 5 \|/);
  assert.equal(report.mechanics.find(row => row.id === 'stars').enablers.length, 0);
  assert.equal(report.mechanics.find(row => row.id === 'stars').payoffs.length, 2);
});

test('Star requirements come only from positive recorded costs and carry exact metadata evidence', () => {
  const requirements = edges.filter(edge => edge.relation === 'requires Stars');
  const charged = nodes.filter(node => Number.isInteger(node.starCost) && node.starCost > 0);
  assert.deepEqual(requirements.map(edge => edge.source).sort(), charged.map(node => node.id).sort());
  for (const edge of requirements) {
    assert.equal(edge.target, 'mechanic:STAR_COUNT');
    assert.equal(edge.provenance, 'explicit');
    assert.equal(edge.note, 'Printed cost: ' + index.byId.get(edge.source).starCost + ' Stars');
  }
  assert.equal(relationFamily('requires Stars'), 'requirement');
  const local = [{ id: 'mechanic:STAR_COUNT', type: 'mechanic', name: 'Stars' }];
  for (const cost of [undefined, null, 0, -1, '3', NaN]) local.push({ id: 'card:' + String(cost), sourceId: String(cost), type: 'card', name: 'Test ' + String(cost), starCost: cost, description: '' });
  assert.equal(buildEdges(local).filter(edge => edge.relation === 'requires Stars').length, 0);
});

test('cost upgrades are replacements everywhere, while numeric effect upgrades remain deltas', () => {
  const dark = index.byId.get('card:DARK_EMBRACE'), blade = index.byId.get('card:BLADE_DANCE');
  assert.deepEqual(upgradeFacts(dark).find(fact => fact.label === 'Energy cost'), { label: 'Energy cost', text: '2 → 1' });
  assert.equal(cardCosts(dark, true).energy, 1);
  assert.match(noteContent(dark, [], ''), /Energy cost: 2 → 1/);
  assert.equal(upgradeFacts(blade).find(fact => fact.label === 'cards').text, '+1');
  assert.ok(cardCosts(index.byId.get('card:AFTERIMAGE'), true).keywords.includes('Innate'));
  const unplayable = analyzeDeck(index, deck([['WOUND', 1]]), { draws: 1 });
  assert.equal(unplayable.costs.fixedEnergyCards, 0);
  assert.equal(unplayable.costs.averageEnergy, null);
});

test('Markdown exports retain source version, collision-safe note paths, evidence, and assumptions', () => {
  const report = analyzeDeck(index, deck([['BLADE_DANCE', 1], ['ACCURACY', 1]]), { draws: 1, firstId: 'card:BLADE_DANCE', secondId: 'card:ACCURACY' });
  const markdown = deckMarkdown(index, report);
  assert.match(markdown, /source commit: 4e6b0e/);
  assert.match(markdown, /\[\[Cards\/Blade Dance\|Blade Dance\]\]/);
  assert.match(markdown, /Via granted power \[\[Powers\/Accuracy\|Accuracy\]\]/);
  assert.match(markdown, /\*\*0.0%\*\*/);
  assert.match(markdown, /Innate/);
  assert.match(markdown, /Mega Crit/);
  assert.equal(deckMarkdown(index, report), markdown);
});
