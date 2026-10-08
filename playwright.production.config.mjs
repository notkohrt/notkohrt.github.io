import { defineConfig } from '@playwright/test';
import development from './playwright.config.mjs';

const { webServer, ...base } = development;
export default defineConfig({
  ...base,
  timeout: 240000,
  expect: { timeout: 15000 },
  use: { ...base.use, baseURL: 'https://notkohrt.pro/' },
  projects: base.projects.map(project => ({
    ...project,
    testMatch: '**/production.spec.mjs',
    testIgnore: []
  }))
});
