import type { Page } from '@playwright/test';

import { createCustomMetricsStore } from '../customMetrics';
import { createFeatureCoordination } from '../features';
import type { PerformanceFixture, WaitForStableOptions } from '../types';

import { resetProfiler, waitForInitialization, waitUntilStable } from './profilerOperations';

/**
 * Creates a performance instance for the given page.
 * Used internally by the performance fixture and createPerformanceTest.
 */
export function createPerformanceInstance(page: Page): PerformanceFixture['performance'] {
  const coordination = createFeatureCoordination();
  const customMetricsStore = createCustomMetricsStore();

  return {
    waitForInitialization: (timeout?: number) => waitForInitialization(page, timeout),

    waitUntilStable: (options?: WaitForStableOptions) => waitUntilStable(page, options),

    /**
     * Resets performance tracking to clear all collected samples.
     * Also resets all active tracking features and custom metrics to synchronize metrics.
     */
    reset: async () => {
      // Reset all active tracking features first to synchronize metrics
      await coordination.resetAllActive();
      // Reset custom metrics store
      customMetricsStore.reset();
      await resetProfiler(page);
    },

    /**
     * Common setup for performance tests.
     * Waits for performance store initialization and stability.
     *
     * Note: Navigation should be done before calling this method.
     */
    init: async () => {
      await waitForInitialization(page);
      await waitUntilStable(page);
    },

    setTrackingHandle: coordination.setHandle,

    mark: customMetricsStore.mark,

    measure: customMetricsStore.measure,

    getCustomMetrics: customMetricsStore.getMetrics,
  };
}

/**
 * Playwright fixture that provides performance utilities for performance testing.
 * Can be used standalone or composed with other fixtures.
 *
 * @example
 * ```typescript
 * import { test as base } from '@playwright/test';
 * import { performanceFixture } from 'react-performance-tracking/playwright';
 *
 * export const test = base.extend({
 *   ...performanceFixture,
 * });
 * ```
 */
export const performanceFixture = {
  performance: async (
    { page }: { page: Page },
    use: (performance: PerformanceFixture['performance']) => Promise<void>,
  ) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- 'use' is Playwright's fixture function, not a React hook
    await use(createPerformanceInstance(page));
  },
};
