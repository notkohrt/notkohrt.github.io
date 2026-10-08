import { test, expect } from '@playwright/test';

// A file: navigation is distinct from serving a single HTML response. WebKit
// exercises Safari's file behavior; managed cloud Chromium blocks file: URLs.
// Neither engine simulates the iOS Files application's restricted preview.
test('Safari engine starts the downloaded HTML and supports mobile search and tracing without external assets', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  const url = new URL('../index.html', import.meta.url);
  url.searchParams.set('node', 'card:SHIV');
  await page.goto(url.href);
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await expect(page.locator('#loading-state')).toBeHidden();
  await expect(page.locator('#graph-canvas canvas')).toHaveCount(1);
  await expect(page.locator('.app-shell')).toHaveCSS('display', 'grid');
  await expect(page.locator('#entity-name')).toHaveText('Shiv');
  await page.getByRole('button', { name: 'Find a note', exact: true }).click();
  await page.getByRole('combobox', { name: 'Find a note' }).fill('Resonance');
  await page.locator('[role="option"][data-id="card:RESONANCE"]').click();
  await expect(page.locator('#entity-name')).toHaveText('Resonance');
  await page.locator('.relation-trace[data-edge-id="card:RESONANCE|power:STRENGTH_POWER|grants"]').click();
  await expect(page.locator('#connection-caption-text')).toHaveText('Resonance → grants → Strength');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
