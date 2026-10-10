import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  }
});

async function openDeck(page) {
  const readingOnMobile = await page.locator('#inspector-panel').evaluate(el => innerWidth <= 900 && el.classList.contains('open'));
  const launcher = page.locator(readingOnMobile ? '#deck-note-open' : '#deck-toggle');
  await launcher.click();
  await expect(page.getByRole('dialog', { name: 'Deck lab' })).toBeVisible();
  return launcher;
}

async function ready(page, url = '/') {
  await page.goto(url);
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  expect(await page.locator('.topbar').evaluate(header => [...header.querySelectorAll('button')].every(button => {
    const box = button.getBoundingClientRect();
    if (button.disabled || !box.width || !box.height) return true;
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return box.left >= 0 && box.right <= innerWidth && (hit === button || button.contains(hit));
  }))).toBe(true);
  return openDeck(page);
}

test('sample deck gives exact pair odds, persists variants, and exports an Obsidian report', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Pointer activation need not focus buttons (as on Safari). Returning from
  // the dialog must still reach its actual launcher.
  await page.addInitScript(() => document.addEventListener('click', event => {
    if (event.target.closest('#deck-toggle, #deck-note-open')) document.activeElement?.blur();
  }, true));
  const launcher = await ready(page, '/?node=card:SHIV');
  await page.getByRole('button', { name: 'Load Silent example' }).click();
  await expect(page.locator('#deck-size')).toHaveText('(20)');
  await page.getByLabel('First combo piece').selectOption('card:BLADE_DANCE');
  await page.getByLabel('Second combo piece').selectOption('card:ACCURACY');
  await expect(page.locator('#deck-pair-result')).toContainText('9.6%');
  await expect(page.locator('#deck-odds tr').filter({ hasText: 'Blade Dance' })).toContainText('44.7%');
  const exportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Obsidian note' }).click();
  const download = await exportDownload;
  expect(download.suggestedFilename()).toBe('STS2 Stars Deck Analysis.md');
  const report = await readFile(await download.path(), 'utf8');
  expect(report).toContain('[[Cards/Blade Dance|Blade Dance]]');
  expect(report).toContain('**9.6%**');
  expect(report).toContain('4e6b0e040ccd00eb04fb1ab7fb0b298c222d2f29');
  expect(report).toContain('Innate');
  await page.keyboard.press('Escape');
  await expect(page.locator('#deck-lab')).not.toBeVisible();
  await expect(launcher).toBeFocused();
  expect(new URL(page.url()).searchParams.get('node')).toBe('card:SHIV');
  await page.reload();
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await openDeck(page);
  await expect(page.locator('#deck-size')).toHaveText('(20)');
  await expect(page.getByLabel('First combo piece')).toHaveValue('card:BLADE_DANCE');
  await expect(page.locator('#deck-pair-result')).toContainText('9.6%');
});

test('upgrade replacement costs and Star charges are visible and quantities validate without losing the deck', async ({ page }) => {
  await ready(page);
  await page.getByLabel('Find a card or relic').fill('Dark Embrace');
  await page.getByRole('button', { name: 'Add Dark Embrace (Ironclad)', exact: true }).click();
  await expect(page.locator('#deck-cards')).toContainText('2 Energy');
  await page.getByLabel('Upgraded Dark Embrace (Ironclad)', { exact: true }).check();
  await expect(page.locator('#deck-cards')).toContainText('1 Energy');
  const qty = page.getByLabel('Copies of Dark Embrace (Ironclad) upgraded', { exact: true });
  await qty.fill('100'); await qty.press('Tab');
  await expect(page.locator('#deck-message')).toContainText('whole number');
  await expect(qty).toHaveValue('1');
  await page.getByLabel('Find a card or relic').fill('Comet');
  await page.getByRole('button', { name: 'Add Comet (Regent)', exact: true }).click();
  await expect(page.locator('#deck-cards')).toContainText('0 Energy · 5 Stars');
  await page.locator('#deck-cards').getByRole('button', { name: /^Dark Embrace/ }).click();
  await expect(page.locator('#deck-lab')).not.toBeVisible();
  await expect(page.locator('#entity-name')).toBeFocused();
  await expect(page.locator('#upgrade-card')).toContainText('2 → 1');
});

test('mobile dialog contains focus, ignores graph hotkeys, and traces original mechanical evidence', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await ready(page);
  expect(await page.locator('#deck-lab').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press('Control+k');
  await expect(page.locator('#palette-backdrop')).toBeHidden();
  await page.getByRole('button', { name: 'Close deck lab' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('#deck-lab')))).toBe(true);
  await page.getByRole('button', { name: 'Load Silent example' }).click();
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(page.locator('#deck-analysis-title')).toBeFocused();
  expect(await page.locator('#deck-analysis-title').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.deck-lab-header').getBoundingClientRect().bottom)).toBe(true);
  const shivs = page.locator('.deck-mechanic').filter({ has: page.locator('summary>strong', { hasText: 'Shivs' }) });
  await shivs.locator(':scope > summary').click();
  const accuracy = shivs.locator('.deck-evidence').filter({ hasText: 'Accuracy ×1' });
  await accuracy.locator('summary').click();
  await accuracy.locator('[data-edge="card:ACCURACY|card:SHIV|modifies"]').click();
  await expect(page.locator('#deck-lab')).not.toBeVisible();
  await expect(page.locator('#connection-caption-text')).toHaveText('Accuracy → modifies → Shiv');
  expect(new URL(page.url()).searchParams.get('node')).toBe('card:ACCURACY');
});

test('portable page works with storage denied, rejects malformed imports, and round-trips deck JSON', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError'); } }));
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const requests = [];
  await page.route(/^https?:/, route => {
    if (route.request().isNavigationRequest() && new URL(route.request().url()).pathname === '/__deck-portable__') return route.fulfill({ body: html, contentType: 'text/html' });
    requests.push(route.request().url()); return route.abort();
  });
  await ready(page, '/__deck-portable__');
  await page.getByRole('button', { name: 'Load Silent example' }).click();
  await expect(page.locator('#deck-storage-help')).toContainText('cannot save');
  await page.locator('#deck-import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"entries":[{"id":"card:MISSING","count":1}]}') });
  await expect(page.locator('#deck-message')).toContainText('Import failed');
  await expect(page.locator('#deck-size')).toHaveText('(20)');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download deck JSON' }).click();
  const download = await event, content = await readFile(await download.path());
  await page.getByRole('button', { name: 'Clear deck' }).click();
  await expect(page.locator('#deck-size')).toHaveText('(0)');
  await page.locator('#deck-import-file').setInputFiles({ name: 'deck.json', mimeType: 'application/json', buffer: content });
  await expect(page.locator('#deck-size')).toHaveText('(20)');
  expect(requests).toEqual([]);
});

test('character census filters the picker by evidenced roles without adding pool cards to the deck', async ({ page }) => {
  await ready(page);
  await page.locator('.deck-pool > summary').click();
  await expect(page.locator('#deck-pool-summary')).toContainText('82 cards');
  await page.getByRole('button', { name: 'Find Discard enablers in Silent', exact: true }).click();
  await expect(page.locator('#deck-search-scope')).toContainText('Silent Discard enablers');
  await expect(page.locator('#deck-search-results [data-add]')).toHaveCount(8);
  await expect(page.locator('#deck-size')).toHaveText('(0)');
  await page.getByRole('button', { name: 'Add Prepared (Silent)', exact: true }).click();
  await expect(page.locator('#deck-size')).toHaveText('(1)');
  await page.getByRole('button', { name: 'Clear mechanic filter' }).click();
  await page.getByLabel('Character pool', { exact: true }).selectOption('regent');
  await expect(page.locator('#deck-pool-summary')).toContainText('18 cost 0 Energy; 9');
});
