import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const test = base.extend({
  page: async ({ page }, use) => {
    // Exercise the production HTML and real pinned libraries without requiring
    // external CDN availability or loading the optional third-party tooltip.
    for (const [url, file] of [
      ['https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js', '../node_modules/pixi.js/dist/pixi.min.js'],
      ['https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js', '../node_modules/d3/dist/d3.min.js']
    ]) {
      await page.route(url, route => route.fulfill({ path: fileURLToPath(new URL(file, import.meta.url)), contentType: 'text/javascript' }));
    }
    await page.route('https://spire-codex.com/**', route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  }
});

async function ready(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await expect(page.locator('#loading-state')).toBeHidden();
  await expect(page.locator('#graph-canvas canvas')).toHaveCount(1);
}

async function find(page, query, id) {
  await page.getByRole('button', { name: 'Find a note', exact: true }).click();
  await page.getByRole('combobox', { name: 'Find a note' }).fill(query);
  await page.locator('[role="option"][data-id="' + id + '"]').click();
  await expect(page.locator('#entity-name')).toBeFocused();
}

test('renders the graph and restores a shared note URL', async ({ page }) => {
  await ready(page, '/?node=card:SHIV');
  await expect(page.locator('#entity-name')).toHaveText('Shiv');
  await expect(page).toHaveTitle('Shiv — STS2 Bubble');
  await expect(page.locator('#data-count')).toHaveText(/\d+ notes · \d+ links/);
  await page.reload();
  await expect(page.locator('#entity-name')).toHaveText('Shiv');
});

test('quick switcher traps focus, exposes its active option, and Escape preserves selection', async ({ page }) => {
  await ready(page, '/?node=card:SHIV');
  await page.getByRole('button', { name: 'Find a note', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Find a note' });
  await expect(input).toBeFocused();
  await input.fill('Poison');
  await expect(input).toHaveAttribute('aria-activedescendant', 'palette-result-0');
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', 'palette-result-1');
  await input.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close quick switcher' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await input.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Find a note', exact: true })).toBeFocused();
  await expect(page.locator('#entity-name')).toHaveText('Shiv');
  expect(new URL(page.url()).searchParams.get('node')).toBe('card:SHIV');
});

test('quick switcher reveals a note outside the current character and local filters', async ({ page }) => {
  await ready(page);
  await page.locator('#color-filter').selectOption('silent');
  await page.getByRole('button', { name: 'Local', exact: true }).click();
  await find(page, 'Arsenal', 'card:ARSENAL');
  await expect(page.locator('#entity-name')).toHaveText('Arsenal');
  await expect(page.locator('#color-filter')).toHaveValue('all');
  await expect(page.locator('#local-mode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.depth-button').first()).toBeEnabled();
});

test('inspector links are usable with a keyboard and show actual vault paths', async ({ page }) => {
  await ready(page, '/?node=card:RUPTURE');
  const relation = page.locator('#outgoing-list button[data-target="power:STRENGTH_POWER"]');
  await relation.focus();
  await relation.press('Enter');
  await expect(page.locator('#entity-name')).toHaveText('Strength');
  await expect(page.locator('#entity-name')).toBeFocused();
  await expect(page.locator('#note-path')).toHaveText('Powers/Strength.md');
  await find(page, 'Defend', 'card:DEFEND_IRONCLAD');
  await expect(page.locator('#note-path')).toHaveText('Cards/Defend [DEFEND_IRONCLAD].md');
});

test('all backlinks remain reachable beyond the initial page', async ({ page }) => {
  await ready(page, '/?node=mechanic:BLOCK');
  const total = Number(await page.locator('#backlinks-count').innerText());
  expect(total).toBeGreaterThan(50);
  await expect(page.locator('#backlinks-list .relation')).toHaveCount(50);
  while (await page.locator('#backlinks-list .relations-more').count()) {
    await page.locator('#backlinks-list .relations-more').click();
  }
  await expect(page.locator('#backlinks-list .relation')).toHaveCount(total);
});

test('relationship filters and Reset keep inspector counts in sync', async ({ page }) => {
  await ready(page, '/?node=power:STRENGTH_POWER');
  const original = await page.locator('#backlinks-count').innerText();
  await page.locator('[data-relation-family="application"]').uncheck();
  await expect(page.locator('#backlinks-count')).not.toHaveText(original);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#backlinks-count')).toHaveText(original);
});

test('mobile note discovery and drawers preserve focus and selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.locator('#filters-panel')).toHaveJSProperty('inert', true);
  await expect(page.getByRole('button', { name: 'Find a note', exact: true })).toBeVisible();
  await find(page, 'Shiv', 'card:SHIV');
  await expect(page.locator('#inspector-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#inspector-panel')).toHaveJSProperty('inert', false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector-toggle')).toBeFocused();
  await expect(page.locator('#inspector-panel')).toHaveJSProperty('inert', true);
  expect(new URL(page.url()).searchParams.get('node')).toBe('card:SHIV');
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close controls' })).toBeFocused();
  await expect(page.locator('#filters-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#filters-toggle')).toBeFocused();
  await expect(page.locator('#filters-panel')).toHaveJSProperty('inert', true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('an invalid shared URL recovers to the global graph', async ({ page }) => {
  await ready(page, '/?node=card:DOES_NOT_EXIST');
  expect(new URL(page.url()).searchParams.has('node')).toBe(false);
  await expect(page.locator('#inspector-empty')).toBeVisible();
});

test('zero-cost cards can be filtered and upgrade values preserve their signs and keywords', async ({ page }) => {
  await ready(page);
  await page.locator('#cost-filter').selectOption('0');
  await expect(page.locator('#cost-filter')).toHaveValue('0');
  await find(page, 'Friendship', 'card:FRIENDSHIP');
  await expect(page.locator('#upgrade-card .upgrade-value')).toHaveText('-1');
  await find(page, 'Afterimage', 'card:AFTERIMAGE');
  await expect(page.locator('#upgrade-card .upgrade-value')).toHaveText('Innate');
});

test('missing snapshot metadata fails visibly instead of losing provenance silently', async ({ page }) => {
  await page.route('**/data/sts2/meta.json', route => route.fulfill({ status: 404, body: 'Missing snapshot' }));
  await page.goto('/');
  await expect(page.locator('#dataset-status')).toHaveText('Data unavailable');
  await expect(page.locator('#loading-state')).toContainText('/data/sts2/meta.json');
  await expect(page.locator('#loading-state')).toBeVisible();
});

test('settled graphs stop rebuilding edges and zoom still redraws the canvas', async ({ page }) => {
  await ready(page, '/?node=card:SHIV');
  await page.getByRole('button', { name: 'Local', exact: true }).click();
  await expect(page.locator('#physics-badge')).toHaveText('layout settled', { timeout: 15000 });
  const idleClears = await page.evaluate(async () => {
    const original = PIXI.Graphics.prototype.clear;
    let count = 0;
    PIXI.Graphics.prototype.clear = function (...args) { count += 1; return original.apply(this, args); };
    try {
      for (let frame = 0; frame < 5; frame += 1) await new Promise(requestAnimationFrame);
      return count;
    } finally { PIXI.Graphics.prototype.clear = original; }
  });
  expect(idleClears).toBe(0);
  const canvas = page.locator('#graph-canvas canvas');
  const before = await canvas.screenshot();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
});
