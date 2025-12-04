import { describe, expect, it } from 'vitest';

import { PERFORMANCE_CONFIG } from '@lib/playwright/config/performanceConfig';

describe('PERFORMANCE_CONFIG', () => {
  describe('immutability', () => {
    it('should not allow modification of top-level properties', () => {
      const originalProfiler = PERFORMANCE_CONFIG.profiler;

      // Attempt to modify should be silently ignored in non-strict mode
      // or throw in strict mode. Either way, the value should remain unchanged.
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.profiler = { stabilityPeriodMs: 9999 };
      }).toThrow();

      expect(PERFORMANCE_CONFIG.profiler).toBe(originalProfiler);
    });

    it('should not allow modification of profiler properties', () => {
      const originalValue = PERFORMANCE_CONFIG.profiler.stabilityPeriodMs;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.profiler.stabilityPeriodMs = 9999;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.profiler.stabilityPeriodMs).toBe(originalValue);
    });

    it('should not allow modification of buffers properties', () => {
      const originalValue = PERFORMANCE_CONFIG.buffers.duration;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.buffers.duration = 99;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.buffers.duration).toBe(originalValue);
    });

    it('should not allow modification of nested webVitals buffers', () => {
      const originalValue = PERFORMANCE_CONFIG.buffers.webVitals.lcp;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.buffers.webVitals.lcp = 99;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.buffers.webVitals.lcp).toBe(originalValue);
    });

    it('should not allow modification of throttling properties', () => {
      const originalValue = PERFORMANCE_CONFIG.throttling.defaultRate;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.throttling.defaultRate = 99;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.throttling.defaultRate).toBe(originalValue);
    });

    it('should not allow modification of fps properties', () => {
      const originalValue = PERFORMANCE_CONFIG.fps.defaultThreshold;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.fps.defaultThreshold = 30;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.fps.defaultThreshold).toBe(originalValue);
    });

    it('should not allow modification of memory properties', () => {
      const originalValue = PERFORMANCE_CONFIG.memory.defaultThreshold;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.memory.defaultThreshold = 999;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.memory.defaultThreshold).toBe(originalValue);
    });

    it('should not allow modification of webVitals properties', () => {
      const originalValue = PERFORMANCE_CONFIG.webVitals.enabled;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.webVitals.enabled = true;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.webVitals.enabled).toBe(originalValue);
    });

    it('should not allow modification of iterations properties', () => {
      const originalValue = PERFORMANCE_CONFIG.iterations.defaultCount;

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.iterations.defaultCount = 10;
      }).toThrow();

      expect(PERFORMANCE_CONFIG.iterations.defaultCount).toBe(originalValue);
    });

    it('should not allow adding new properties', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        PERFORMANCE_CONFIG.newProperty = 'test';
      }).toThrow();
    });
  });

  describe('default values', () => {
    it('should have correct profiler defaults', () => {
      expect(PERFORMANCE_CONFIG.profiler.stabilityPeriodMs).toBe(1000);
      expect(PERFORMANCE_CONFIG.profiler.checkIntervalMs).toBe(100);
      expect(PERFORMANCE_CONFIG.profiler.maxWaitMs).toBe(5000);
      expect(PERFORMANCE_CONFIG.profiler.initializationTimeoutMs).toBe(10000);
    });

    it('should have correct buffer defaults', () => {
      expect(PERFORMANCE_CONFIG.buffers.duration).toBe(20);
      expect(PERFORMANCE_CONFIG.buffers.rerenders).toBe(20);
      expect(PERFORMANCE_CONFIG.buffers.fps).toBe(20);
      expect(PERFORMANCE_CONFIG.buffers.heapGrowth).toBe(20);
    });

    it('should have correct web vitals buffer defaults', () => {
      expect(PERFORMANCE_CONFIG.buffers.webVitals.lcp).toBe(20);
      expect(PERFORMANCE_CONFIG.buffers.webVitals.inp).toBe(20);
      expect(PERFORMANCE_CONFIG.buffers.webVitals.cls).toBe(20);
    });

    it('should have correct throttling defaults', () => {
      expect(PERFORMANCE_CONFIG.throttling.defaultRate).toBe(1);
    });

    it('should have correct fps defaults', () => {
      expect(PERFORMANCE_CONFIG.fps.defaultThreshold).toBe(60);
    });

    it('should have correct memory defaults', () => {
      expect(PERFORMANCE_CONFIG.memory.defaultThreshold).toBe(0);
    });

    it('should have correct web vitals defaults', () => {
      expect(PERFORMANCE_CONFIG.webVitals.enabled).toBe(false);
    });

    it('should have correct iteration defaults', () => {
      expect(PERFORMANCE_CONFIG.iterations.defaultCount).toBe(1);
    });
  });

  describe('isCI property', () => {
    it('should return boolean based on CI environment variable', () => {
      // isCI is a getter that checks process.env.CI
      expect(typeof PERFORMANCE_CONFIG.isCI).toBe('boolean');
    });
  });
});
