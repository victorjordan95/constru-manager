import { defineConfig } from '@playwright/test';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'e2e',
      testMatch: '**/specs/*.spec.ts',
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev -- --mode e2e',
    url: 'http://localhost:5173',
    cwd: path.join(rootDir, 'client'),
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
