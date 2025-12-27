import type { Page } from '@playwright/test';

import { logger } from '../../utils';
import type { WebVitalsMetrics } from './types';

/**
 * Global store key for web vitals metrics.
 * Used consistently across all browser-side code.
 */
const WEB_VITALS_STORE_KEY = '__WEB_VITALS__';

/**
 * Type definition for the global web vitals store (browser-side).
 */
interface WebVitalsStore {
  lcp: number | null;
  inp: number | null;
  cls: number;
  ttfb: number | null;
  fcp: number | null;
  initialized: boolean;
}

declare global {
  interface Window {
    [WEB_VITALS_STORE_KEY]?: WebVitalsStore;
  }
}

/**
 * Browser-side script that initializes web vitals tracking.
 * This is a self-contained function that runs in the browser context.
 *
 * @returns The setup function to be injected into the page
 */
const createWebVitalsSetupScript = (): (() => void) => {
  return function setupWebVitals(): void {
    const STORE_KEY = '__WEB_VITALS__';

    // Type must be redefined since this runs in browser context
    interface BrowserWebVitalsStore {
      lcp: number | null;
      inp: number | null;
      cls: number;
      ttfb: number | null;
      fcp: number | null;
      initialized: boolean;
    }

    type WindowWithStore = Window & { [STORE_KEY]?: BrowserWebVitalsStore };

    // Check if already initialized
    const existingStore = (window as WindowWithStore)[STORE_KEY];
    if (existingStore?.initialized) {
      return;
    }

    // Initialize the store
    const store: BrowserWebVitalsStore = {
      lcp: null,
      inp: null,
      cls: 0,
      ttfb: null,
      fcp: null,
      initialized: true,
    };
    (window as WindowWithStore)[STORE_KEY] = store;

    // Check PerformanceObserver support
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('[WebVitals] PerformanceObserver not supported in this browser');
      return;
    }

    // LCP Observer - Largest Contentful Paint
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          store.lcp = lastEntry.renderTime ?? lastEntry.loadTime ?? null;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP not supported (e.g., Firefox) - silently ignore
    }

    // INP Observer - Interaction to Next Paint
    // Uses first-input with fallback to event timing
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & {
            processingStart: number;
            startTime: number;
          };
          const inputDelay = e.processingStart - e.startTime;
          if (store.inp === null || inputDelay > store.inp) {
            store.inp = inputDelay;
          }
        }
      }).observe({ type: 'first-input', buffered: true });
    } catch {
      // first-input not supported, try event timing as fallback
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (
              entry.name === 'pointerdown' ||
              entry.name === 'keydown' ||
              entry.name === 'click'
            ) {
              const e = entry as PerformanceEntry & {
                processingStart: number;
                startTime: number;
              };
              const inputDelay = e.processingStart - e.startTime;
              if (store.inp === null || inputDelay > store.inp) {
                store.inp = inputDelay;
              }
            }
          }
        }).observe({
          type: 'event',
          buffered: true,
          durationThreshold: 0,
        } as PerformanceObserverInit);
      } catch {
        // Event timing not supported - silently ignore
      }
    }

    // CLS Observer - Cumulative Layout Shift
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          // Only count shifts without recent user input
          if (!e.hadRecentInput) {
            store.cls += e.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // CLS not supported - silently ignore
    }

    // FCP Observer - First Contentful Paint
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            store.fcp = entry.startTime;
          }
        }
      }).observe({ type: 'paint', buffered: true });
    } catch {
      // paint entries not supported - silently ignore
    }

    // TTFB - Time to First Byte (from Navigation Timing API)
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const navEntry = navEntries[0] as PerformanceNavigationTiming;
        store.ttfb = navEntry.responseStart;
      }
    } catch {
      // Navigation Timing not supported - silently ignore
    }
  };
};

/**
 * Injects the web vitals observer script into the page using page.addInitScript().
 * This runs before any page scripts, which is optimal for capturing LCP.
 *
 * Must be called before page navigation for best results.
 * Safe to call multiple times - will not re-initialize if already present.
 *
 * @param page - Playwright page instance
 */
export const injectWebVitalsObserver = async (page: Page): Promise<void> => {
  await page.addInitScript(createWebVitalsSetupScript());
  logger.debug('Web vitals observer injected via addInitScript');
};

/**
 * Ensures web vitals tracking is initialized on the current page.
 * Call this if you need to initialize tracking after navigation
 * (e.g., when using page.setContent()).
 *
 * @param page - Playwright page instance
 */
export const ensureWebVitalsInitialized = async (page: Page): Promise<void> => {
  const isInitialized = await isWebVitalsInitialized(page);
  if (!isInitialized) {
    await page.evaluate(createWebVitalsSetupScript());
    logger.debug('Web vitals observer injected via page.evaluate (fallback)');
  }
};

/**
 * Captures the current web vitals metrics from the page.
 *
 * Note: Requires injectWebVitalsObserver() to have been called before navigation,
 * or ensureWebVitalsInitialized() to be called for pages created with setContent().
 *
 * @param page - Playwright page instance
 * @returns WebVitalsMetrics object, or null if tracking not initialized
 */
export const captureWebVitals = async (page: Page): Promise<WebVitalsMetrics | null> => {
  // First ensure tracking is initialized (handles setContent() edge case)
  await ensureWebVitalsInitialized(page);

  return page.evaluate((): WebVitalsMetrics | null => {
    const STORE_KEY = '__WEB_VITALS__';
    type WindowWithStore = Window & {
      [STORE_KEY]?: {
        lcp: number | null;
        inp: number | null;
        cls: number;
        ttfb: number | null;
        fcp: number | null;
        initialized: boolean;
      };
    };

    const store = (window as WindowWithStore)[STORE_KEY];

    if (!store?.initialized) {
      return null;
    }

    return {
      lcp: store.lcp,
      inp: store.inp,
      // Return null for cls if no shifts occurred (0 is the initial value)
      cls: store.cls > 0 ? store.cls : null,
      ttfb: store.ttfb,
      fcp: store.fcp,
    };
  });
};

/**
 * Resets web vitals metrics for multi-iteration support.
 * Keeps the observers active but clears collected values.
 *
 * @param page - Playwright page instance
 */
export const resetWebVitals = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const store = window.__WEB_VITALS__;
    if (store) {
      store.lcp = null;
      store.inp = null;
      store.cls = 0;
      store.ttfb = null;
      store.fcp = null;
    }
  });
  logger.debug('Web vitals metrics reset');
};

/**
 * Checks if web vitals tracking is initialized on the page.
 *
 * @param page - Playwright page instance
 * @returns true if initialized
 */
export const isWebVitalsInitialized = async (page: Page): Promise<boolean> => {
  return page.evaluate((): boolean => {
    const store = window.__WEB_VITALS__;
    return store?.initialized === true;
  });
};

/**
 * Type guard to check if web vitals metrics have any captured data.
 *
 * @param metrics - WebVitalsMetrics object or null
 * @returns true if at least one metric was captured
 */
export const hasWebVitalsData = (metrics: WebVitalsMetrics | null): metrics is WebVitalsMetrics => {
  if (!metrics) return false;
  return (
    metrics.lcp !== null ||
    metrics.inp !== null ||
    metrics.cls !== null ||
    metrics.ttfb !== null ||
    metrics.fcp !== null
  );
};
