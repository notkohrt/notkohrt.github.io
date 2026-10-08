import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pinnedLibraries, validateSourceScripts } from '../lib/build-security.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const libraries = await pinnedLibraries(root, manifest);

test('source scripts match the exact integrity of the locked packages', () => {
  assert.doesNotThrow(() => validateSourceScripts(template, libraries));
  const tampered = template.replace(libraries[0].integrity, libraries[0].integrity.replace('sha384-', 'sha256-'));
  assert.throws(() => validateSourceScripts(tampered, libraries), /integrity/);
  assert.throws(() => validateSourceScripts(template.replace('crossorigin="anonymous"', ''), libraries), /integrity/);
});

test('unversioned extra code and mismatched versions cannot enter generated previews', async () => {
  assert.throws(() => validateSourceScripts(template.replace('</body>', '<script src="https://example.invalid/widget.js"></script></body>'), libraries), /Unexpected runtime script/);
  assert.throws(() => validateSourceScripts(template.replace('</body>', '<script src=https://example.invalid/widget.js></script></body>'), libraries), /Unexpected runtime script/);
  assert.throws(() => validateSourceScripts(template.replace('</body>', '<script>window.untrusted = true;</script></body>'), libraries), /Unexpected runtime script/);
  assert.throws(() => validateSourceScripts(template.replace('pixi.js@7.4.2', 'pixi.js@latest'), libraries), /locked version/);
  const unpinned = structuredClone(manifest);
  unpinned.devDependencies.d3 = '^7.9.0';
  await assert.rejects(pinnedLibraries(root, unpinned), /exact version/);
});
