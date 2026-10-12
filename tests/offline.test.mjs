import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CORE_FILES, renderServiceWorker } from '../scripts/build-pwa.mjs';
import { buildOffline } from '../scripts/build-offline.mjs';
import { buildPreview } from '../scripts/build-preview.mjs';

test('install identity, icons and the generated cache cover the full local app and pinned dataset', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = await readFile(new URL('../' + icon.src, import.meta.url));
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const worker = await renderServiceWorker(html);
  assert.equal(await readFile(new URL('../sw.js', import.meta.url), 'utf8'), worker);
  const config = JSON.parse(worker.match(/const CONFIG = ([\s\S]*?);\nconst scope/)[1]);
  assert.deepEqual(config.files.map(file => file.path), CORE_FILES);
  assert.ok(config.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.equal(new Set(CORE_FILES).size, CORE_FILES.length);
  assert.ok(CORE_FILES.includes('data/sts2/meta.json'));
  assert.ok(CORE_FILES.includes('data/manual-links.json'));
  assert.notEqual(await renderServiceWorker(html.replace('vault graph', 'reference graph')), worker);
});

test('downloadable offline ZIPs are deterministic and contain a complete verified PWA, data and vault', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-offline-package-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await buildOffline(path.join(directory, 'first'));
  const second = await buildOffline(path.join(directory, 'second'));
  assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
  const names = JSON.parse(execFileSync('python3', ['-c',
    'import sys,json,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist()))', first.archive], { encoding: 'utf8' }));
  for (const file of [...CORE_FILES, 'sw.js', 'serve.py', 'vault/Start Here.md', 'SHA256SUMS', 'manifest.json']) assert.ok(names.includes(file), file);
  assert.ok(names.length > 1250);
  await assert.rejects(buildOffline(first.output), /output already exists/);
  const preview = path.join(directory, 'preview.html');
  await buildPreview(preview);
  const html = await readFile(preview, 'utf8');
  assert.doesNotMatch(html, /<link rel="(?:manifest|icon|apple-touch-icon)"|<meta name="sts2-app-build"/);
});
