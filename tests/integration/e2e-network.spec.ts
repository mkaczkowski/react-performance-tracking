import { test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Network Tests', () => {
  test.describe('Performance test with network throttling (preset)', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      networkThrottling: 'fast-3g',
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should apply fast-3g network throttling', async ({ page, performance }) => {
      await page.goto(scenario('network-throttling'));
      await performance.init();
    });
  });

  test.describe('Performance test with network throttling (custom)', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      networkThrottling: {
        latency: 200,
        downloadThroughput: (5 * 1024 * 1024) / 8, // 5 Mbps
        uploadThroughput: (2 * 1024 * 1024) / 8, // 2 Mbps
      },
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should apply custom network conditions', async ({ page, performance }) => {
      await page.goto(scenario('network-throttling'));
      await performance.init();
    });
  });
});
