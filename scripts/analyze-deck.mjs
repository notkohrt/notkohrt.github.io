import { readFile, writeFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadSnapshot } from './load-snapshot.mjs';
import { validateModel } from '../lib/validate-model.mjs';
import { analyzeDeck, createDeckIndex, readDeckDocument, deckMarkdown, SILENT_EXAMPLE, MAX_DECK_SIZE } from '../lib/deck-analysis.mjs';

try {
  const { values } = parseArgs({ options: {
    input: { type: 'string' }, example: { type: 'boolean' },
    draws: { type: 'string' }, first: { type: 'string' }, second: { type: 'string' },
    format: { type: 'string', default: 'markdown' }, output: { type: 'string' }
  } });
  if (Boolean(values.input) === Boolean(values.example)) throw new Error('Choose --input /path/to/deck.json or --example.');
  if (!['markdown', 'json'].includes(values.format)) throw new Error('Format must be markdown or json.');
  if (values.input && (await stat(values.input)).size > 1024 * 1024) throw new Error('Deck JSON must be smaller than 1 MB.');
  const draft = values.example ? structuredClone(SILENT_EXAMPLE) : JSON.parse(await readFile(values.input, 'utf8'));
  const snapshot = await loadSnapshot(), model = validateModel(snapshot);
  if (model.errors.length) throw new Error(model.errors.join('\n'));
  const index = createDeckIndex(model.nodes, model.edges, snapshot.meta);
  const incoming = readDeckDocument(index, draft);
  const draws = values.draws === undefined ? incoming.draws : /^\d+$/.test(values.draws) ? Number(values.draws) : NaN;
  if (!Number.isInteger(draws) || draws < 0 || draws > MAX_DECK_SIZE) throw new Error('Cards drawn must be a whole number from 0 to ' + MAX_DECK_SIZE + '.');
  const size = incoming.normalized.entries.reduce((sum, entry) => sum + entry.count, 0);
  const report = analyzeDeck(index, draft, {
    draws: Math.min(draws, size), firstId: values.first ?? draft.combo?.[0] ?? '', secondId: values.second ?? draft.combo?.[1] ?? ''
  });
  const content = values.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : deckMarkdown(index, report);
  if (values.output) await writeFile(values.output, content, { flag: 'wx' });
  else process.stdout.write(content);
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Output already exists. Choose a new filename to preserve the existing report.' : error.message);
  process.exitCode = 1;
}
