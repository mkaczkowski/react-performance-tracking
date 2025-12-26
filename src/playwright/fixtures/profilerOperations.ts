import type { Page } from '@playwright/test';

import { PERFORMANCE_CONFIG } from '../config/performanceConfig';
import { ProfilerErrorPhase, ProfilerStateError } from '../profiler/profilerStateError';
import type { WaitForStableOptions } from '../types';

/**
 * Waits for the performance store to be initialized on the window object.
 */
export const waitForInitialization = async (
  page: Page,
  timeout: number = PERFORMANCE_CONFIG.profiler.initializationTimeoutMs,
): Promise<void> => {
  try {
    await page.waitForFunction(() => window.__REACT_PERFORMANCE__ !== undefined, { timeout });
  } catch {
    throw new ProfilerStateError(
      `Performance store not initialized within ${timeout}ms. Ensure the page navigated correctly and performance tracking is enabled.`,
      ProfilerErrorPhase.INITIALIZATION,
      { timeout },
    );
  }
};

/**
 * Waits for the performance store to stabilize (no new samples being added).
 * This ensures all React updates have completed before proceeding.
 *
 * @param requireSamples - If false, allows zero samples (for Lighthouse-only tests)
 */
export const waitUntilStable = async (
  page: Page,
  {
    stabilityPeriodMs = PERFORMANCE_CONFIG.profiler.stabilityPeriodMs,
    checkIntervalMs = PERFORMANCE_CONFIG.profiler.checkIntervalMs,
    maxWaitMs = PERFORMANCE_CONFIG.profiler.maxWaitMs,
    requireSamples = true,
  }: WaitForStableOptions = {},
): Promise<void> => {
  try {
    await page.waitForFunction(
      ({ stabilityPeriod, needSamples }) => {
        const profiler = window.__REACT_PERFORMANCE__;
        if (!profiler) {
          return false;
        }

        // Initialize tracking on window object to persist across function calls
        if (!window.__REACT_PERFORMANCE_STABILITY_TRACKER__) {
          window.__REACT_PERFORMANCE_STABILITY_TRACKER__ = {
            lastCount: profiler.samples.length,
            lastChangeTime: Date.now(),
          };
          return false;
        }

        const tracker = window.__REACT_PERFORMANCE_STABILITY_TRACKER__;
        const currentCount = profiler.samples.length;

        if (currentCount !== tracker.lastCount) {
          tracker.lastCount = currentCount;
          tracker.lastChangeTime = Date.now();
          return false;
        }

        const timeSinceLastChange = Date.now() - tracker.lastChangeTime;
        // Allow zero samples when profiler isn't configured (e.g., Lighthouse-only tests)
        const hasSamples = needSamples ? currentCount > 0 : true;
        return timeSinceLastChange >= stabilityPeriod && hasSamples;
      },
      { stabilityPeriod: stabilityPeriodMs, needSamples: requireSamples },
      {
        timeout: maxWaitMs,
        polling: checkIntervalMs,
      },
    );
  } catch {
    throw new ProfilerStateError(
      `Performance data did not stabilize within ${maxWaitMs}ms. React may still be updating.`,
      ProfilerErrorPhase.STABILIZATION,
      { maxWaitMs, stabilityPeriodMs, checkIntervalMs },
    );
  } finally {
    try {
      await page.evaluate(() => {
        delete window.__REACT_PERFORMANCE_STABILITY_TRACKER__;
      });
    } catch {
      // Ignore cleanup errors (page may have navigated or closed)
    }
  }
};

/**
 * Resets the profiler store to clear all collected samples.
 *
 * @throws {ProfilerStateError} If the performance store is not available
 */
export const resetProfiler = async (page: Page): Promise<void> => {
  const wasReset = await page.evaluate(() => {
    const profiler = window.__REACT_PERFORMANCE__;
    if (!profiler) {
      return false;
    }
    profiler.reset();
    return true;
  });

  if (!wasReset) {
    throw new ProfilerStateError(
      'Cannot reset performance store: store not available. Ensure PerformanceProvider is mounted and page has loaded.',
      ProfilerErrorPhase.VALIDATION,
      { action: 'reset' },
    );
  }
};
