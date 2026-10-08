import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pinnedLibraries, validateSourceScripts } from '../lib/build-security.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    if (!/^\d+\.\d+\.\d+$/.test(version) || lock.packages[''].devDependencies[name] !== version || lock.packages['node_modules/' + name]?.version !== version) {
      throw new Error('Development dependency must match its exact locked version: ' + name);
    }
  }
  validateSourceScripts(await readFile(path.join(root, 'src/index.html'), 'utf8'), await pinnedLibraries(root, manifest));
  const directory = path.join(root, '.github/workflows');
  for (const file of await readdir(directory)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = await readFile(path.join(directory, file), 'utf8');
    const actions = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(?:#.*)?$/gm)];
    if (actions.length !== [...text.matchAll(/\buses\s*:/g)].length) throw new Error(file + ': use block YAML for auditable action pins.');
    for (const match of actions) {
      const action = match[1].replace(/^['"]|['"]$/g, '');
      if (!/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(action)) throw new Error(file + ': action must be pinned to a full commit: ' + action);
    }
  }
  console.log('Security policy checked: exact locked dependencies, source-script integrity, and immutable CI actions.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
