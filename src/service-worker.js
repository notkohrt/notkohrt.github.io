// Generated sw.js injects the hashes of the exact app and local assets.
/* BUILD_CONFIG */
const scope = new URL(self.registration.scope);
const prefix = 'sts2-stars:' + scope.href + ':';
const cacheName = prefix + CONFIG.version;
const entries = new Map(CONFIG.files.map(file => [new URL(file.path, scope).href, file]));
const indexURL = new URL('index.html', scope).href;

async function populate() {
  // Validate everything before writing; a mixed Pages deployment cannot become
  // an accepted offline version. Never read from an HTTP/CDN cache on install.
  const responses = await Promise.all(CONFIG.files.map(async file => {
    const response = await fetch(new URL(file.path, scope), {
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    if (!response.ok || response.redirected) throw new Error('Offline download failed: ' + file.path);
    const bytes = await response.clone().arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== file.sha256) throw new Error('Offline build mismatch: ' + file.path);
    return [new URL(file.path, scope).href, response];
  }));
  const cache = await caches.open(cacheName);
  await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
}

self.addEventListener('install', event => {
  event.waitUntil(populate().catch(async error => {
    await caches.delete(cacheName);
    throw error;
  }));
  // The first installation activates normally. Updates wait for explicit
  // acceptance (or until all old app tabs are closed).
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function status() {
  if (!(await caches.has(cacheName))) return { type: 'OFFLINE_STATUS', build: CONFIG.appBuild, ready: false };
  const cache = await caches.open(cacheName);
  const complete = (await Promise.all([...entries.keys()].map(url => cache.match(url)))).every(Boolean);
  return { type: 'OFFLINE_STATUS', build: CONFIG.appBuild, ready: complete };
}

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'OFFLINE_STATUS' || event.data?.type === 'REPAIR_CACHE') {
    event.waitUntil((async () => {
      if (event.data.type === 'REPAIR_CACHE') {
        try { await populate(); } catch { /* Keep existing files and report incomplete storage. */ }
      }
      event.ports[0]?.postMessage(await status());
    })());
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin) return;
  // All node/filter query strings use the same complete HTML snapshot. Do not
  // turn unrelated documents, unknown paths, or external links into the graph.
  const appNavigation = event.request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === new URL(indexURL).pathname);
  url.search = '';
  const key = appNavigation ? indexURL : url.href;
  if (!entries.has(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(cacheName)).match(key);
    if (cached) return cached;
    // Storage may have been evicted by the OS. Fail visibly offline; never
    // silently cache an unchecked different deployment into this version.
    try { return await fetch(event.request); }
    catch { return new Response('Offline copy unavailable. Reconnect and reload to restore it.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  })());
});
