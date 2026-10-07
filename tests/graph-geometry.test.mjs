import test from 'node:test';
import assert from 'node:assert/strict';
import { assignEdgeLanes, edgeGeometry, uniqueLayoutLinks } from '../lib/graph-geometry.mjs';

const a = { id: 'a', x: 0, y: 0, radius: 8 }, b = { id: 'b', x: 100, y: 0, radius: 10 };
const edge = (id, source = 'a', target = 'b') => ({ id, source, target });

test('layout has one stable spring per pair regardless of parallel or reciprocal roles', () => {
  const single = uniqueLayoutLinks([edge('applies')]);
  const repeated = uniqueLayoutLinks([edge('requires'), edge('applies'), edge('reverse', 'b', 'a')]);
  assert.deepEqual(single, [{ source: 'a', target: 'b' }]);
  assert.deepEqual(repeated, single);
  assert.deepEqual(uniqueLayoutLinks([edge('bc', 'b', 'c'), ...[edge('ab'), edge('ba', 'b', 'a')]]), [
    { source: 'a', target: 'b' }, { source: 'b', target: 'c' }
  ]);
});

test('single edges stay straight, clipped outside each node, with an arrow toward the target', () => {
  const lanes = assignEdgeLanes([edge('a|b|grants')]);
  const geometry = edgeGeometry(a, b, lanes.get('a|b|grants'));
  assert.equal(geometry.start.x, 9);
  assert.equal(geometry.end.x, 88);
  assert.equal(geometry.control.y, 0);
  assert.deepEqual(geometry.tangent, { x: 1, y: 0 });
});

test('parallel and reciprocal edges occupy distinct stable physical lanes', () => {
  const edges = [edge('applies'), edge('requires'), edge('reverse', 'b', 'a')];
  const lanes = assignEdgeLanes(edges);
  assert.deepEqual([...assignEdgeLanes([...edges].reverse())], [...lanes]);
  const geometries = edges.map(item => edgeGeometry(item.source === 'a' ? a : b, item.target === 'b' ? b : a, lanes.get(item.id)));
  assert.equal(new Set(geometries.map(item => item.control.y)).size, 3);
  assert.ok(geometries[2].tangent.x < 0);
});

test('curved endpoints clip by radius and arrows follow the curve tangent', () => {
  const geometry = edgeGeometry(a, b, 22);
  assert.ok(Math.abs(Math.hypot(geometry.start.x - a.x, geometry.start.y - a.y) - 9) < 1e-9);
  assert.ok(Math.abs(Math.hypot(geometry.end.x - b.x, geometry.end.y - b.y) - 12) < 1e-9);
  assert.ok(geometry.midpoint.y > 0);
  assert.ok(geometry.tangent.y < 0);
  assert.ok(Math.abs(Math.hypot(geometry.tangent.x, geometry.tangent.y) - 1) < 1e-9);
});

test('short or uninitialized edges cannot produce invalid drawing coordinates', () => {
  assert.equal(edgeGeometry(a, { ...b, x: 0, y: 0 }), null);
  assert.equal(edgeGeometry(a, { ...b, y: NaN }), null);
  assert.equal(edgeGeometry(a, b, Infinity), null);
  const geometry = edgeGeometry(a, { ...b, x: 2 }, 200);
  assert.ok(JSON.stringify(geometry).indexOf('null') === -1);
  assert.ok(geometry.start.x < geometry.end.x);
});
