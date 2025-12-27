import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertCLSThreshold,
  assertINPThreshold,
  assertLCPThreshold,
} from '@lib/playwright/assertions/validators';
import {
  captureWebVitals,
  ensureWebVitalsInitialized,
  hasWebVitalsData,
  injectWebVitalsObserver,
  isWebVitalsInitialized,
  resetWebVitals,
  type WebVitalsMetrics,
} from '@lib/playwright/webVitals';

import { createMockPage } from '../../../mocks/playwrightMocks';

describe('webVitalsTracking', () => {
  let mockPage: Page;

  beforeEach(() => {
    mockPage = createMockPage();
  });

  describe('injectWebVitalsObserver', () => {
    it('should inject the web vitals observer script using addInitScript', async () => {
      await injectWebVitalsObserver(mockPage);

      expect(mockPage.addInitScript).toHaveBeenCalledTimes(1);
      expect(mockPage.addInitScript).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should pass a function that sets up PerformanceObservers', async () => {
      await injectWebVitalsObserver(mockPage);

      // The function is passed to addInitScript - we verify it's a function
      // Actual PerformanceObserver setup is tested via E2E tests
      const injectedFn = vi.mocked(mockPage.addInitScript).mock.calls[0][0];
      expect(typeof injectedFn).toBe('function');
    });
  });

  describe('ensureWebVitalsInitialized', () => {
    it('should not inject when already initialized', async () => {
      // First call returns true (initialized)
      vi.mocked(mockPage.evaluate).mockResolvedValueOnce(true);

      await ensureWebVitalsInitialized(mockPage);

      // Only one evaluate call to check initialization
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should inject when not initialized', async () => {
      // First call returns false (not initialized), then undefined (injection call)
      vi.mocked(mockPage.evaluate).mockResolvedValueOnce(false).mockResolvedValueOnce(undefined);

      await ensureWebVitalsInitialized(mockPage);

      // Two evaluate calls: check + inject
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });
  });

  describe('captureWebVitals', () => {
    it('should capture all web vitals metrics', async () => {
      const mockWebVitals: WebVitalsMetrics = {
        lcp: 1500,
        inp: 100,
        cls: 0.05,
        ttfb: 400,
        fcp: 900,
      };

      vi.mocked(mockPage.evaluate).mockResolvedValue(mockWebVitals);

      const result = await captureWebVitals(mockPage);

      expect(result).toEqual(mockWebVitals);
    });

    it('should return null when web vitals store is not initialized', async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValue(null);

      const result = await captureWebVitals(mockPage);

      expect(result).toBeNull();
    });

    it('should return metrics with null values when no events captured', async () => {
      const mockWebVitals: WebVitalsMetrics = {
        lcp: null,
        inp: null,
        cls: null,
        ttfb: null,
        fcp: null,
      };

      vi.mocked(mockPage.evaluate).mockResolvedValue(mockWebVitals);

      const result = await captureWebVitals(mockPage);

      expect(result).toEqual(mockWebVitals);
    });

    it('should handle partial metrics (only LCP captured)', async () => {
      const mockWebVitals: WebVitalsMetrics = {
        lcp: 2000,
        inp: null,
        cls: null,
        ttfb: null,
        fcp: null,
      };

      vi.mocked(mockPage.evaluate).mockResolvedValue(mockWebVitals);

      const result = await captureWebVitals(mockPage);

      expect(result).toEqual(mockWebVitals);
      expect(result?.lcp).toBe(2000);
      expect(result?.inp).toBeNull();
      expect(result?.cls).toBeNull();
    });
  });

  describe('resetWebVitals', () => {
    it('should reset web vitals values', async () => {
      await resetWebVitals(mockPage);

      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });
  });

  describe('isWebVitalsInitialized', () => {
    it('should return true when initialized', async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValue(true);

      const result = await isWebVitalsInitialized(mockPage);

      expect(result).toBe(true);
    });

    it('should return false when not initialized', async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValue(false);

      const result = await isWebVitalsInitialized(mockPage);

      expect(result).toBe(false);
    });
  });

  describe('hasWebVitalsData', () => {
    it('should return true when LCP is present', () => {
      const metrics: WebVitalsMetrics = { lcp: 1500, inp: null, cls: null, ttfb: null, fcp: null };
      expect(hasWebVitalsData(metrics)).toBe(true);
    });

    it('should return true when INP is present', () => {
      const metrics: WebVitalsMetrics = { lcp: null, inp: 100, cls: null, ttfb: null, fcp: null };
      expect(hasWebVitalsData(metrics)).toBe(true);
    });

    it('should return true when CLS is present', () => {
      const metrics: WebVitalsMetrics = { lcp: null, inp: null, cls: 0.05, ttfb: null, fcp: null };
      expect(hasWebVitalsData(metrics)).toBe(true);
    });

    it('should return true when all metrics are present', () => {
      const metrics: WebVitalsMetrics = { lcp: 1500, inp: 100, cls: 0.05, ttfb: 400, fcp: 900 };
      expect(hasWebVitalsData(metrics)).toBe(true);
    });

    it('should return false when all metrics are null', () => {
      const metrics: WebVitalsMetrics = { lcp: null, inp: null, cls: null, ttfb: null, fcp: null };
      expect(hasWebVitalsData(metrics)).toBe(false);
    });

    it('should return false when metrics is null', () => {
      expect(hasWebVitalsData(null)).toBe(false);
    });
  });
});

describe('webVitals validators', () => {
  describe('assertLCPThreshold', () => {
    it('should pass when LCP is below threshold', () => {
      expect(() =>
        assertLCPThreshold({
          actual: 2000,
          threshold: 2500,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when LCP exceeds threshold', () => {
      expect(() =>
        assertLCPThreshold({
          actual: 4000,
          threshold: 2500,
          bufferPercent: 20,
        }),
      ).toThrow();
    });
  });

  describe('assertINPThreshold', () => {
    it('should pass when INP is below threshold', () => {
      expect(() =>
        assertINPThreshold({
          actual: 100,
          threshold: 200,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when INP exceeds threshold', () => {
      expect(() =>
        assertINPThreshold({
          actual: 500,
          threshold: 200,
          bufferPercent: 20,
        }),
      ).toThrow();
    });
  });

  describe('assertCLSThreshold', () => {
    it('should pass when CLS is below threshold', () => {
      expect(() =>
        assertCLSThreshold({
          actual: 0.05,
          threshold: 0.1,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when CLS exceeds threshold', () => {
      expect(() =>
        assertCLSThreshold({
          actual: 0.3,
          threshold: 0.1,
          bufferPercent: 20,
        }),
      ).toThrow();
    });
  });
});
