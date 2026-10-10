import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/analyze-deck.mjs', import.meta.url));

test('CLI reads the portable deck format from outside the checkout and produces reproducible JSON and Obsidian notes', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sts2-deck-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'deck.json'), output = path.join(dir, 'analysis.md');
  await writeFile(input, JSON.stringify({ format: 'sts2-stars-deck-v1', entries: [{ id: 'card:COMET', count: 1 }, { id: 'card:RESONANCE', count: 1, upgraded: true }], relics: [], draws: 1, combo: ['card:COMET', 'card:RESONANCE'] }));
  const run = args => execFileSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  const json = run(['--input', input, '--format', 'json']);
  assert.equal(run(['--input', input, '--format', 'json']), json);
  const report = JSON.parse(json);
  assert.equal(report.size, 2);
  assert.equal(report.combo.probability, 0);
  assert.equal(report.costs.starCards, 2);
  run(['--input', input, '--output', output]);
  const markdown = await readFile(output, 'utf8');
  assert.match(markdown, /\[\[Cards\/Comet\|Comet\]\]/);
  const duplicate = spawnSync(process.execPath, [script, '--input', input, '--output', output], { encoding: 'utf8' });
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /already exists/);
  assert.equal(await readFile(output, 'utf8'), markdown);
  assert.equal(JSON.parse(run(['--example', '--format', 'json'])).size, 20);
  const partial = path.join(dir, 'partial.json');
  await writeFile(partial, JSON.stringify({ entries: [{ id: 'card:SHIV', count: 1 }], draws: 5, combo: ['card:SHIV', ''] }));
  const partialReport = JSON.parse(run(['--input', partial, '--format', 'json']));
  assert.equal(partialReport.draws, 1);
  assert.equal(partialReport.combo, null);
});
