import test from 'node:test';
import assert from 'node:assert/strict';
import { indexRelations, selectRelations } from '../lib/inspector-model.mjs';
import { RELATION_FAMILIES } from '../lib/graph-model.mjs';
import { validateModel } from '../lib/validate-model.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';

const { nodes, edges, errors } = validateModel(await loadSnapshot());
assert.deepEqual(errors, []);
const byId = new Map(nodes.map(node => [node.id, node]));
const backlinks = id => indexRelations(edges.filter(edge => edge.target === id), byId, 'incoming');

test('every pinned entity retains every directed role through inspector indexing and family selection', () => {
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  const incoming = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  }
  for (const node of nodes) {
    for (const [direction, adjacency] of [['incoming', incoming], ['outgoing', outgoing]]) {
      const original = adjacency.get(node.id);
      const index = indexRelations(original, byId, direction);
      for (const sort of ['name', 'relation']) {
        const { items, total, familyCounts } = selectRelations(index, { sort });
        assert.equal(total, original.length, node.id);
        assert.deepEqual(new Set(items.map(item => item.edge.id)), new Set(original.map(edge => edge.id)), node.id);
        assert.equal([...familyCounts.values()].reduce((sum, count) => sum + count, 0), total);
      }
      const selected = Object.keys(RELATION_FAMILIES).flatMap(family => selectRelations(index, { family }).items);
      assert.deepEqual(new Set(selected.map(item => item.edge.id)), new Set(original.map(edge => edge.id)), node.id);
      assert.equal(selected.length, original.length, 'Families must not duplicate or merge roles: ' + node.id);
    }
  }
});

test('search reaches late backlinks and combines character, type, and mechanic terms for all five characters', () => {
  const index = backlinks('mechanic:BLOCK');
  assert.ok(index.length > 150);
  const late = selectRelations(index, { query: 'vitruvian regent modifies' });
  assert.deepEqual(late.items.map(item => item.edge.id), ['relic:VITRUVIAN_MINION|mechanic:BLOCK|modifies']);
  for (const color of ['ironclad', 'silent', 'regent', 'necrobinder', 'defect']) {
    const result = selectRelations(index, { query: '  ' + color.toUpperCase() + '\nCARDS grants ', family: 'application' });
    const expected = index.filter(item => item.node.color === color && item.node.type === 'card' && item.edge.relation === 'grants');
    assert.ok(expected.length, color);
    assert.deepEqual(new Set(result.items.map(item => item.edge.id)), new Set(expected.map(item => item.edge.id)), color);
  }
});

test('parallel roles can be selected independently without changing the index or creating description mentions', () => {
  const index = indexRelations(edges.filter(edge => edge.source === 'card:RESONANCE'), byId, 'outgoing');
  const before = structuredClone(index);
  assert.deepEqual(selectRelations(index, { query: 'strength' }).items.map(item => item.edge.relation), ['grants', 'reduces']);
  assert.deepEqual(selectRelations(index, { query: 'strength', family: 'modification' }).items.map(item => item.edge.relation), ['reduces']);
  assert.deepEqual(selectRelations(index, { query: 'unknown mechanic' }).items, []);
  // Strength's description mentions Attack damage, but Resonance has no such edge.
  assert.deepEqual(selectRelations(index, { query: 'attack damage' }).items, []);
  assert.deepEqual(index, before);
});

test('family counts follow search matches and stay independent of the selected family', () => {
  const index = indexRelations(edges.filter(edge => edge.source === 'card:RESONANCE'), byId, 'outgoing');
  const all = selectRelations(index, { query: 'strength' });
  const modified = selectRelations(index, { query: 'strength', family: 'modification' });
  assert.equal(all.queryTotal, 2);
  assert.equal(modified.queryTotal, 2);
  assert.equal(modified.items.length, 1);
  assert.deepEqual(modified.familyCounts, all.familyCounts);
  assert.equal(all.familyCounts.get('application'), 1);
  assert.equal(all.familyCounts.get('modification'), 1);
  const grant = selectRelations(index, { query: 'strength grants' });
  assert.equal(grant.queryTotal, 1);
  assert.deepEqual([...grant.familyCounts], [['application', 1]]);
  const empty = selectRelations(index, { query: 'unknown mechanic' });
  assert.equal(empty.queryTotal, 0);
  assert.equal(empty.familyCounts.size, 0);
  assert.equal(empty.total, index.length);
});

test('Unicode names and duplicate names are searchable and sort deterministically', () => {
  const targets = new Map([
    ['power:a', { id: 'power:a', name: 'Élan', type: 'power' }],
    ['power:b', { id: 'power:b', name: 'Élan', type: 'power' }]
  ]);
  const index = indexRelations(['b', 'a'].map(id => ({ id, source: 'card:x', target: 'power:' + id, relation: 'grants', provenance: 'derived' })), targets, 'outgoing');
  assert.deepEqual(selectRelations(index, { query: 'elan derived' }).items.map(item => item.edge.id), ['a', 'b']);
  assert.deepEqual(selectRelations(index, { query: '"<script>' }).items, []);
});
