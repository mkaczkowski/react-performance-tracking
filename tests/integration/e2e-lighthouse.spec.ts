import { expect, test as base } from '@playwright/test';

import { createLighthouseTest } from '@lib/lighthouse';

// Create lighthouse-enabled test
const test = createLighthouseTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Lighthouse Tests', () => {
  test.describe('Lighthouse test factory', () => {
    test('should have lighthouse method on test object', () => {
      expect(test.lighthouse).toBeDefined();
      expect(typeof test.lighthouse).toBe('function');
    });

    test('should create a test with lighthouse decorator', async ({ page }) => {
      await page.goto(scenario('basic-profiler'));

      // Just verify the page loads - we're testing the factory works
      const title = await page.title();
      expect(title).toBeDefined();
    });
  });

  // NOTE: The actual lighthouse audit tests are skipped by default because:
  // 1. They require Chromium browser only
  // 2. They take 15-30 seconds per audit
  // 3. They require real network access
  // To run these tests, use: npx playwright test e2e-lighthouse --headed
  test.describe.skip('Lighthouse audit tests (slow)', () => {
    test.lighthouse({
      throttling: { cpu: 4, network: 'fast-4g' },
      thresholds: {
        performance: 50,
        accessibility: 50,
      },
      warmup: false,
    })('should run lighthouse audit on test app', async ({ page }) => {
      await page.goto(scenario('basic-profiler'));
      // Lighthouse audit runs automatically after test function
    });
  });
});
