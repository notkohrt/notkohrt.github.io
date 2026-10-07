import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEdges, normalizeData, inferRelations, inferEffectRelations, relationFamily, createNodePaths, SEMANTIC_OVERRIDES, RELATION_FAMILIES } from '../lib/graph-model.mjs';
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
  ['This card applies 1 Weak.', 'Weak', ['applies']],
  ['This enemy is applying 1 Poison.', 'Poison', ['applies']],
  ['You cannot lose Strength and gain 1 Dexterity.', 'Dexterity', ['grants']],
  ['Whenever this enemy gains Strength, draw 1 card.', 'Strength', ['triggers on']],
  ['Poison is triggered an additional time.', 'Poison', ['triggers']],
  ['Weak enemies take double damage from Attacks.', 'Weak', ['modifies']],
  ['The next topic is Poison.', 'Poison', ['references']],
  ['Gain 1 Strength. Poison is interesting.', 'Poison', ['references']],
  ['Gain 1 Strength\nPoison is interesting.', 'Poison', ['references']],
  ['A poisonous brew.', 'Poison', []]
]) {
  test('mention semantics: ' + text + ' [' + target + ']', () => assert.deepEqual(inferRelations(text, target), expected));
}

for (const [effect, text, expected] of [
  ['DRAW', 'Whenever you apply Vulnerable, draw 1 card.', ['draws']],
  ['DRAW', 'Whenever a card is Exhausted,\ndraw 1 card.', ['draws']],
  ['DRAW', 'Whenever you draw an Ethereal card, draw 1 card.', ['triggers on draw', 'draws']],
  ['DRAW', 'Draw 1 card. If you draw a Skill, gain 3 Block.', ['draws', 'requires draw']],
  ['DRAW', 'The first time you\ndraw a Status, draw 2 cards.', ['triggers on draw', 'draws']],
  ['EXHAUST_CARD', 'Whenever you play a Skill, Exhaust it.', ['exhausts cards']],
  ['EXHAUST_CARD', 'Exhaust your Hand. If 9 cards were Exhausted, gain 1 Intangible.', ['exhausts cards', 'requires exhaust']],
  ['LOSE_HP', 'If this is in your Hand, lose 13 HP.', ['loses HP']],
  ['LOSE_HP', 'Whenever Osty loses HP, ALL enemies lose that much HP.', ['triggers on HP loss', 'loses HP']],
  ['LOSE_HP', 'Whenever you would lose HP, lose 1 less.', ['triggers on HP loss', 'modifies HP loss']],
  ['LOSE_HP', 'You cannot lose more than 20 HP in a turn.', ['limits HP loss']],
  ['LOSE_HP', 'You cannot lose HP.', ['prevents HP loss']],
  ['PLAY_CARD', 'Whenever you draw a Strike, it is played against a random enemy.', ['plays cards automatically']],
  ['PLAY_CARD', 'Reduce its cost until it is played.', ['plays cards']],
  ['PLAY_CARD', 'If you did not play any Attacks, gain Energy.', ['requires no Attack play']],
  ['PLAY_CARD', 'Every 4 cards you play, draw 1 card.', ['triggers on card play']],
  ['CREATE_CARD', 'Whenever you create a Status, reduce this card\'s cost.', ['triggers on card creation']],
  ['CREATE_CARD', 'Add a random Attack, Skill, and Power into your Hand.', ['creates']],
  ['COST_CHANGE', 'The costs of your cards are randomized on draw, from 0 to 3.', ['modifies cost']],
  ['DAMAGE', 'Take double damage from enemies. Allies take half damage.', ['modifies damage']],
  ['SHUFFLE', 'Whenever you shuffle your Draw Pile, gain 6 Block.', ['triggers on shuffle']],
  ['SHUFFLE', 'Shuffle a Wound into your Discard Pile each time you take damage.', ['shuffles']],
  ['CHANNEL', 'The first time you Channel 7 Orbs, deal 30 damage.', ['triggers on channel']],
  ['CHANNEL', 'Deal 5 damage for each Channeled Orb.', []],
  ['EVOKE', 'Whenever you Evoke Lightning, deal 6 damage.', ['triggers on evoke']],
  ['UPGRADE', 'Whenever you add a Power, Upgrade it.', ['upgrades']],
  ['UPGRADE', 'Whenever a card is Upgraded, gain Block.', ['triggers on upgrade']],
  ['DISCARD', 'Instead this potion is discarded and you heal to 30% of your Max HP.', []],
  ['DISCARD', 'Discard all your cards and draw 5 cards.', ['discards']]
]) {
  test('effect clause semantics: ' + effect + ' [' + text + ']', () => assert.deepEqual(inferEffectRelations(effect, text), expected));
}

for (const [relation, expected] of [
  ['triggers on card creation', 'trigger'], ['triggers on Doom application', 'trigger'],
  ['requires Doom application', 'requirement'], ['scales with Max HP', 'scaling'],
  ['scales with cards created', 'scaling'], ['copies Colorless card', 'creation'],
  ['creates on first Forge', 'creation'], ['increases damage vs Vulnerable', 'modification'],
  ['increases Max HP', 'application'], ['prevents gain', 'modification'],
  ['moves to Hand', 'movement'], ['self-exhausts', 'resource'],
  ['limits HP loss', 'modification'], ['requires no Attack play', 'requirement'],
  ['plays cards automatically', 'movement'], ['plays drawn cards', 'movement'],
  ['modifies next card play', 'modification'], ['loses HP', 'resource'],
  ['has keyword', 'property'], ['has tag', 'property'], ['shuffles', 'movement'],
  ['upgrades', 'modification'], ['takes damage', 'resource'], ['sacrifices', 'resource'],
  ['kills at Doom ≥ HP', 'resource']
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
  ['enchantment:TEZCATARAS_EMBER', 'keyword:ETERNAL', ['grants']],
  ['card:VICIOUS', 'effect:DRAW', ['draws']],
  ['power:VICIOUS_POWER', 'effect:DRAW', ['draws']],
  ['card:PAGESTORM', 'effect:DRAW', ['draws', 'triggers on draw']],
  ['card:ITERATION', 'effect:DRAW', ['draws', 'triggers on draw']],
  ['card:EXPECT_A_FIGHT', 'mechanic:ENERGY', ['grants', 'prevents gain']],
  ['card:PANIC_BUTTON', 'mechanic:BLOCK', ['grants', 'prevents gain']],
  ['card:BAD_LUCK', 'effect:LOSE_HP', ['loses HP']],
  ['card:RUPTURE', 'mechanic:HIT_POINTS', ['triggers on HP loss']],
  ['card:LIFT', 'mechanic:BLOCK', ['grants']],
  ['card:FETCH', 'effect:PLAY_CARD', ['requires card play']],
  ['card:ROCKET_PUNCH', 'effect:CREATE_CARD', ['triggers on card creation']],
  ['relic:GAME_PIECE', 'effect:DRAW', ['draws']],
  ['relic:GREMLIN_HORN', 'effect:DRAW', ['draws']],
  ['relic:POCKETWATCH', 'effect:DRAW', ['draws']],
  ['relic:UNCEASING_TOP', 'effect:DRAW', ['draws']],
  ['relic:PAELS_EYE', 'effect:EXHAUST_CARD', ['exhausts cards']],
  ['relic:ANCHOR', 'mechanic:BLOCK', ['grants']],
  ['relic:ORICHALCUM', 'mechanic:BLOCK', ['grants', 'requires no Block']],
  ['relic:FRESNEL_LENS', 'mechanic:BLOCK', ['triggers on adding Block cards']],
  ['relic:TUNGSTEN_ROD', 'effect:LOSE_HP', ['modifies HP loss', 'triggers on HP loss']],
  ['relic:BEATING_REMNANT', 'effect:LOSE_HP', ['limits HP loss']],
  ['power:NO_BLOCK_POWER', 'mechanic:BLOCK', ['prevents gain']],
  ['power:NO_ENERGY_GAIN_POWER', 'mechanic:ENERGY', ['prevents gain']],
  ['power:JUGGERNAUT_POWER', 'mechanic:BLOCK', ['triggers on Block gain']],
  ['power:DARK_EMBRACE_POWER', 'effect:DRAW', ['draws']],
  ['power:CORRUPTION_POWER', 'effect:EXHAUST_CARD', ['exhausts cards']],
  ['power:NECRO_MASTERY_POWER', 'effect:LOSE_HP', ['loses HP', 'triggers on HP loss']],
  ['power:HELLRAISER_POWER', 'effect:PLAY_CARD', ['plays cards automatically']],
  ['power:CONFUSED_POWER', 'effect:COST_CHANGE', ['modifies cost']],
  ['potion:OROBIC_ACID', 'effect:CREATE_CARD', []],
  ['enchantment:IMBUED', 'effect:PLAY_CARD', ['plays cards automatically']],
  ['enchantment:SLUMBERING_ESSENCE', 'effect:PLAY_CARD', []],
  ['enchantment:INKY', 'power:WEAK_POWER', ['applies']],
  ['card:STRATAGEM', 'effect:SHUFFLE', ['triggers on shuffle']],
  ['power:STRATAGEM_POWER', 'effect:SHUFFLE', ['triggers on shuffle']],
  ['relic:THE_ABACUS', 'effect:SHUFFLE', ['triggers on shuffle']],
  ['relic:METRONOME', 'effect:CHANNEL', ['triggers on channel']],
  ['card:THUNDER', 'effect:EVOKE', ['triggers on evoke']],
  ['power:THUNDER_POWER', 'effect:EVOKE', ['triggers on evoke']],
  ['power:THUNDER_POWER', 'mechanic:LIGHTNING', ['triggers on Evoke']],
  ['card:STORM', 'mechanic:LIGHTNING', ['channels']],
  ['power:STORM_POWER', 'mechanic:LIGHTNING', ['channels']],
  ['relic:MOLTEN_EGG', 'effect:UPGRADE', ['upgrades']],
  ['card:BARRAGE', 'effect:CHANNEL', []],
  ['mechanic:ORB_SLOTS', 'effect:CHANNEL', []],
  ['mechanic:ORB_SLOTS', 'mechanic:ORB_SYSTEM', ['sets capacity']],
  ['potion:FAIRY_IN_A_BOTTLE', 'effect:DISCARD', []],
  ['potion:FAIRY_IN_A_BOTTLE', 'effect:HEAL', ['heals']],
  ['card:RAGE', 'mechanic:CARD_TYPE_ATTACK', ['triggers on Attack play']],
  ['card:CALAMITY', 'mechanic:CARD_TYPE_ATTACK', ['creates', 'triggers on Attack play']],
  ['card:CORRUPTION', 'mechanic:CARD_TYPE_SKILL', ['exhausts Skills on play', 'modifies Skill cost']],
  ['card:AFTERLIFE', 'mechanic:SUMMON', ['summons / strengthens Osty']],
  ['card:FETCH', 'mechanic:OSTY', ['commands attack']],
  ['card:VENERATE', 'mechanic:STAR_COUNT', ['gains Stars']],
  ['card:BLACK_HOLE', 'mechanic:STAR_COUNT', ['triggers on Stars']],
  ['card:BEAT_INTO_SHAPE', 'mechanic:FORGE', ['forges']],
  ['power:DIE_FOR_YOU_POWER', 'mechanic:OSTY', ['absorbs damage']],
  ['power:NECRO_MASTERY_POWER', 'mechanic:OSTY', ['triggers on HP loss']],
  ['potion:STAR_POTION', 'mechanic:STAR_COUNT', ['gains Stars']],
  ['potion:SOLDIERS_STEW', 'mechanic:REPLAY', ['grants Replay']],
  ['potion:OROBIC_ACID', 'mechanic:CARD_TYPE_ATTACK', ['creates']],
  ['potion:OROBIC_ACID', 'mechanic:CARD_TYPE_SKILL', ['creates']],
  ['potion:OROBIC_ACID', 'mechanic:CARD_TYPE_POWER', ['creates']],
  ['enchantment:SPIRAL', 'mechanic:REPLAY', ['grants Replay']],
  ['mechanic:OSTY', 'mechanic:SUMMON', []],
  ['potion:ESSENCE_OF_DARKNESS', 'mechanic:ORB_SYSTEM', []],
  ['potion:ESSENCE_OF_DARKNESS', 'mechanic:ORB_SLOTS', ['scales with Orb Slots']]
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

test('all automatically generated snapshot roles have a specific, shared visualization family', () => {
  for (const edge of buildEdges(nodes, [], snapshot.raw.cardPowers)) {
    const family = relationFamily(edge.relation);
    assert.notEqual(family, 'other', edge.id);
    assert.ok(RELATION_FAMILIES[family], edge.id);
  }
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
  for (const relation of ['', 'references', 'related', 'related with', 'synergizes with', 'interacts with', 'uses Stars', 'uses keyword', 42]) {
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
