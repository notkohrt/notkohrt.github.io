// Offline installation is independent of graph startup and optional browser APIs.
export function mountOfflineStatus(meta) {
  const status = document.getElementById('offline-status');
  const help = document.getElementById('offline-help');
  const update = document.getElementById('app-update');
  const notice = document.getElementById('online-notice');
  const build = document.querySelector('meta[name="sts2-app-build"]')?.content;
  const version = meta.game_data_version ? 'v' + meta.game_data_version : 'pinned data';
  let ready = false, registration, reloadOnChange = false, differentBuild = false;
  let unavailable = false, lastCheck = 0, noticeTimer;

  function render() {
    const waiting = Boolean(registration?.waiting || differentBuild);
    const label = !navigator.onLine ? 'Offline' : waiting ? 'Update ready' : ready ? 'Offline ready' :
      unavailable ? 'Browser only' : 'Saving offline…';
    status.textContent = label + ' · ' + version;
    status.dataset.state = waiting ? 'update' : ready ? 'ready' : unavailable ? 'unavailable' : 'saving';
    status.title = help.textContent;
    update.classList.toggle('hidden', !waiting);
    update.textContent = registration?.waiting ? 'Update app' : 'Reload updated app';
  }

  // These are user-triggered links, never prerequisites for graph rendering.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || navigator.onLine) return;
    const url = new URL(link.href, location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin) return;
    event.preventDefault();
    notice.textContent = 'This link needs internet access. The graph and notes remain available offline.';
    notice.classList.remove('hidden');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.add('hidden'), 6000);
  });

  function ask(worker, type = 'OFFLINE_STATUS') {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline status timed out')); }, 20000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data);
      };
      worker.postMessage({ type }, [channel.port2]);
    });
  }

  async function refresh() {
    if (!registration) return;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) return;
    try {
      let result = await ask(worker);
      if (!result.ready && result.build === build && navigator.onLine) result = await ask(worker, 'REPAIR_CACHE');
      differentBuild = result.build !== build;
      ready = result.ready && !differentBuild;
      unavailable = !result.ready;
      help.textContent = ready ? 'The complete app and pinned data are saved on this device. Install from your browser menu. Source and feedback links need internet access.' :
        differentBuild ? 'An updated app is available. Apply it to save this version for offline use. Open Controls to update.' :
          'Offline storage is unavailable. Reconnect and reload to retry; the open graph still uses local pinned data.';
      if (registration.waiting) help.textContent = 'A complete update is downloaded. Open Controls and choose Update app to reload. Your current note URL and saved decks are kept.';
      render();
    } catch {
      unavailable = true;
      help.textContent = 'Offline storage could not be confirmed. The graph remains available in this tab.';
      render();
    }
  }

  function showUpdate() {
    if (registration.waiting) help.textContent = 'An updated app is downloaded. Open Controls and choose Update app to reload. Your current note URL and saved decks are kept.';
    render();
  }

  function checkUpdate() {
    if (!registration || !navigator.onLine || document.visibilityState !== 'visible' || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    registration.update().catch(() => {}); // Offline/captive networks leave the existing copy intact.
  }

  window.addEventListener('online', () => { render(); refresh(); checkUpdate(); });
  window.addEventListener('offline', render);
  document.addEventListener('visibilitychange', checkUpdate);
  update.addEventListener('click', () => {
    if (registration?.waiting) {
      reloadOnChange = true;
      update.disabled = true;
      update.textContent = 'Updating…';
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    } else location.reload();
  });

  // Previews, file URLs, unsupported browsers, and sandboxed frames retain the
  // self-contained graph without attempting to install a worker for that mount.
  try {
    if (!/^[a-f0-9]{64}$/.test(build || '') || !/^https?:$/.test(location.protocol) ||
        window.top !== window || !window.isSecureContext || !navigator.serviceWorker) {
      unavailable = true;
      help.textContent = 'This browser view uses local pinned data. For reliable offline launches, open the hosted site in Safari or Chrome, wait for Offline ready, then install it.';
      render();
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadOnChange) location.reload();
      else refresh(); // Other open tabs keep their complete, internally consistent snapshot.
    });
    render();
    navigator.serviceWorker.register(new URL('./sw.js', location.href), { scope: './', updateViaCache: 'none' })
      .then(value => {
        registration = value;
        showUpdate();
        refresh();
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') { showUpdate(); refresh(); }
            if (installing.state === 'redundant' && !registration.active) {
              unavailable = true;
              help.textContent = 'Offline download failed. Reconnect and reload to retry. The graph remains available in this tab.';
              render();
            }
          });
        });
        checkUpdate();
      }).catch(() => {
        unavailable = true;
        help.textContent = 'Offline installation is unavailable in this browser view. The open graph still uses local pinned data.';
        render();
      });
  } catch {
    unavailable = true;
    help.textContent = 'Offline storage is unavailable in this preview. Use the hosted site to install the app.';
    render();
  }
}
