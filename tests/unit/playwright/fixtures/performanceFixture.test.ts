import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPerformanceInstance,
  performanceFixture,
} from '@lib/playwright/fixtures/performanceFixture';

import { createMockPage } from '../../../mocks/playwrightMocks';

describe('performanceFixture', () => {
  let mockPage: Page;

  beforeEach(() => {
    mockPage = createMockPage();
  });

  describe('createPerformanceInstance', () => {
    it('should return an object with all required methods', () => {
      const performance = createPerformanceInstance(mockPage);

      expect(performance).toHaveProperty('waitForInitialization');
      expect(performance).toHaveProperty('waitUntilStable');
      expect(performance).toHaveProperty('reset');
      expect(performance).toHaveProperty('init');
      expect(performance).toHaveProperty('setTrackingHandle');
      expect(performance).toHaveProperty('mark');
      expect(performance).toHaveProperty('measure');
      expect(performance).toHaveProperty('getCustomMetrics');
    });

    it('should have callable methods', () => {
      const performance = createPerformanceInstance(mockPage);

      expect(typeof performance.waitForInitialization).toBe('function');
      expect(typeof performance.waitUntilStable).toBe('function');
      expect(typeof performance.reset).toBe('function');
      expect(typeof performance.init).toBe('function');
      expect(typeof performance.setTrackingHandle).toBe('function');
      expect(typeof performance.mark).toBe('function');
      expect(typeof performance.measure).toBe('function');
      expect(typeof performance.getCustomMetrics).toBe('function');
    });

    describe('init', () => {
      it('should call waitForInitialization and waitUntilStable', async () => {
        const performance = createPerformanceInstance(mockPage);

        await performance.init();

        // waitForInitialization uses waitForFunction
        expect(mockPage.waitForFunction).toHaveBeenCalled();
      });
    });

    describe('reset', () => {
      it('should call page.evaluate to reset profiler', async () => {
        // Reset needs the profiler store to be available
        vi.mocked(mockPage.evaluate).mockResolvedValueOnce(true);
        const performance = createPerformanceInstance(mockPage);

        await performance.reset();

        expect(mockPage.evaluate).toHaveBeenCalled();
      });
    });

    describe('mark', () => {
      it('should record a performance mark', () => {
        const performance = createPerformanceInstance(mockPage);

        performance.mark('test-mark');

        // Mark is stored internally - verify getCustomMetrics returns it
        const metrics = performance.getCustomMetrics();
        expect(metrics.marks).toHaveLength(1);
        expect(metrics.marks[0].name).toBe('test-mark');
      });
    });

    describe('measure', () => {
      it('should record a performance measure between marks', () => {
        const performance = createPerformanceInstance(mockPage);

        performance.mark('start');
        performance.mark('end');
        const duration = performance.measure('test-measure', 'start', 'end');

        expect(typeof duration).toBe('number');
        const metrics = performance.getCustomMetrics();
        expect(metrics.measures).toHaveLength(1);
        expect(metrics.measures[0].name).toBe('test-measure');
      });
    });

    describe('getCustomMetrics', () => {
      it('should return empty arrays initially', () => {
        const performance = createPerformanceInstance(mockPage);

        const metrics = performance.getCustomMetrics();

        expect(metrics.marks).toEqual([]);
        expect(metrics.measures).toEqual([]);
      });
    });
  });

  describe('performanceFixture', () => {
    it('should have a performance property', () => {
      expect(performanceFixture).toHaveProperty('performance');
    });

    it('should call use with performance instance', async () => {
      const useFn = vi.fn();

      await performanceFixture.performance({ page: mockPage }, useFn);

      expect(useFn).toHaveBeenCalledTimes(1);
      expect(useFn).toHaveBeenCalledWith(
        expect.objectContaining({
          waitForInitialization: expect.any(Function),
          waitUntilStable: expect.any(Function),
          reset: expect.any(Function),
          init: expect.any(Function),
          setTrackingHandle: expect.any(Function),
          mark: expect.any(Function),
          measure: expect.any(Function),
          getCustomMetrics: expect.any(Function),
        }),
      );
    });
  });
});
