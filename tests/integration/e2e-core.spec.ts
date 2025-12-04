import { expect, test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Core Performance Tests', () => {
  test.describe('Basic performance integration', () => {
    test('should capture performance state from test app', async ({ page, performance }) => {
      await page.goto(scenario('basic-profiler'));

      // Wait for performance store to be available
      await performance.waitForInitialization();

      // Verify performance store is accessible
      const hasProfiler = await page.evaluate(() => !!window.__REACT_PERFORMANCE__);
      expect(hasProfiler).toBe(true);
    });

    test('should reset performance state', async ({ page, performance }) => {
      await page.goto(scenario('basic-profiler'));

      await performance.waitForInitialization();

      // Trigger some renders
      await page.click('button[data-testid="update-btn"]');
      await page.waitForTimeout(100);

      // Verify we have samples
      const initialCount = await page.evaluate(() => window.__REACT_PERFORMANCE__?.samples.length);
      expect(initialCount).toBeGreaterThan(0);

      // Reset
      await performance.reset();

      // Verify reset
      const afterResetCount = await page.evaluate(
        () => window.__REACT_PERFORMANCE__?.samples.length,
      );
      expect(afterResetCount).toBe(0);
    });
  });

  test.describe('Performance test with thresholds', () => {
    test.performance({
      warmup: true,
      throttleRate: 4,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should pass with valid metrics', async ({ page, performance }) => {
      await page.goto(scenario('basic-profiler'));
      await performance.init();
    });
  });
});
