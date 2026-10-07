import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  // These tests exercise a real WebGL/force graph, including software rendering.
  // A single browser avoids competing for GPU resources on small CI machines.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8123',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
      args: ['--enable-unsafe-swiftshader']
    }
  },
  webServer: {
    command: 'python3 -m http.server 8123 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8123',
    reuseExistingServer: !process.env.CI
  }
});
