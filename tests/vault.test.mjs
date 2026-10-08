import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';
import { normalizeData, buildEdges, createNodePaths } from '../lib/graph-model.mjs';

const snapshot = await loadSnapshot();
const nodes = normalizeData(snapshot.raw), paths = createNodePaths(nodes);
const edges = buildEdges(nodes, [], snapshot.raw.cardPowers);
const generator = fileURLToPath(new URL('../scripts/build-vault.mjs', import.meta.url));

test('vault output matches all website relationships, preserves curated text, and regenerates deterministically', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'sts2-vault-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(path.join(output, 'vault/Cards'), { recursive: true });
  const shivFile = path.join(output, 'vault', paths.get('card:SHIV'));
  const curated = '- scales with [[Powers/Strength|Strength]]\nA human-authored explanation.';
  await writeFile(shivFile, '<!-- CURATED START -->\n' + curated + '\n<!-- CURATED END -->');
  const run = () => execFileSync(process.execPath, [generator, '--output', output], { cwd: tmpdir(), encoding: 'utf8' });
  run();
  const content = new Map(await Promise.all(nodes.map(async node => [node.id, await readFile(path.join(output, 'vault', paths.get(node.id)), 'utf8')])));
  for (const node of nodes) {
    const expected = edges.filter(edge => edge.source === node.id).map(edge =>
      '- ' + edge.relation + ' [[' + paths.get(edge.target).replace(/\.md$/, '') + '|' + nodes.find(target => target.id === edge.target).name + ']]  <!-- ' + edge.provenance + ' -->');
    const section = content.get(node.id).split('## Detected relationships\n\n')[1].split('\n\n## Curated relationships')[0];
    assert.deepEqual(section.split('\n').filter(line => line.startsWith('- ')), expected, node.id);
    assert.ok(content.get(node.id).includes('[Mega Crit](https://www.megacrit.com/)'), 'Missing game credit: ' + node.id);
  }
  const manual = JSON.parse(await readFile(path.join(output, 'data/manual-links.json'), 'utf8'));
  assert.ok(manual.some(link => link.source === 'card:SHIV' && link.target === 'power:STRENGTH_POWER' && link.relation === 'scales with'));
  assert.ok(content.get('card:SHIV').includes(curated));
  run();
  for (const node of nodes) assert.equal(await readFile(path.join(output, 'vault', paths.get(node.id)), 'utf8'), content.get(node.id), node.id);
});

test('invalid curated links fail before rewriting authored notes or exports', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'sts2-vault-invalid-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(path.join(output, 'vault/Cards'), { recursive: true });
  await mkdir(path.join(output, 'data'), { recursive: true });
  const file = path.join(output, 'vault/Cards/Shiv.md');
  const text = '<!-- CURATED START -->\n- modifies [[Cards/Missing]]\n<!-- CURATED END -->';
  await writeFile(file, text);
  await writeFile(path.join(output, 'data/manual-links.json'), '[]\n');
  const result = spawnSync(process.execPath, [generator, '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid curated target/);
  assert.equal(await readFile(file, 'utf8'), text);
  assert.equal(await readFile(path.join(output, 'data/manual-links.json'), 'utf8'), '[]\n');
});

test('vague curated verbs are rejected before generation by the shared website policy', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'sts2-vault-policy-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(path.join(output, 'vault/Cards'), { recursive: true });
  await mkdir(path.join(output, 'data'), { recursive: true });
  const file = path.join(output, 'vault/Cards/Shiv.md');
  const manual = path.join(output, 'data/manual-links.json');
  await writeFile(manual, '[]\n');
  for (const relation of ['references', 'interacts with', 'uses Stars']) {
    const text = '<!-- CURATED START -->\n- ' + relation + ' [[Powers/Strength]]\n<!-- CURATED END -->';
    await writeFile(file, text);
    const result = spawnSync(process.execPath, [generator, '--output', output], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /specific mechanical relation/);
    assert.equal(await readFile(file, 'utf8'), text);
    assert.equal(await readFile(manual, 'utf8'), '[]\n');
  }
});
