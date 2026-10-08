import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildV1, verifyV1 } from '../scripts/build-v1.mjs';
import { writeChecksums, verifyChecksums } from '../lib/build-integrity.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';
import { validateModel } from '../lib/validate-model.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const status = () => execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' });

test('complete v1 builds are deterministic, match the website and vault, and preserve existing exports', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-v1 space-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const before = status();
  const first = await buildV1(path.join(directory, 'first'));
  const second = await buildV1(path.join(directory, 'second'));
  assert.equal(status(), before, 'Building must not rewrite the checkout');
  const snapshot = await loadSnapshot();
  const model = validateModel(snapshot);
  assert.equal(first.nodes, model.nodes.length);
  assert.equal(first.edges, model.edges.length);
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.manifest.source.commit, execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  assert.equal(first.manifest.source.dirty, Boolean(before.trim()));
  assert.deepEqual(first.manifest.snapshot, snapshot.meta);
  assert.equal(await readFile(path.join(first.output, 'SHA256SUMS'), 'utf8'), await readFile(path.join(second.output, 'SHA256SUMS'), 'utf8'));
  assert.equal(await readFile(path.join(first.output, 'index.html'), 'utf8'), await readFile(path.join(root, 'index.html'), 'utf8'));
  for (const file of ['vault/README.md', 'vault/Start Here.md', 'vault/.obsidian/app.json', 'vault/.obsidian/graph.json', 'CREDITS.md']) {
    assert.equal(await readFile(path.join(first.output, file), 'utf8'), await readFile(path.join(root, file), 'utf8'), file);
  }

  await t.test('an edited export is detected and cannot be overwritten by a rerun', async () => {
    const note = path.join(first.output, 'vault/Cards/Shiv.md');
    const original = await readFile(note, 'utf8');
    const edited = original + '\nAuthored notes to preserve.\n';
    await writeFile(note, edited);
    await assert.rejects(verifyV1(first.output), /checksum mismatch/);
    await assert.rejects(buildV1(first.output), { code: 'EEXIST' });
    assert.equal(await readFile(note, 'utf8'), edited);
    await writeFile(note, original);
  });

  async function changed(file, transform, expectedError) {
    const destination = path.join(first.output, file);
    const original = await readFile(destination, 'utf8');
    try {
      await writeFile(destination, transform(original));
      await writeChecksums(first.output);
      await assert.rejects(verifyV1(first.output), expectedError);
    } finally {
      await writeFile(destination, original);
      await writeChecksums(first.output);
    }
  }
  await t.test('matching checksums do not hide changed note mechanics', async () => {
    await changed('vault/Cards/Shiv.md', text => text.replace('Deal 4 damage.', 'Deal 999 damage.'), /Vault note differs/);
  });
  await t.test('matching checksums do not hide an out-of-sync website snapshot', async () => {
    await changed('index.html', text => text.replace(/(<script id="sts2-snapshot" type="application\/json">)([\s\S]*?)(<\/script>)/,
      (_, start, json, end) => {
        const data = JSON.parse(json);
        data['data/manual-links.json'] = [{ source: 'card:SHIV', target: 'power:STRENGTH_POWER', relation: 'scales with' }];
        return start + JSON.stringify(data).replace(/</g, '\\u003c') + end;
      }), /Website snapshot differs/);
  });
  await t.test('matching checksums do not hide an unexported curated relationship', async () => {
    await changed('vault/Cards/Shiv.md', text => text.replace(/<!-- Add typed wikilinks here\.[^\n]*-->/,
      '- scales with [[Powers/Strength|Strength]]'), /Vault curation differs/);
  });
  await t.test('matching checksums do not hide incorrect manifest counts', async () => {
    await changed('manifest.json', text => {
      const manifest = JSON.parse(text);
      manifest.graph.relationships++;
      return JSON.stringify(manifest);
    }, /manifest differs/);
  });
  await t.test('unrelated hidden settings cannot enter a distribution', async () => {
    const extra = path.join(first.output, 'vault/.obsidian/plugins.json');
    await writeFile(extra, '[]\n');
    await writeChecksums(first.output);
    await assert.rejects(verifyV1(first.output), /unexpected v1 build files/);
    await rm(extra);
    await writeChecksums(first.output);
  });
  assert.equal((await verifyV1(first.output)).edges, first.edges);
});

test('build integrity rejects incomplete, extra, ambiguous, escaping, and symlinked files', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-build-integrity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'build');
  await mkdir(path.join(output, 'vault/Cards'), { recursive: true });
  const file = path.join(output, 'vault/Cards/Note é.md');
  await writeFile(file, 'Original\n');
  await writeChecksums(output);
  assert.deepEqual(await verifyChecksums(output), ['vault/Cards/Note é.md']);
  const sums = path.join(output, 'SHA256SUMS');
  const original = await readFile(sums, 'utf8');

  await t.test('missing and undeclared files are rejected', async () => {
    await rm(file);
    await assert.rejects(verifyChecksums(output), /file list differs/);
    await writeFile(file, 'Original\n');
    const extra = path.join(output, 'extra.md');
    await writeFile(extra, 'Extra');
    await assert.rejects(verifyChecksums(output), /file list differs/);
    await rm(extra);
  });
  await t.test('duplicate checksum entries are rejected', async () => {
    await writeFile(sums, original + original);
    await assert.rejects(verifyChecksums(output), /Duplicate/);
    await writeFile(sums, original);
  });
  await t.test('checksum paths cannot escape the directory', async () => {
    for (const unsafe of ['../outside.md', '/absolute.md', 'vault/../outside.md', 'C:\\outside.md']) {
      await writeFile(sums, 'a'.repeat(64) + '  ' + unsafe + '\n');
      await assert.rejects(verifyChecksums(output), /Unsafe or invalid/);
    }
    await writeFile(sums, original);
  });
  await t.test('symlinked files and directories are rejected before hashing', async () => {
    const outside = path.join(directory, 'outside.md');
    await writeFile(outside, 'Outside package');
    const link = path.join(output, 'linked.md');
    await symlink(outside, link);
    await assert.rejects(verifyChecksums(output), /symlink or special/);
    await rm(link);
    await symlink(directory, path.join(output, 'linked-directory'));
    await assert.rejects(writeChecksums(output), /symlink or special/);
    await rm(path.join(output, 'linked-directory'));
  });
  assert.deepEqual(await verifyChecksums(output), ['vault/Cards/Note é.md']);
});
