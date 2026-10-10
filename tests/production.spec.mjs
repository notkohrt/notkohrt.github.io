import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';
import { validateModel } from '../lib/validate-model.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedHash = hash(await readFile(new URL('../index.html', import.meta.url)));
const expectedImageHash = hash(await readFile(new URL('../docs/assets/sts2-neow.webp', import.meta.url)));
const model = validateModel(await loadSnapshot());
test.use({ viewport: { width: 390, height: 844 } });

test('the live site serves this build and supports mobile search and relationship tracing', async ({ page, request, baseURL }) => {
  expect(model.errors).toEqual([]);
  const origin = new URL(baseURL).origin;
  let attempt = 0;
  // Pages deployment and edge caches update asynchronously. Poll an exact
  // content hash with a fresh URL; never accept the previously deployed site.
  await expect.poll(async () => {
    const url = new URL(baseURL);
    url.searchParams.set('verify', expectedHash.slice(0, 12) + '-' + ++attempt);
    try {
      const response = await request.get(url.href, { timeout: 15000 });
      try {
        if (new URL(response.url()).origin !== origin) return 'Unexpected destination origin';
        return response.ok() ? hash(await response.body()) : 'HTTP ' + response.status();
      } finally {
        await response.dispose();
      }
    } catch (error) {
      return 'Request unavailable: ' + error.name;
    }
  }, { timeout: 180000, intervals: [1000, 2000, 5000, 10000], message: 'Live HTML must match the checked-out, pinned build' }).toBe(expectedHash);

  const errors = [], runtimeRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => {
    if (['script', 'stylesheet', 'fetch', 'xhr'].includes(req.resourceType())) runtimeRequests.push(req.url());
  });
  const url = new URL(baseURL);
  url.searchParams.set('node', 'card:SHIV');
  url.searchParams.set('verify', expectedHash.slice(0, 12) + '-browser');
  await page.goto(url.href);
  expect(new URL(page.url()).origin).toBe(origin);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', baseURL);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', baseURL);
  const imageURL = new URL('docs/assets/sts2-neow.webp', baseURL).href;
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', imageURL);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageURL);
  const imageResponse = await request.get(imageURL);
  try {
    expect(imageResponse.ok()).toBe(true);
    expect(new URL(imageResponse.url()).origin).toBe(origin);
    expect(imageResponse.headers()['content-type']).toMatch(/^image\/webp\b/);
    expect(hash(await imageResponse.body())).toBe(expectedImageHash);
  } finally {
    await imageResponse.dispose();
  }
  const alias = new URL(baseURL);
  alias.hostname = alias.hostname.startsWith('www.') ? alias.hostname.slice(4) : 'www.' + alias.hostname;
  const aliasResponse = await request.get(alias.href, { maxRedirects: 0 });
  try {
    expect([301, 302, 307, 308]).toContain(aliasResponse.status());
    expect(aliasResponse.headers().location).toBeTruthy();
    const destination = new URL(aliasResponse.headers().location, alias);
    expect(destination.origin).toBe(origin);
    expect(destination.pathname).toBe('/');
  } finally {
    await aliasResponse.dispose();
  }
  await expect(page.locator('.app-shell')).toHaveCSS('display', 'grid');
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await expect(page.locator('#loading-state')).toBeHidden();
  await expect(page.locator('#graph-canvas canvas')).toHaveCount(1);
  await expect(page.locator('#data-count')).toHaveText(model.nodes.length + ' notes · ' + model.edges.length + ' links');
  await expect(page.locator('#entity-name')).toHaveText('Shiv');
  await page.getByRole('button', { name: 'Find a note', exact: true }).click();
  await page.getByRole('combobox', { name: 'Find a note' }).fill('Resonance');
  await page.locator('[role="option"][data-id="card:RESONANCE"]').click();
  await expect(page.locator('#entity-name')).toHaveText('Resonance');
  await page.locator('.relation-trace[data-edge-id="card:RESONANCE|power:STRENGTH_POWER|grants"]').click();
  await expect(page.locator('#connection-caption-text')).toHaveText('Resonance → grants → Strength');
  await expect(page.locator('#connection-caption')).toBeVisible();
  await page.getByRole('button', { name: 'Deck', exact: true }).click();
  await page.getByRole('button', { name: 'Load Silent example' }).click();
  await expect(page.locator('#deck-size')).toHaveText('(20)');
  await page.getByLabel('First combo piece').selectOption('card:BLADE_DANCE');
  await page.getByLabel('Second combo piece').selectOption('card:ACCURACY');
  await expect(page.locator('#deck-pair-result')).toContainText('9.6%');
  await page.getByRole('button', { name: 'Close deck lab' }).click();
  expect(runtimeRequests).toEqual([]);
  expect(errors).toEqual([]);
});
