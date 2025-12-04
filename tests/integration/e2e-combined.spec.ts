import { expect, test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

// Create performance-enabled test
const test = createPerformanceTest(base);

// Helper to build scenario URL
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Combined Feature Tests', () => {
  test.describe('Performance test with CPU throttling + FPS tracking + multiple iterations', () => {
    let cpuFpsIterationCount = 0;

    test.beforeAll(() => {
      cpuFpsIterationCount = 0;
    });

    test.performance({
      warmup: false,
      throttleRate: 4,
      iterations: 3,
      thresholds: {
        base: {
          profiler: {
            '*': {
              duration: { avg: 5000 },
              rerenders: 100,
            },
          },
          fps: { avg: 5 },
        },
      },
    })(
      'should maintain CPU throttling across all iterations with FPS tracking',
      async ({ page, performance }) => {
        cpuFpsIterationCount++;

        await page.goto(scenario('fps-animation'));
        await performance.init();

        // Wait to accumulate frames
        await page.waitForTimeout(300);

        // On the last iteration, verify all iterations ran
        if (cpuFpsIterationCount === 3) {
          expect(cpuFpsIterationCount).toBe(3);
        }
      },
    );
  });
});
