import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SOURCES, SOURCE_META_URL } from '../lib/graph-model.mjs';
import manifest from '../package.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
export const PWA_ASSETS = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/apple-touch-icon.png', 'CREDITS.md', 'docs/assets/sts2-neow.webp',
  ...['pixi.js', 'd3'].map(name => 'vendor/' + (name === 'pixi.js' ? 'pixi' : name) + '-' + manifest.devDependencies[name] + '.min.js'),
  'vendor/pixi-LICENSE', 'vendor/d3-LICENSE'];
export const CORE_FILES = ['index.html', ...PWA_ASSETS, ...Object.values(SOURCES), SOURCE_META_URL, 'data/manual-links.json'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function renderServiceWorker(html, directory = root) {
  const files = await Promise.all(CORE_FILES.map(async file => ({
    path: file, sha256: hash(file === 'index.html' ? html : await readFile(path.join(directory, file)))
  })));
  const appBuild = html.match(/<meta name="sts2-app-build" content="([a-f0-9]{64})">/)?.[1];
  if (!appBuild) throw new Error('PWA HTML must identify its complete embedded app build.');
  const source = await readFile(path.join(root, 'src/service-worker.js'), 'utf8');
  // Worker-only fixes must use a new cache too. Otherwise a failed install of
  // new worker code could delete the previous worker's still-active cache.
  const config = { version: hash(source + '\0' + JSON.stringify(files)), appBuild, files };
  return source.replace('/* BUILD_CONFIG */', 'const CONFIG = ' + JSON.stringify(config, null, 2) + ';');
}
