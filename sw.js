// Generated sw.js injects the hashes of the exact app and local assets.
const CONFIG = {
  "version": "75b34676d0afa470102476d411f6376164b9b17ed03f9ebb457d15d72d22e9cf",
  "appBuild": "468d652653945a29f7ba5d3acc79a29e40ecb3f680b38e5d0a14e9aed040b83b",
  "files": [
    {
      "path": "index.html",
      "sha256": "6ea8cae75774a6010ba8199fdd527eba4c400ac60b5617acc544d6c2edb54acf"
    },
    {
      "path": "manifest.webmanifest",
      "sha256": "03570bbf95135d7640db5a7ae6e86012bedb89d72f2c1b99c0f9b97b207c86cd"
    },
    {
      "path": "icons/icon-192.png",
      "sha256": "caf40e718612e23a65f8b80576b4cef12a22c02ba6ad763ef664726432b6406e"
    },
    {
      "path": "icons/icon-512.png",
      "sha256": "6c7d66df1862f0d70549c6e3a44c12a2beb5a03cef401b9f61cfecf34d165f33"
    },
    {
      "path": "icons/apple-touch-icon.png",
      "sha256": "25d3f1414990090ca8121c4b05f0c5cccbbb7466904bc42518ac2f1aafd2a29a"
    },
    {
      "path": "CREDITS.md",
      "sha256": "bb2ff0474815456829b84859c6a78ebc08e325363eaa71b104e85d8753e91a63"
    },
    {
      "path": "docs/assets/sts2-neow.webp",
      "sha256": "10c50885668c72aad5c9a9d237d6f1cde2746144e4b8935c513f359e1410d520"
    },
    {
      "path": "vendor/pixi-7.4.2.min.js",
      "sha256": "9ddba9cd78bc8610a1d445ec939393888be83925c78e40d66d9a17e98450228d"
    },
    {
      "path": "vendor/d3-7.9.0.min.js",
      "sha256": "f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539"
    },
    {
      "path": "vendor/pixi-LICENSE",
      "sha256": "5ce7447bc57f7349ffc48338782fbcabe613696e00712b20d66bc58e780f9473"
    },
    {
      "path": "vendor/d3-LICENSE",
      "sha256": "3e6849627f74ff73c257a3ae1efb574015d94fc1035c05ec3c15805165efcbc4"
    },
    {
      "path": "data/sts2/cards.json",
      "sha256": "22ef381db9d184a3d739b7805cdd730cdc30950735564b7d614966fbbe124aa7"
    },
    {
      "path": "data/sts2/relics.json",
      "sha256": "1092dea97f3de009528efdc39008e6d159cf6023fb4e10158076cf05eca90ae2"
    },
    {
      "path": "data/sts2/powers.json",
      "sha256": "41280029a1261761a036e5db0ac54f0b84e4bba3731e1c03c4dedf09d9228468"
    },
    {
      "path": "data/sts2/potions.json",
      "sha256": "6ceaf3e3f745c239b2abb8a16507fbc11ec5233e75ff32070c33e6aa54796d10"
    },
    {
      "path": "data/sts2/enchantments.json",
      "sha256": "f8e9faf25719e9d36334dc8e49f1c9000846de82ea798901b458be27f3ea57d4"
    },
    {
      "path": "data/sts2/keywords.json",
      "sha256": "ec337c7e2876d18fe06f9861d696df75763d22cc0f4c19f7cad8132cedeb0708"
    },
    {
      "path": "data/sts2/mechanics.json",
      "sha256": "eb89595e11abaa235e8894a48faa25b705c8ad893788b5ef998ec1950ce56220"
    },
    {
      "path": "data/sts2/card_powers.json",
      "sha256": "37cec860c9710b24dcc7d77bf2c79dc277572e0882a7cc8119a8c566f241e6d3"
    },
    {
      "path": "data/sts2/meta.json",
      "sha256": "83d1523c9ee47c6b1084d1639d08f2ecee91ae07ee3bc37343b552ce0080c6dd"
    },
    {
      "path": "data/manual-links.json",
      "sha256": "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570"
    }
  ]
};
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
