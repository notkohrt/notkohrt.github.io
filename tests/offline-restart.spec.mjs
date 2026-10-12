import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { offlineServer } from './offline-fixture.mjs';

test('saved offline installation survives a browser restart with the origin server stopped', async ({ playwright, browserName }, info) => {
  test.setTimeout(60000);
  const profile = await mkdtemp(path.join(tmpdir(), 'sts2-offline-profile-'));
  const app = await offlineServer();
  let context;
  const launch = () => playwright[browserName].launchPersistentContext(profile, {
    ...info.project.use.launchOptions, headless: true, serviceWorkers: 'allow'
  });
  try {
    context = await launch();
    let page = await context.newPage();
    await page.goto(app.baseURL);
    await expect(page.locator('#offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
    await context.close();
    context = null;
    await app.stop();
    context = await launch();
    await context.setOffline(true);
    page = await context.newPage();
    const response = await page.goto(app.baseURL + '?node=card:SHIV');
    expect(response.fromServiceWorker()).toBe(true);
    await expect(page.locator('#dataset-status')).toHaveClass(/ready/);
    await expect(page.locator('#graph-canvas canvas')).toHaveCount(1);
    await expect(page.locator('#entity-name')).toHaveText('Shiv');
  } finally {
    await context?.close();
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
