import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CORE_FILES, renderServiceWorker } from '../scripts/build-pwa.mjs';

// Real HTTP is essential: page.route cannot emulate worker installation/fetch.
export async function offlineServer(mount = '/') {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-offline-'));
  const versions = [];
  for (let version = 0; version < 2; version++) {
    const folder = path.join(directory, String(version));
    const files = new Map();
    for (const file of CORE_FILES) files.set(file, await readFile(new URL('../' + file, import.meta.url)));
    if (version) {
      const cards = JSON.parse(files.get('data/sts2/cards.json'));
      cards.find(card => card.id === 'SHIV').description = 'Deal 5 damage.';
      const meta = JSON.parse(files.get('data/sts2/meta.json'));
      meta.game_data_version = '0.107.2-test';
      files.set('data/sts2/cards.json', Buffer.from(JSON.stringify(cards)));
      files.set('data/sts2/meta.json', Buffer.from(JSON.stringify(meta)));
      let html = files.get('index.html').toString().replace(
        /(<script id="sts2-snapshot" type="application\/json">)([\s\S]*?)(<\/script>)/,
        (_, start, json, end) => {
          const embedded = JSON.parse(json);
          embedded['data/sts2/cards.json'] = cards;
          embedded['data/sts2/meta.json'] = meta;
          return start + JSON.stringify(embedded).replace(/</g, '\\u003c') + end;
        });
      html = html.replace(/(<meta name="sts2-app-build" content=")[a-f0-9]{64}(">)/,
        '$1' + createHash('sha256').update(html).digest('hex') + '$2');
      files.set('index.html', Buffer.from(html));
    }
    for (const [file, bytes] of files) {
      await mkdir(path.dirname(path.join(folder, file)), { recursive: true });
      await writeFile(path.join(folder, file), bytes);
    }
    files.set('sw.js', Buffer.from(await renderServiceWorker(files.get('index.html').toString(), folder)));
    versions.push(files);
  }
  const state = { version: 0, failure: null, requests: [] };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    state.requests.push(pathname);
    let file = pathname.startsWith(mount) ? pathname.slice(mount.length) : null;
    if (!file) file = pathname === mount ? 'index.html' : null;
    const bytes = versions[state.version].get(file);
    if (!bytes) { response.writeHead(404); response.end('Not in app scope'); return; }
    if (state.failure && file === 'data/sts2/cards.json') {
      response.writeHead(state.failure === 'missing' ? 503 : 200);
      response.end('A partial deployment must never replace a complete cached app.');
      return;
    }
    const mime = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' :
      file.endsWith('.json') ? 'application/json' : file.endsWith('.webmanifest') ? 'application/manifest+json' :
        file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'text/plain';
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseURL = 'http://127.0.0.1:' + port + mount;
  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  async function start() {
    if (!stopped) return;
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    stopped = false;
  }
  return { baseURL, state, stop, start, async close() {
    await stop();
    await rm(directory, { recursive: true, force: true });
  } };
}
