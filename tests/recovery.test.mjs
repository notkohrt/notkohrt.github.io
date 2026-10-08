import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createBackup, restoreBackup } from '../lib/recovery.mjs';

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-recovery space-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  await mkdir(path.join(root, 'data'), { recursive: true });
  await mkdir(path.join(root, 'vault/Cards'), { recursive: true });
  await mkdir(path.join(root, 'vault/.obsidian'));
  await writeFile(path.join(root, 'vault/.obsidian/graph.json'), '{"showTags":false}\n');
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.name', 'Recovery test');
  git(root, 'config', 'user.email', 'recovery@example.invalid');
  await writeFile(path.join(root, 'README.md'), 'Committed source\n');
  await writeFile(path.join(root, 'data/manual-links.json'), '[]\n');
  await writeFile(path.join(root, 'vault/Cards/Shiv.md'), 'Original note\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Initial source');
  await writeFile(path.join(root, 'README.md'), 'Second committed source\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Second source');
  return { directory, root, output: path.join(directory, 'backup'), restored: path.join(directory, 'restored') };
}

test('full-history restoration preserves uncommitted curations, new notes, and intentional note deletions', async t => {
  const f = await fixture(t);
  const note = '<!-- CURATED START -->\n- scales with [[Powers/Strength]]\nHand-written explanation.\n<!-- CURATED END -->\n';
  await rm(path.join(f.root, 'vault/Cards/Shiv.md'));
  await writeFile(path.join(f.root, 'vault/Cards/New note é.md'), note);
  const manual = '[{"source":"card:SHIV","target":"power:STRENGTH_POWER","relation":"scales with"}]\n';
  await writeFile(path.join(f.root, 'data/manual-links.json'), manual);
  const backup = await createBackup(f);
  const restored = await restoreBackup({ input: f.output, output: f.restored });
  assert.equal(restored.head, backup.head);
  assert.equal(git(f.restored, 'rev-list', '--count', 'HEAD'), '2');
  assert.equal(await readFile(path.join(f.restored, 'README.md'), 'utf8'), 'Second committed source\n');
  assert.equal(await readFile(path.join(f.restored, 'vault/Cards/New note é.md'), 'utf8'), note);
  assert.equal(await readFile(path.join(f.restored, 'data/manual-links.json'), 'utf8'), manual);
  assert.equal(await readFile(path.join(f.restored, 'vault/.obsidian/graph.json'), 'utf8'), '{"showTags":false}\n');
  await assert.rejects(lstat(path.join(f.restored, 'vault/Cards/Shiv.md')), { code: 'ENOENT' });
  await assert.rejects(createBackup(f), { code: 'EEXIST' });
  await assert.rejects(restoreBackup({ input: f.output, output: f.restored }), /new directory/);
  assert.equal(await readFile(path.join(f.restored, 'vault/Cards/New note é.md'), 'utf8'), note);
});

test('a corrupted package fails before creating a restore directory', async t => {
  const f = await fixture(t);
  await createBackup(f);
  await writeFile(path.join(f.output, 'authored-state.json'), '{}');
  await assert.rejects(restoreBackup({ input: f.output, output: f.restored }), /checksum mismatch/);
  await assert.rejects(lstat(f.restored), { code: 'ENOENT' });
});

test('authored paths cannot escape the restored repository even with matching checksums', async t => {
  const f = await fixture(t);
  await createBackup(f);
  const file = path.join(f.output, 'authored-state.json');
  const authored = JSON.parse(await readFile(file, 'utf8'));
  delete authored.files['vault/Cards/Shiv.md'];
  authored.files['vault/../../outside.md'] = 'Must never be written.';
  await writeFile(file, JSON.stringify(authored));
  const hash = createHash('sha256').update(await readFile(file)).digest('hex');
  const sums = path.join(f.output, 'SHA256SUMS');
  await writeFile(sums, (await readFile(sums, 'utf8')).replace(/^[a-f0-9]{64}  authored-state.json$/m, hash + '  authored-state.json'));
  await assert.rejects(restoreBackup({ input: f.output, output: f.restored }), /Unsafe authored-state path/);
  await assert.rejects(lstat(f.restored), { code: 'ENOENT' });
});

test('uncommitted source is reported rather than silently omitted from backups', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'README.md'), 'Unsaved source changes\n');
  await assert.rejects(createBackup(f), /preserve code changes/);
  git(f.root, 'checkout', '--', 'README.md');
  await writeFile(path.join(f.root, 'new-parser.mjs'), 'Untracked code');
  await assert.rejects(createBackup(f), /new-parser.mjs/);
});

test('shallow history is refused, and a detached full-history checkout restores its exact commit', async t => {
  const f = await fixture(t);
  const shallow = path.join(f.directory, 'shallow');
  execFileSync('git', ['clone', '--quiet', '--depth', '1', 'file://' + f.root, shallow], { stdio: ['ignore', 'pipe', 'pipe'] });
  await assert.rejects(createBackup({ root: shallow, output: f.output }), /full Git clone/);
  git(f.root, 'checkout', '--quiet', '--detach', 'HEAD~1');
  const backup = await createBackup(f);
  const restored = await restoreBackup({ input: f.output, output: f.restored });
  assert.equal(restored.head, backup.head);
  assert.equal(git(f.restored, 'rev-list', '--count', 'HEAD'), '1');
  assert.equal(await readFile(path.join(f.restored, 'README.md'), 'utf8'), 'Committed source\n');
});
