import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import development from './playwright.config.mjs';
import { readSiteOrigin } from './lib/site-origin.mjs';

const { webServer, ...base } = development;
export default defineConfig({
  ...base,
  timeout: 240000,
  expect: { timeout: 15000 },
  use: { ...base.use, baseURL: await readSiteOrigin(fileURLToPath(new URL('./', import.meta.url))) },
  projects: base.projects.map(project => ({
    ...project,
    testMatch: '**/production.spec.mjs',
    testIgnore: []
  }))
});
