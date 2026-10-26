import { defineConfig } from '@playwright/test';

const port = process.env.DN_TEST_PORT || '4175';
export default defineConfig({
  testDir: './e2e', timeout: 30000, fullyParallel: true, workers: 2,
  outputDir: '.verification/browser-results',
  reporter: [['list'], ['json', { outputFile: '.verification/browser-results.json' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce', screenshot: 'only-on-failure', launchOptions: { args: ['--no-sandbox'] } },
  webServer: { command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: { DN_BROWSER_TEST: '1' },
    url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
});
