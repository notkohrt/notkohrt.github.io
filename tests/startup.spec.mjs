import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const index = new URL('../index.html', import.meta.url);
test.use({ viewport: { width: 390, height: 844 } });

test('a preview that does not run JavaScript shows browser guidance instead of a fake loading spinner', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.setContent(await readFile(index, 'utf8'));
    await expect(page.locator('#loading-title')).toHaveText('Open the graph in a web browser');
    await expect(page.locator('#startup-help')).toContainText('Files preview');
    await expect(page.locator('#startup-help')).toContainText('Safari');
    await expect(page.locator('#startup-help')).toBeVisible();
    await expect(page.locator('#loading-spinner')).toBeHidden();
    await expect(page.locator('#loading-state')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#graph-canvas canvas')).toHaveCount(0);
    expect(await page.locator('#startup-help').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  } finally {
    await context.close();
  }
});

test('the app starts when its module executes after DOMContentLoaded has already fired', async ({ page }) => {
  const html = await readFile(index, 'utf8');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  await page.route('**/__late-start__', route => route.fulfill({
    contentType: 'text/html', body: html.replace(/<script type="module">[\s\S]*?<\/script>/, '')
  }));
  await page.goto('/__late-start__');
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await expect(page.locator('#loading-title')).toHaveText('Open the graph in a web browser');
  await page.addScriptTag({ type: 'module', content: script });
  await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
  await expect(page.locator('#loading-state')).toBeHidden();
  await expect(page.locator('#graph-canvas canvas')).toHaveCount(1);
});

test('an unavailable graph renderer stops loading and provides browser guidance', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/^(?:webgl2?|experimental-webgl)$/.test(type)) return null;
      return getContext.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#loading-title')).toHaveText('Graph could not start');
  await expect(page.locator('#dataset-status')).toHaveText('Graph unavailable');
  await expect(page.locator('#startup-help')).toBeVisible();
  await expect(page.locator('#loading-spinner')).toBeHidden();
  await expect(page.locator('#loading-state')).toHaveAttribute('aria-busy', 'false');
});
