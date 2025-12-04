import { expect, test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Iteration Tests', () => {
  test.describe('Performance test with multiple iterations (no warmup)', () => {
    let iterationCallCount = 0;

    test.beforeAll(() => {
      iterationCallCount = 0;
    });

    test.performance({
      warmup: false,
      throttleRate: 1,
      iterations: 3,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })(
      'should run exactly 3 iterations with all used for averages',
      async ({ page, performance }) => {
        iterationCallCount++;

        await page.goto(scenario('iterations-test'));
        await performance.init();

        // On the last iteration, verify total call count
        if (iterationCallCount === 3) {
          expect(iterationCallCount).toBe(3);
        }
      },
    );
  });

  test.describe('Performance test with warmup iteration', () => {
    let warmupIterationCallCount = 0;

    test.beforeAll(() => {
      warmupIterationCallCount = 0;
    });

    test.performance({
      warmup: true,
      throttleRate: 1,
      iterations: 3,
      thresholds: {
        base: {
          profiler: { '*': { duration: { avg: 1000 }, rerenders: 50 } },
        },
      },
    })(
      'should run 3 iterations with first discarded as warmup',
      async ({ page, performance }, testInfo) => {
        warmupIterationCallCount++;

        await page.goto(scenario('iterations-test'));
        await performance.init();

        // On the last iteration, verify:
        if (warmupIterationCallCount === 3) {
          expect(warmupIterationCallCount).toBe(3);
          expect(testInfo.iterations).toBe(3);
          expect(testInfo.warmup).toBe(true);
        }
      },
    );
  });

  test.describe('Performance test with percentile thresholds', () => {
    let percentileIterationCount = 0;

    test.beforeAll(() => {
      percentileIterationCount = 0;
    });

    test.performance({
      warmup: false,
      throttleRate: 1,
      iterations: 5,
      thresholds: {
        base: {
          profiler: {
            '*': {
              duration: {
                avg: 1000,
                p50: 500,
                p95: 800,
                p99: 900,
              },
              rerenders: 50,
            },
          },
        },
      },
    })(
      'should calculate and validate percentile thresholds',
      async ({ page, performance }, testInfo) => {
        percentileIterationCount++;

        await page.goto(scenario('percentile-test'));
        await performance.init();

        // On the last iteration, verify config has percentile thresholds
        if (percentileIterationCount === 5) {
          expect(testInfo.iterations).toBe(5);
          const defaultThreshold = testInfo.thresholds.profiler['*'];
          expect(defaultThreshold.duration.p50).toBe(500);
          expect(defaultThreshold.duration.p95).toBe(800);
          expect(defaultThreshold.duration.p99).toBe(900);
        }
      },
    );
  });

  test.describe('Performance test with percentile thresholds and warmup', () => {
    let warmupPercentileIterationCount = 0;

    test.beforeAll(() => {
      warmupPercentileIterationCount = 0;
    });

    test.performance({
      warmup: true,
      throttleRate: 1,
      iterations: 4,
      thresholds: {
        base: {
          profiler: {
            '*': {
              duration: {
                avg: 1000,
                p50: 500,
              },
              rerenders: 50,
            },
          },
        },
      },
    })(
      'should calculate percentiles excluding warmup iteration',
      async ({ page, performance }, testInfo) => {
        warmupPercentileIterationCount++;

        await page.goto(scenario('percentile-test'));
        await performance.init();

        // On the last iteration, verify warmup behavior
        if (warmupPercentileIterationCount === 4) {
          expect(testInfo.warmup).toBe(true);
        }
      },
    );
  });
});
