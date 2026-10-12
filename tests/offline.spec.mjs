import { test as base, expect } from '@playwright/test';
import { offlineServer } from './offline-fixture.mjs';

const test = base.extend({
  app: async ({}, use) => {
    const app = await offlineServer();
    try { await use(app); } finally { await app.close(); }
  }
});
test.use({ serviceWorkers: 'allow' });
test.setTimeout(90000); // Multi-tab/update cases initialize several real WebGL graphs.

async function installed(page, url) {
  await page.goto(url);
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await expect(page.locator('#offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function find(page, name, id) {
  await page.getByRole('button', { name: 'Find a note', exact: true }).click();
  await page.getByRole('combobox', { name: 'Find a note' }).fill(name);
  await page.locator('[role="option"][data-id="' + id + '"]').click();
}

async function openControls(page) {
  const toggle = page.locator('#filters-toggle');
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

test('one online load supports a fresh offline launch, deep links, graph, inspector, filters and local analysis', async ({ page, context, app }) => {
  const errors = [], external = [];
  context.on('page', opened => opened.on('pageerror', error => errors.push(error.message)));
  context.on('request', request => { if (new URL(request.url()).origin !== new URL(app.baseURL).origin) external.push(request.url()); });
  await installed(page, app.baseURL);
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  const response = await offline.goto(app.baseURL + 'index.html?node=card:SHIV&offline-test=1');
  expect(response.fromServiceWorker()).toBe(true);
  await expect(offline.locator('#dataset-status')).toHaveClass(/ready/);
  // Chromium can reset navigator.onLine during a worker-backed navigation
  // while network requests remain blocked. Reapply the OS connection signal
  // after separately proving that the cold navigation came from the worker.
  await context.setOffline(false);
  await context.setOffline(true);
  await expect(offline.locator('#offline-status')).toContainText('Offline · v0.107.1');
  await expect(offline.locator('#offline-status')).toBeVisible();
  await expect(offline.locator('#graph-canvas canvas')).toHaveCount(1);
  await expect(offline.locator('#entity-name')).toHaveText('Shiv');
  await expect(offline.locator('#data-count')).toHaveText('1250 notes · 2170 links');
  const data = await offline.evaluate(async () => ({
    cards: (await (await fetch('./data/sts2/cards.json')).json()).length,
    meta: (await (await fetch('./data/sts2/meta.json')).json()).game_data_version,
    credits: (await (await fetch('./CREDITS.md')).text())
  }));
  expect(data.cards).toBe(577);
  expect(data.meta).toBe('0.107.1');
  expect(data.credits).toContain('Mega Crit');
  await find(offline, 'Resonance', 'card:RESONANCE');
  await offline.locator('.relation-trace[data-edge-id="card:RESONANCE|power:STRENGTH_POWER|grants"]').click();
  await expect(offline.locator('#connection-caption-text')).toHaveText('Resonance → grants → Strength');
  await openControls(offline);
  await offline.locator('#color-filter').selectOption('silent');
  await expect(offline.locator('#color-filter')).toHaveValue('silent');
  await offline.getByRole('button', { name: 'Reset', exact: true }).click();
  if (await offline.locator('#filters-close').isVisible()) await offline.locator('#filters-close').click();
  await offline.getByRole('button', { name: 'Deck', exact: true }).click();
  await offline.getByRole('button', { name: 'Load Silent example' }).click();
  await offline.getByLabel('First combo piece').selectOption('card:BLADE_DANCE');
  await offline.getByLabel('Second combo piece').selectOption('card:ACCURACY');
  await expect(offline.locator('#deck-pair-result')).toContainText('9.6%');
  await offline.getByRole('button', { name: 'Close deck lab' }).click();
  await offline.locator('.project-credit a').click();
  await expect(offline.locator('#online-notice')).toContainText('needs internet access');
  expect(new URL(offline.url()).origin).toBe(new URL(app.baseURL).origin);
  expect(await offline.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('missing browser storage is repaired from the exact pinned deployment on an online reload', async ({ page, app }) => {
  await installed(page, app.baseURL);
  await page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('sts2-stars:'));
    await (await caches.open(name)).delete(new URL('./data/sts2/cards.json', location.href));
  });
  await page.reload();
  await expect(page.locator('#offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  expect(await page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('sts2-stars:'));
    return Boolean(await (await caches.open(name)).match(new URL('./data/sts2/cards.json', location.href)));
  })).toBe(true);
});

test('a complete update waits for acceptance, applies offline, preserves deep links and leaves other tabs consistent', async ({ page, context, app }) => {
  await installed(page, app.baseURL + '?node=card:SHIV');
  const other = await context.newPage();
  await installed(other, app.baseURL + '?node=card:RESONANCE');
  const unrelated = 'sts2-stars:' + app.baseURL + 'other/:keep';
  await page.evaluate(name => caches.open(name), unrelated);
  app.state.version = 1;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)), { timeout: 20000 }).toBe(true);
  await expect(page.locator('#offline-status')).toContainText('Update ready · v0.107.1');
  await expect(page.locator('#entity-description')).toContainText('Deal 4 damage.');
  await context.setOffline(true);
  await openControls(page);
  await page.locator('#app-update').click();
  await expect(page.locator('#dataset-status')).toContainText('v0.107.2-test');
  await expect(page.locator('#entity-name')).toHaveText('Shiv');
  await expect(page.locator('#entity-description')).toContainText('Deal 5 damage.');
  expect(new URL(page.url()).searchParams.get('node')).toBe('card:SHIV');
  await expect(page.locator('#offline-status')).toHaveAttribute('data-state', 'ready');
  await expect(other.locator('#dataset-status')).toContainText('v0.107.1');
  await expect(other.locator('#offline-status')).toHaveAttribute('data-state', 'update');
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain(unrelated);
  expect(keys.filter(name => name.startsWith('sts2-stars:' + app.baseURL + ':'))).toHaveLength(1);
  await other.reload();
  await expect(other.locator('#dataset-status')).toContainText('v0.107.2-test');
  await expect(other.locator('#entity-name')).toHaveText('Resonance');
  await page.bringToFront();
  const meta = await page.evaluate(async () => (await (await fetch('./data/sts2/meta.json')).json()).game_data_version);
  expect(meta).toBe('0.107.2-test');
});

for (const failure of ['missing', 'mismatch']) {
  test('a ' + failure + ' update retains the previous complete offline app and recovers on retry', async ({ page, context, app }) => {
    await installed(page, app.baseURL + '?node=card:SHIV');
    app.state.version = 1;
    app.state.failure = failure;
    const outcome = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Update did not finish')), 20000);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker.addEventListener('statechange', () => {
            if (['redundant', 'installed'].includes(worker.state)) { clearTimeout(timer); resolve(worker.state); }
          });
        }, { once: true });
        registration.update().catch(reject);
      });
    });
    expect(outcome).toBe('redundant');
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(false);
    expect((await page.evaluate(() => caches.keys())).filter(name => name.startsWith('sts2-stars:'))).toHaveLength(1);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#dataset-status')).toContainText('v0.107.1');
    await expect(page.locator('#entity-description')).toContainText('Deal 4 damage.');
    app.state.failure = null;
    await context.setOffline(false);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)), { timeout: 20000 }).toBe(true);
  });
}

test('first-install download failure is visible and a successful reload repairs it', async ({ page, app }) => {
  app.state.failure = 'missing';
  await page.goto(app.baseURL);
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await expect(page.locator('#offline-status')).toHaveAttribute('data-state', 'unavailable', { timeout: 20000 });
  await expect(page.locator('#offline-help')).toContainText('failed');
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  app.state.failure = null;
  await installed(page, app.baseURL);
});

test('nested-path installation resolves local assets and offline deep links within its scope', async ({ page, context }) => {
  const app = await offlineServer('/reference/stars/');
  try {
    await installed(page, app.baseURL + '?node=card:SHIV');
    const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    await context.setOffline(true);
    const response = await page.goto(app.baseURL + '?node=card:RESONANCE&another=link');
    expect(response.fromServiceWorker()).toBe(true);
    await expect(page.locator('#entity-name')).toHaveText('Resonance');
    expect(app.state.requests.every(url => url.startsWith('/reference/stars/'))).toBe(true);
    expect(await page.evaluate(() => fetch('./icons/icon-512.png').then(response => response.ok))).toBe(true);
    expect(await page.evaluate(() => fetch('/outside-the-app').then(() => true, () => false))).toBe(false);
  } finally { await app.close(); }
});
