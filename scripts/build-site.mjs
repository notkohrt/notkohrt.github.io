import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildPreview, renderPreview } from './build-preview.mjs';

const output = fileURLToPath(new URL('../index.html', import.meta.url));

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    const { html } = await renderPreview();
    const current = await readFile(output, 'utf8');
    if (current !== html) throw new Error('Generated index.html is stale. Run npm run build:site and commit index.html with its source changes.');
    console.log('Generated index.html matches the shared source and pinned data.');
  } else if (!args.length) {
    const result = await buildPreview(output);
    console.log('Built self-contained index.html (' + result.nodes + ' notes, ' + result.edges + ' links, ' + result.bytes + ' bytes).');
  } else {
    throw new Error('Usage: node scripts/build-site.mjs [--check]');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
