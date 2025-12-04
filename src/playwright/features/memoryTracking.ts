import type { CDPSession, Page } from '@playwright/test';

import { formatBytes, logger } from '../../utils';

import { featureRegistry } from './registry';
import type { CDPFeatureState, ResettableCDPFeatureHandle } from './types';
import { createResettableFeatureHandle, isCdpUnsupportedError } from './utils';

export { formatBytes } from '../../utils';

/** CDP metric names for memory tracking */
const JS_HEAP_USED_SIZE = 'JSHeapUsedSize';
const JS_HEAP_TOTAL_SIZE = 'JSHeapTotalSize';

/**
 * Raw metric from CDP Performance.getMetrics response.
 */
export interface CDPMetric {
  name: string;
  value: number;
}

/**
 * Memory snapshot from CDP Performance.getMetrics.
 * All sizes are in bytes.
 */
export interface MemorySnapshot {
  /** JS heap used size in bytes */
  jsHeapUsedSize: number;
  /** JS heap total size in bytes */
  jsHeapTotalSize: number;
  /** Timestamp when snapshot was taken (ms since epoch) */
  timestamp: number;
}

/**
 * Memory metrics calculated from before/after snapshots.
 */
export interface MemoryMetrics {
  /** Memory snapshot before test execution */
  before: MemorySnapshot;
  /** Memory snapshot after test execution */
  after: MemorySnapshot;
  /** Heap growth in bytes (after.jsHeapUsedSize - before.jsHeapUsedSize) */
  heapGrowth: number;
  /** Heap growth as percentage of initial heap */
  heapGrowthPercent: number;
}

/**
 * Handle for memory tracking feature.
 */
export interface MemoryTrackingHandle extends ResettableCDPFeatureHandle<MemoryMetrics> {
  /** Get the initial snapshot (useful for debugging) */
  getInitialSnapshot(): MemorySnapshot;
}

/**
 * Internal state for memory tracking.
 */
interface MemoryTrackingState extends CDPFeatureState {
  initialSnapshot: MemorySnapshot;
}

/**
 * Extracts memory-related metrics from CDP Performance.getMetrics response.
 */
export const extractMemoryMetrics = (metrics: CDPMetric[]): MemorySnapshot => {
  let jsHeapUsedSize = 0;
  let jsHeapTotalSize = 0;

  for (const metric of metrics) {
    if (metric.name === JS_HEAP_USED_SIZE) {
      jsHeapUsedSize = metric.value;
    } else if (metric.name === JS_HEAP_TOTAL_SIZE) {
      jsHeapTotalSize = metric.value;
    }
  }

  return {
    jsHeapUsedSize,
    jsHeapTotalSize,
    timestamp: Date.now(),
  };
};

/**
 * Calculates memory growth metrics from before/after snapshots.
 */
export const calculateMemoryGrowth = (
  before: MemorySnapshot,
  after: MemorySnapshot,
): MemoryMetrics => {
  const heapGrowth = after.jsHeapUsedSize - before.jsHeapUsedSize;

  // Calculate percentage growth relative to initial heap
  // Guard against division by zero
  const heapGrowthPercent =
    before.jsHeapUsedSize > 0 ? (heapGrowth / before.jsHeapUsedSize) * 100 : 0;

  return {
    before,
    after,
    heapGrowth,
    heapGrowthPercent: Math.round(heapGrowthPercent * 100) / 100,
  };
};

/**
 * Captures current memory snapshot via CDP Performance.getMetrics.
 */
export const captureMemorySnapshot = async (cdpSession: CDPSession): Promise<MemorySnapshot> => {
  const response = (await cdpSession.send('Performance.getMetrics')) as { metrics: CDPMetric[] };
  return extractMemoryMetrics(response.metrics);
};

/**
 * Memory Tracking feature implementation.
 * Uses CDP Performance.getMetrics to track heap usage.
 */
class MemoryTrackingFeature {
  readonly name = 'memory-tracking' as const;
  readonly requiresChromium = true as const;

  async start(page: Page): Promise<MemoryTrackingHandle | null> {
    try {
      const cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send('Performance.enable');
      const initialSnapshot = await captureMemorySnapshot(cdpSession);

      const state: MemoryTrackingState = {
        cdpSession,
        page,
        active: true,
        initialSnapshot,
      };

      logger.info(
        `Memory tracking enabled (initial heap: ${formatBytes(initialSnapshot.jsHeapUsedSize)})`,
      );

      const baseHandle = createResettableFeatureHandle(state, {
        onStop: async (s) => {
          const finalSnapshot = await captureMemorySnapshot(s.cdpSession);
          const metrics = calculateMemoryGrowth(s.initialSnapshot, finalSnapshot);

          try {
            await s.cdpSession.send('Performance.disable');
          } catch {
            // Ignore errors during cleanup
          }

          return metrics;
        },
        onReset: async (s) => {
          s.initialSnapshot = await captureMemorySnapshot(s.cdpSession);
        },
      });

      return {
        ...baseHandle,
        getInitialSnapshot: () => state.initialSnapshot,
      };
    } catch (error) {
      if (isCdpUnsupportedError(error)) {
        logger.warn('Memory tracking not supported on this browser (CDP not available)');
      } else {
        logger.warn('Memory tracking: failed to start:', error);
      }
      return null;
    }
  }
}

/**
 * Memory tracking feature instance.
 */
export const memoryTrackingFeature = new MemoryTrackingFeature();

featureRegistry.register(memoryTrackingFeature);
