import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['app.js', 'playwright.config.mjs', 'playwright.production.config.mjs'];
for (const directory of ['lib', 'scripts', 'tests']) {
  for (const file of await readdir(path.join(root, directory))) {
    if (/\.mjs$/.test(file)) files.push(directory + '/' + file);
  }
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Syntax checked ' + files.length + ' JavaScript files.');
