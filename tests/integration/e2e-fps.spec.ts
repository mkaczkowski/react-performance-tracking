import { test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E FPS Tests', () => {
  test.describe('Performance test with FPS tracking', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          fps: { avg: 10 },
        },
      },
    })('should track FPS metrics', async ({ page, performance }) => {
      await page.goto(scenario('fps-animation'));
      await performance.init();

      // Wait to accumulate frames from the requestAnimationFrame animation
      await page.waitForTimeout(500);
    });
  });
});
