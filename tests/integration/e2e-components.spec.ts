import { expect, test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Component Profiling Tests', () => {
  test.describe('Performance test with component profiling', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should capture per-component metrics', async ({ page, performance }) => {
      await page.goto(scenario('multi-component'));
      await performance.init();

      // Trigger some interactions to generate profiler data
      await page.click('button[data-testid="increment-btn"]');
      await page.click('button[data-testid="add-item-btn"]');
      await page.waitForTimeout(100);

      // Verify the store has multiple components
      const componentCount = await page.evaluate(
        () => Object.keys(window.__REACT_PERFORMANCE__?.components || {}).length,
      );
      expect(componentCount).toBe(2);

      // Verify component-specific metrics
      const counterMetrics = await page.evaluate(
        () => window.__REACT_PERFORMANCE__?.components['counter'],
      );
      expect(counterMetrics).toBeDefined();
      expect(counterMetrics?.renderCount).toBeGreaterThanOrEqual(1);

      const listMetrics = await page.evaluate(
        () => window.__REACT_PERFORMANCE__?.components['item-list'],
      );
      expect(listMetrics).toBeDefined();
      expect(listMetrics?.renderCount).toBeGreaterThanOrEqual(1);
    });
  });
});
