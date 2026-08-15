import { defineConfig, devices } from '@playwright/test';

const productionPerformanceRun = process.env.PERF_ACCEPTANCE === '1';

export default defineConfig({
  testDir: './e2e',
  testIgnore: productionPerformanceRun ? [] : ['**/*.perf.spec.ts'],
  outputDir: 'test-results/artifacts',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: productionPerformanceRun
      ? 'pnpm exec vite preview --host 127.0.0.1 --port 4173'
      : 'pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
