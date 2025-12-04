import { expect, test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Trace Export Tests', () => {
  test.describe('Performance test with trace export', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      exportTrace: true,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should export trace for flamegraph visualization', async ({ page, performance }) => {
      await page.goto(scenario('trace-export'));
      await performance.init();

      // Wait for animation to generate trace events
      await page.waitForTimeout(300);
    });

    test.performance({
      warmup: false,
      throttleRate: 1,
      exportTrace: '/tmp/custom-trace-path.json',
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should export trace to custom path', async ({ page, performance }, testInfo) => {
      await page.goto(scenario('trace-export'));
      await performance.init();

      // Verify the custom path is configured
      expect(testInfo.exportTrace.enabled).toBe(true);
      expect(testInfo.exportTrace.outputPath).toBe('/tmp/custom-trace-path.json');
    });
  });
});
