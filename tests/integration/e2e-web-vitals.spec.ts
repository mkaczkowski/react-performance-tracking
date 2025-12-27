import { test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Web Vitals Tests', () => {
  test.describe('Performance test with web vitals tracking', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      iterations: 2,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          webVitals: {
            lcp: 10000, // Generous threshold to enable tracking
            inp: 1000,
            cls: 1.0,
          },
        },
      },
    })('should track web vitals metrics with real LCP', async ({ page, performance }) => {
      await page.goto(scenario('web-vitals'));
      await performance.init();

      // Click the button to trigger INP measurement
      await page.click('#click-me');

      // Wait for metrics to be captured
      await page.waitForTimeout(100);
    });
  });

  test.describe('Performance test with web vitals thresholds', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          webVitals: {
            lcp: 5000, // Generous LCP threshold for test
            inp: 500, // Generous INP threshold for test
            cls: 0.5, // Generous CLS threshold for test
          },
        },
      },
    })('should pass with web vitals below thresholds', async ({ page, performance }) => {
      await page.goto(scenario('web-vitals'));
      await performance.init();

      // Click to trigger INP measurement
      await page.click('#click-me');
      await page.waitForTimeout(50);
    });
  });

  test.describe('Performance test with TTFB and FCP thresholds', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          webVitals: {
            ttfb: 5000, // Generous TTFB threshold for test
            fcp: 5000, // Generous FCP threshold for test
          },
        },
      },
    })('should track TTFB and FCP metrics', async ({ page, performance }) => {
      await page.goto(scenario('web-vitals'));
      await performance.init();

      // Wait for metrics to be captured
      await page.waitForTimeout(100);
    });
  });

  test.describe('Performance test with all web vitals', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
          webVitals: {
            lcp: 10000,
            inp: 1000,
            cls: 1.0,
            ttfb: 5000,
            fcp: 5000,
          },
        },
      },
    })('should track all web vitals including TTFB and FCP', async ({ page, performance }) => {
      await page.goto(scenario('web-vitals'));
      await performance.init();

      // Click the button to trigger INP measurement
      await page.click('#click-me');
      await page.waitForTimeout(100);
    });
  });
});
