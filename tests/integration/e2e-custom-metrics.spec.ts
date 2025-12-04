import { expect, test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Custom Metrics Tests', () => {
  test.describe('Performance test with custom metrics', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should track custom marks and measures', async ({ page, performance }) => {
      await page.goto(scenario('basic-profiler'));
      await performance.init();

      // Record custom performance marks
      performance.mark('operation-start');

      // Simulate some work with a timeout
      await page.waitForTimeout(50);

      performance.mark('operation-end');

      // Create a measure between the marks
      const duration = performance.measure(
        'operation-duration',
        'operation-start',
        'operation-end',
      );

      // Verify the measure was recorded and duration is reasonable
      expect(duration).toBeGreaterThanOrEqual(45); // Allow some timing variance
      expect(duration).toBeLessThan(200);

      // Verify custom metrics are captured
      const customMetrics = performance.getCustomMetrics();
      expect(customMetrics.marks).toHaveLength(2);
      expect(customMetrics.measures).toHaveLength(1);
      expect(customMetrics.marks[0].name).toBe('operation-start');
      expect(customMetrics.marks[1].name).toBe('operation-end');
      expect(customMetrics.measures[0].name).toBe('operation-duration');
      expect(customMetrics.measures[0].startMark).toBe('operation-start');
      expect(customMetrics.measures[0].endMark).toBe('operation-end');
    });
  });

  test.describe('Performance test with multiple custom measures', () => {
    test.performance({
      warmup: false,
      throttleRate: 1,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })('should track multiple measures for different operations', async ({ page, performance }) => {
      await page.goto(scenario('basic-profiler'));
      await performance.init();

      // Track multiple operations
      performance.mark('fetch-start');
      await page.waitForTimeout(30);
      performance.mark('fetch-end');

      performance.mark('render-start');
      await page.waitForTimeout(20);
      performance.mark('render-end');

      // Create measures for each operation
      const fetchDuration = performance.measure('fetch-data', 'fetch-start', 'fetch-end');
      const renderDuration = performance.measure('render-ui', 'render-start', 'render-end');
      const totalDuration = performance.measure('total', 'fetch-start', 'render-end');

      // Verify all measures were recorded
      const customMetrics = performance.getCustomMetrics();
      expect(customMetrics.marks).toHaveLength(4);
      expect(customMetrics.measures).toHaveLength(3);

      // Verify durations are reasonable
      expect(fetchDuration).toBeGreaterThanOrEqual(25);
      expect(renderDuration).toBeGreaterThanOrEqual(15);
      expect(totalDuration).toBeGreaterThanOrEqual(fetchDuration + renderDuration - 10);
    });
  });
});
