import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEdges, normalizeData, inferRelations, relationFamily, createNodePaths, SEMANTIC_OVERRIDES } from '../lib/graph-model.mjs';
import { validateModel } from '../lib/validate-model.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';

const snapshot = await loadSnapshot();
const nodes = normalizeData(snapshot.raw);
const edges = buildEdges(nodes, snapshot.manualLinks, snapshot.raw.cardPowers);
const relations = (source, target) => edges.filter(edge => edge.source === source && edge.target === target).map(edge => edge.relation).sort();

for (const [text, target, expected] of [
  ['Whenever you apply Poison, gain 1 Strength.', 'Poison', ['triggers on']],
  ['Whenever you apply Poison, gain 1 Strength.', 'Strength', ['grants']],
  ['If the enemy has Poison, apply 9 Poison.', 'Poison', ['requires', 'applies']],
  ['Whenever you apply Poison, apply an additional 1 Poison.', 'Poison', ['triggers on', 'applies']],
  ['Lose 1 Strength and gain 1 Dexterity.', 'Dexterity', ['grants']],
  ['Gain 1 Strength and lose 1 Dexterity.', 'Dexterity', ['reduces']],
  ['Gain 1 Strength and 1 Dexterity.', 'Dexterity', ['grants']],
  ['You can no longer gain Gold.', 'Gold', ['prevents gain']],
  ['Cannot apply Poison.', 'Poison', ['prevents apply']],
  ['Poison is triggered an additional time.', 'Poison', ['triggers']],
  ['Weak enemies take double damage from Attacks.', 'Weak', ['modifies']],
  ['The next topic is Poison.', 'Poison', ['references']],
  ['Gain 1 Strength. Poison is interesting.', 'Poison', ['references']],
  ['Gain 1 Strength\nPoison is interesting.', 'Poison', ['references']],
  ['A poisonous brew.', 'Poison', []]
]) {
  test('mention semantics: ' + text + ' [' + target + ']', () => assert.deepEqual(inferRelations(text, target), expected));
}

for (const [relation, expected] of [
  ['triggers on card creation', 'trigger'], ['triggers on Doom application', 'trigger'],
  ['requires Doom application', 'requirement'], ['scales with Max HP', 'scaling'],
  ['scales with cards created', 'scaling'], ['copies Colorless card', 'creation'],
  ['creates on first Forge', 'creation'], ['increases damage vs Vulnerable', 'modification'],
  ['increases Max HP', 'application'], ['prevents gain', 'modification'],
  ['moves to Hand', 'movement'], ['self-exhausts', 'resource']
]) {
  test('relationship family: ' + relation, () => assert.equal(relationFamily(relation), expected));
}

for (const [source, target, expected] of [
  ['card:CORROSIVE_WAVE', 'power:POISON_POWER', ['applies']],
  ['card:RUPTURE', 'power:STRENGTH_POWER', ['grants']],
  ['card:RUPTURE', 'effect:LOSE_HP', ['triggers on HP loss']],
  ['card:GO_FOR_THE_EYES', 'power:WEAK_POWER', ['applies']],
  ['card:OBLIVION', 'power:DOOM_POWER', ['applies']],
  ['card:ARSENAL', 'power:STRENGTH_POWER', ['grants']],
  ['card:BUBBLE_BUBBLE', 'power:POISON_POWER', ['applies', 'requires']],
  ['card:RESONANCE', 'power:STRENGTH_POWER', ['grants', 'reduces']],
  ['card:HANG', 'power:HANG_POWER', ['applies']],
  ['card:GUARDS', 'card:MINION_SACRIFICE', ['transforms']],
  ['card:GUARDS', 'card:SACRIFICE', []],
  ['relic:ECTOPLASM', 'mechanic:MONEY_POUCH', ['prevents gain']],
  ['relic:SNECKO_SKULL', 'power:POISON_POWER', ['applies', 'triggers on']],
  ['power:TENDER_POWER', 'power:STRENGTH_POWER', ['reduces']],
  ['power:TENDER_POWER', 'power:DEXTERITY_POWER', ['reduces']],
  ['potion:FLEX_POTION', 'power:STRENGTH_POWER', ['grants', 'reduces']],
  ['enchantment:TEZCATARAS_EMBER', 'keyword:ETERNAL', ['grants']]
]) {
  test('pinned regression: ' + source + ' → ' + target, () => assert.deepEqual(relations(source, target), expected));
}

test('every character override replaces inferred roles exactly', () => {
  for (const [source, target, expected] of SEMANTIC_OVERRIDES) {
    assert.deepEqual(relations(source, target), [...expected].sort(), source + ' → ' + target);
    assert.ok(edges.filter(edge => edge.source === source && edge.target === target).every(edge => edge.provenance === 'curated'));
  }
});

test('snapshot graph is deterministic, connected only through valid endpoints, and avoids bare mentions/hubs', () => {
  const result = validateModel(snapshot);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.edges, edges);
  assert.deepEqual(buildEdges(normalizeData(snapshot.raw), snapshot.manualLinks, snapshot.raw.cardPowers), edges);
  assert.ok(edges.length > 1500);
});

test('unresolved upstream mapping hints are reported and never emitted', () => {
  const result = validateModel(snapshot);
  const ids = new Set(nodes.map(node => node.id));
  assert.ok(result.unresolvedCardPowers.length > 0);
  for (const hint of result.unresolvedCardPowers) {
    assert.ok(!ids.has(hint.source) || !ids.has(hint.target));
    assert.ok(!edges.some(edge => edge.source === hint.source && edge.target === hint.target));
  }
});

test('duplicate IDs, unknown manual endpoints, and unpinned metadata fail validation', () => {
  for (const mutate of [
    value => value.raw.card.push(value.raw.card[0]),
    value => value.manualLinks.push({ source: 'card:SHIV', target: 'card:NONEXISTENT', relation: 'creates' }),
    value => { value.meta.source_commit = 'main'; },
    value => { value.raw.cardPowers.SHIV = [{ id: null }]; },
    value => { value.raw.card[0] = null; },
    value => { value.manualLinks.push(null); }
  ]) {
    const value = structuredClone(snapshot);
    mutate(value);
    assert.ok(validateModel(value).errors.length > 0);
  }
});

test('manual links require meaningful mechanical verbs', () => {
  for (const relation of ['', 'references', 'related', 'synergizes with', 42]) {
    const value = structuredClone(snapshot);
    value.manualLinks.push({ source: 'card:SHIV', target: 'power:STRENGTH_POWER', relation });
    assert.ok(validateModel(value).errors.some(error => error.includes('mechanical relation')));
  }
});

test('vault paths disambiguate duplicate names and are shared with the inspector', () => {
  const paths = createNodePaths(nodes);
  assert.equal(paths.size, nodes.length);
  assert.equal(new Set(paths.values()).size, nodes.length);
  assert.equal(paths.get('card:SHIV'), 'Cards/Shiv.md');
  const duplicated = nodes.filter(node => node.type === 'card' && node.name === 'Defend');
  assert.ok(duplicated.length > 1);
  for (const node of duplicated) assert.ok(paths.get(node.id).includes('[' + node.sourceId + ']'));
});
