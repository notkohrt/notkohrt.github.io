import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, mkdir, rename, readdir, rm } from 'node:fs/promises';
import { tmpdir, hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SOURCES } from '../lib/graph-model.mjs';
import { refreshSnapshot, recoverSnapshot } from '../lib/snapshot-update.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const snapshot = await loadSnapshot();
const newSha = 'a'.repeat(40);
const payload = Object.fromEntries(Object.entries(SOURCES).map(([key, source]) => [path.basename(source), JSON.stringify(snapshot.raw[key])]));
payload['changelog.json'] = JSON.stringify([{ version: snapshot.meta.game_data_version, date: snapshot.meta.game_data_date }]);

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'sts2-update space-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(repo, 'data'), path.join(root, 'data'), { recursive: true });
  return root;
}

function upstream({ sha = newSha, overrides = {}, calls = [] } = {}) {
  return async url => {
    calls.push(url);
    if (url.endsWith('/git/ref/heads/main')) return new Response(JSON.stringify({ object: { sha } }));
    assert.ok(url.includes('/' + sha + '/data/sts2/'), 'All downloads must use the resolved commit.');
    const file = url.split('/').at(-1);
    if (overrides[file] instanceof Error) throw overrides[file];
    return new Response(overrides[file] ?? payload[file], { status: overrides[file] === 'unavailable' ? 503 : 200 });
  };
}

async function bytes(root) {
  const directory = path.join(root, 'data/sts2');
  return Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async file => [file, await readFile(path.join(directory, file), 'utf8')])));
}

test('a validated refresh installs every pinned file together and preserves authored links', async t => {
  const root = await fixture(t), calls = [];
  const manual = await readFile(path.join(root, 'data/manual-links.json'), 'utf8');
  const result = await refreshSnapshot({ root, fetchImpl: upstream({ calls }), date: new Date('2026-10-10T12:00:00Z') });
  assert.equal(result.changed, true);
  assert.equal(result.nodes, 1250);
  const updated = await loadSnapshot(root);
  assert.equal(updated.meta.source_commit, newSha);
  assert.equal(updated.meta.snapshot_date, '2026-10-10');
  assert.deepEqual(updated.raw, snapshot.raw);
  assert.equal(await readFile(path.join(root, 'data/manual-links.json'), 'utf8'), manual);
  assert.equal(calls.length, 10);
  assert.ok(!(await readdir(path.join(root, 'data'))).includes('.sts2-update'));
});

test('an unchanged commit preserves every byte and snapshot date without fetching mutable files', async t => {
  const root = await fixture(t), before = await bytes(root), calls = [];
  const result = await refreshSnapshot({ root, fetchImpl: upstream({ sha: snapshot.meta.source_commit, calls }), date: new Date('2030-01-01T00:00:00Z') });
  assert.equal(result.changed, false);
  assert.deepEqual(await bytes(root), before);
  assert.equal(calls.length, 1);
});

for (const [label, options, message] of [
  ['network failure', { overrides: { 'powers.json': new Error('Network disconnected') } }, /Network disconnected/],
  ['HTTP failure', { overrides: { 'powers.json': 'unavailable' } }, /503/],
  ['invalid JSON', { overrides: { 'powers.json': '{broken' } }, /Invalid JSON/],
  ['invalid entities', { overrides: { 'powers.json': '[]' } }, /validation/],
  ['missing game version', { overrides: { 'changelog.json': '[]' } }, /game-data version/],
  ['invalid source ref', { sha: 'main' }, /full commit SHA/]
]) {
  test(label + ' leaves the complete old snapshot intact', async t => {
    const root = await fixture(t), before = await bytes(root);
    await assert.rejects(refreshSnapshot({ root, fetchImpl: upstream(options) }), message);
    assert.deepEqual(await bytes(root), before);
    assert.ok(!(await readdir(path.join(root, 'data'))).includes('.sts2-update'));
  });
}

test('a failed install restores the previous directory before reporting failure', async t => {
  const root = await fixture(t), before = await bytes(root);
  const renameFile = async (source, target) => {
    if (source.endsWith('/staged')) throw new Error('Cannot install staged directory');
    return rename(source, target);
  };
  await assert.rejects(refreshSnapshot({ root, fetchImpl: upstream(), renameFile }), /Cannot install/);
  assert.deepEqual(await bytes(root), before);
});

test('an exited updater is recovered after it stops between directory renames', async t => {
  const root = await fixture(t), before = await bytes(root);
  await writeFile(path.join(root, 'upstream.json'), JSON.stringify(payload));
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {refreshSnapshot} from ${JSON.stringify(new URL('../lib/snapshot-update.mjs', import.meta.url).href)};
    import {rename,readFile} from 'node:fs/promises';
    const payload = JSON.parse(await readFile(process.argv[2],'utf8'));
    await refreshSnapshot({root:process.argv[1], fetchImpl:async url => new Response(url.endsWith('/git/ref/heads/main') ? JSON.stringify({object:{sha:'${newSha}'}}) : payload[url.split('/').at(-1)]), renameFile:async (source,target) => {
      await rename(source,target);
      if (target.endsWith('/previous')) process.exit(75);
    }});
  `, root, path.join(root, 'upstream.json')], { encoding: 'utf8' });
  assert.equal(child.status, 75, child.stderr || child.error?.message);
  const result = await refreshSnapshot({ root, fetchImpl: upstream({ sha: snapshot.meta.source_commit }) });
  assert.equal(result.changed, false);
  assert.deepEqual(await bytes(root), before);
});

test('a completed install interrupted during cleanup keeps the complete new snapshot', async t => {
  const root = await fixture(t);
  const work = path.join(root, 'data/.sts2-update');
  await mkdir(path.join(work, 'previous'), { recursive: true });
  await writeFile(path.join(work, 'committed'), '');
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  await writeFile(path.join(work, 'owner.json'), JSON.stringify({ pid: child.pid, hostname: hostname() }));
  const before = await bytes(root);
  assert.equal(await recoverSnapshot(root), true);
  assert.deepEqual(await bytes(root), before);
});

test('a running updater and an existing recovery are never overwritten', async t => {
  const root = await fixture(t), before = await bytes(root);
  const work = path.join(root, 'data/.sts2-update');
  await mkdir(work);
  await writeFile(path.join(work, 'owner.json'), JSON.stringify({ pid: process.pid, hostname: hostname() }));
  await assert.rejects(refreshSnapshot({ root, fetchImpl: upstream() }), /already running/);
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  await writeFile(path.join(work, 'owner.json'), JSON.stringify({ pid: child.pid, hostname: hostname() }));
  await mkdir(path.join(work, 'recovering'));
  await assert.rejects(recoverSnapshot(root), /recovery is already in progress/);
  assert.deepEqual(await bytes(root), before);
});
