import type { Page } from '@playwright/test';

import { logger } from '../../utils';
import type { ContainerType, LongTaskMetrics } from './types';

/**
 * Global store key for long task metrics.
 * NOTE: 50ms threshold is defined inline in browser scripts (cannot reference Node constants).
 */
const LONG_TASK_STORE_KEY = '__LONG_TASKS__';

/**
 * Type definition for stored long task entries.
 */
interface LongTaskStoreEntry {
  duration: number;
  startTime: number;
  containerType: ContainerType;
  containerId?: string;
  containerName?: string;
  containerSrc?: string;
}

/**
 * Type definition for the global long tasks store (browser-side).
 */
interface LongTaskStore {
  entries: LongTaskStoreEntry[];
  initialized: boolean;
}

declare global {
  interface Window {
    [LONG_TASK_STORE_KEY]?: LongTaskStore;
  }
}

/**
 * Browser-side script that initializes long task tracking.
 * Captures full attribution data for debugging.
 *
 * @returns The setup function to be injected into the page
 */
const createLongTaskSetupScript = (): (() => void) => {
  return function setupLongTasks(): void {
    const STORE_KEY = '__LONG_TASKS__';
    const THRESHOLD = 50;

    type BrowserContainerType = 'window' | 'iframe' | 'embed' | 'object';

    interface BrowserLongTaskEntry {
      duration: number;
      startTime: number;
      containerType: BrowserContainerType;
      containerId?: string;
      containerName?: string;
      containerSrc?: string;
    }

    interface BrowserLongTaskStore {
      entries: BrowserLongTaskEntry[];
      initialized: boolean;
    }

    type WindowWithStore = Window & { [STORE_KEY]?: BrowserLongTaskStore };

    // Check if already initialized
    const existingStore = (window as WindowWithStore)[STORE_KEY];
    if (existingStore?.initialized) {
      return;
    }

    // Initialize the store
    const store: BrowserLongTaskStore = {
      entries: [],
      initialized: true,
    };
    (window as WindowWithStore)[STORE_KEY] = store;

    // Check PerformanceObserver support
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('[LongTasks] PerformanceObserver not supported');
      return;
    }

    // Long Task Observer
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > THRESHOLD) {
            // Extract full attribution data
            const taskEntry = entry as PerformanceEntry & {
              attribution?: Array<{
                containerType?: string;
                containerId?: string;
                containerName?: string;
                containerSrc?: string;
              }>;
            };

            let containerType: BrowserContainerType = 'window';
            let containerId: string | undefined;
            let containerName: string | undefined;
            let containerSrc: string | undefined;

            if (taskEntry.attribution && taskEntry.attribution.length > 0) {
              const attr = taskEntry.attribution[0];
              containerType = (attr.containerType as BrowserContainerType) || 'window';
              containerId = attr.containerId || undefined;
              containerName = attr.containerName || undefined;
              containerSrc = attr.containerSrc || undefined;
            }

            store.entries.push({
              duration: entry.duration,
              startTime: entry.startTime,
              containerType,
              containerId,
              containerName,
              containerSrc,
            });
          }
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Task Observer not supported (Firefox, Safari)
      // Silently ignore - feature will report null metrics
    }
  };
};

/**
 * Injects the long task observer script into the page using page.addInitScript().
 * This runs before any page scripts, which is optimal for capturing early long tasks.
 *
 * Must be called before page navigation for best results.
 * Safe to call multiple times - will not re-initialize if already present.
 *
 * @param page - Playwright page instance
 */
export const injectLongTaskObserver = async (page: Page): Promise<void> => {
  await page.addInitScript(createLongTaskSetupScript());
  logger.debug('Long task observer injected via addInitScript');
};

/**
 * Ensures long task tracking is initialized on the current page.
 * Call this if you need to initialize tracking after navigation.
 *
 * @param page - Playwright page instance
 */
export const ensureLongTasksInitialized = async (page: Page): Promise<void> => {
  const isInitialized = await isLongTasksInitialized(page);
  if (!isInitialized) {
    await page.evaluate(createLongTaskSetupScript());
    logger.debug('Long task observer injected via page.evaluate (fallback)');
  }
};

/**
 * Captures long task metrics from the page.
 * Returns full attribution data for each task for debugging.
 *
 * @param page - Playwright page instance
 * @returns LongTaskMetrics object, or null if tracking not initialized or not supported
 */
export const captureLongTasks = async (page: Page): Promise<LongTaskMetrics | null> => {
  // First ensure tracking is initialized
  await ensureLongTasksInitialized(page);

  return page.evaluate((): LongTaskMetrics | null => {
    const STORE_KEY = '__LONG_TASKS__';
    const THRESHOLD = 50;

    type BrowserContainerType = 'window' | 'iframe' | 'embed' | 'object';

    interface StoredEntry {
      duration: number;
      startTime: number;
      containerType: BrowserContainerType;
      containerId?: string;
      containerName?: string;
      containerSrc?: string;
    }

    type WindowWithStore = Window & {
      [STORE_KEY]?: {
        entries: StoredEntry[];
        initialized: boolean;
      };
    };

    const store = (window as WindowWithStore)[STORE_KEY];

    if (!store?.initialized) {
      return null;
    }

    // Calculate TBT: sum of (duration - 50ms) for all long tasks
    let tbt = 0;
    let maxDuration = 0;

    for (const entry of store.entries) {
      const blockingTime = entry.duration - THRESHOLD;
      if (blockingTime > 0) {
        tbt += blockingTime;
      }
      if (entry.duration > maxDuration) {
        maxDuration = entry.duration;
      }
    }

    return {
      tbt,
      maxDuration,
      count: store.entries.length,
      entries: store.entries,
    };
  });
};

/**
 * Resets long task metrics for multi-iteration support.
 * Keeps the observers active but clears collected entries.
 *
 * @param page - Playwright page instance
 */
export const resetLongTasks = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const store = window.__LONG_TASKS__;
    if (store) {
      store.entries = [];
    }
  });
  logger.debug('Long task metrics reset');
};

/**
 * Checks if long task tracking is initialized on the page.
 *
 * @param page - Playwright page instance
 * @returns true if initialized
 */
export const isLongTasksInitialized = async (page: Page): Promise<boolean> => {
  return page.evaluate((): boolean => {
    const store = window.__LONG_TASKS__;
    return store?.initialized === true;
  });
};

/**
 * Type guard to check if long task metrics have any captured data.
 *
 * @param metrics - LongTaskMetrics object or null
 * @returns true if metrics were captured (count > 0 or initialized)
 */
export const hasLongTaskData = (metrics: LongTaskMetrics | null): metrics is LongTaskMetrics => {
  return metrics !== null;
};
