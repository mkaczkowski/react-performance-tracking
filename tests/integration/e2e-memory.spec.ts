import { test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Memory Tests', () => {
  test.describe('Performance test with memory tracking', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          memory: { heapGrowth: 100 * 1024 * 1024 }, // 100MB - generous threshold to enable tracking
        },
      },
    })('should track memory metrics', async ({ page, performance }) => {
      await page.goto(scenario('memory-test'));
      await performance.init();
    });
  });

  test.describe('Performance test with memory threshold', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          memory: { heapGrowth: 50 * 1024 * 1024 }, // 50MB - generous threshold for test
        },
      },
    })('should pass with heap growth below threshold', async ({ page, performance }) => {
      await page.goto(scenario('memory-test'));
      await performance.init();
    });
  });
});
