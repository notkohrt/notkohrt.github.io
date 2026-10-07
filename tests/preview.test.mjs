import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPreview } from '../scripts/build-preview.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';
import { SOURCES, SOURCE_META_URL } from '../lib/graph-model.mjs';

test('standalone preview contains the complete pinned snapshot and builds deterministically', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-preview-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'preview.html');
  await buildPreview(output);
  const html = await readFile(output, 'utf8');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/);
  assert.match(html, /<style>/);
  const json = html.match(/<script id="sts2-snapshot" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.ok(!json.includes('<'), 'Embedded text must not become HTML markup');
  const embedded = JSON.parse(json);
  const snapshot = await loadSnapshot();
  for (const [key, file] of Object.entries(SOURCES)) assert.deepEqual(embedded[file], snapshot.raw[key], file);
  assert.deepEqual(embedded[SOURCE_META_URL], snapshot.meta);
  assert.deepEqual(embedded['data/manual-links.json'], snapshot.manualLinks);
  await buildPreview(output);
  assert.equal(await readFile(output, 'utf8'), html);
});
