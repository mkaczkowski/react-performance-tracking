import { describe, expect, it, vi } from 'vitest';
import {
  assertDurationThreshold,
  assertFPSThreshold,
  assertHeapGrowthThreshold,
  assertMaxTaskDurationThreshold,
  assertMemoizationEffectiveness,
  assertMinimumActivity,
  assertSampleCountThreshold,
  assertTaskCountThreshold,
  assertTBTThreshold,
} from '@lib/playwright/assertions/validators';

// Mock @playwright/test expect
vi.mock('@playwright/test', () => ({
  expect: vi.fn((value: unknown, message?: string) => {
    return {
      toBeGreaterThan: vi.fn((expected: number) => {
        if (typeof value !== 'number' || value <= expected) {
          throw new Error(message || `Expected ${value} to be greater than ${expected}`);
        }
      }),
      toBeGreaterThanOrEqual: vi.fn((expected: number) => {
        if (typeof value !== 'number' || value < expected) {
          throw new Error(
            message || `Expected ${value} to be greater than or equal to ${expected}`,
          );
        }
      }),
      toBeLessThan: vi.fn((expected: number) => {
        if (typeof value !== 'number' || value >= expected) {
          throw new Error(message || `Expected ${value} to be less than ${expected}`);
        }
      }),
      toBeLessThanOrEqual: vi.fn((expected: number) => {
        if (typeof value !== 'number' || value > expected) {
          throw new Error(message || `Expected ${value} to be less than or equal to ${expected}`);
        }
      }),
    };
  }),
}));

describe('validators', () => {
  describe('assertMinimumActivity', () => {
    it('should pass when sample count is greater than 0', () => {
      expect(() => assertMinimumActivity(1)).not.toThrow();
      expect(() => assertMinimumActivity(10)).not.toThrow();
    });

    it('should fail when sample count is 0', () => {
      expect(() => assertMinimumActivity(0)).toThrow();
    });
  });

  describe('assertDurationThreshold', () => {
    it('should pass when actual duration is below effective threshold', () => {
      expect(() =>
        assertDurationThreshold({
          actual: 100,
          threshold: 200,
          bufferPercent: 20,
          throttleRate: 4,
        }),
      ).not.toThrow();
    });

    it('should fail when actual duration exceeds effective threshold', () => {
      expect(() =>
        assertDurationThreshold({
          actual: 300,
          threshold: 200,
          bufferPercent: 20, // effective = 240
          throttleRate: 4,
        }),
      ).toThrow();
    });

    it('should calculate effective threshold correctly with buffer', () => {
      // threshold 100 + 20% buffer = 120
      // actual 119 should pass
      expect(() =>
        assertDurationThreshold({
          actual: 119,
          threshold: 100,
          bufferPercent: 20,
          throttleRate: 1,
        }),
      ).not.toThrow();

      // actual 121 should fail
      expect(() =>
        assertDurationThreshold({
          actual: 121,
          threshold: 100,
          bufferPercent: 20,
          throttleRate: 1,
        }),
      ).toThrow();
    });
  });

  describe('assertSampleCountThreshold', () => {
    it('should pass when sample count is at or below effective threshold', () => {
      expect(() =>
        assertSampleCountThreshold({
          actual: 10,
          threshold: 20,
          bufferPercent: 20,
        }),
      ).not.toThrow();

      // At exactly effective threshold (20 + 20% = 24)
      expect(() =>
        assertSampleCountThreshold({
          actual: 24,
          threshold: 20,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when sample count exceeds effective threshold', () => {
      expect(() =>
        assertSampleCountThreshold({
          actual: 30,
          threshold: 20,
          bufferPercent: 20, // effective = 24
        }),
      ).toThrow();
    });
  });

  describe('assertMemoizationEffectiveness', () => {
    it('should pass when actual duration is less than base duration', () => {
      expect(() => assertMemoizationEffectiveness(50, 100)).not.toThrow();
    });

    it('should pass when actual duration is within tolerance of base duration', () => {
      // base 100, tolerance = max(1, 100 * 0.05) = 5
      // actual can be up to 104.99
      expect(() => assertMemoizationEffectiveness(104, 100)).not.toThrow();
    });

    it('should fail when actual duration significantly exceeds base duration', () => {
      // base 100, tolerance = 5
      // actual 106 should fail
      expect(() => assertMemoizationEffectiveness(106, 100)).toThrow();
    });

    it('should use minimum tolerance of 1ms for small base durations', () => {
      // base 10, tolerance = max(1, 10 * 0.05) = max(1, 0.5) = 1
      expect(() => assertMemoizationEffectiveness(10.5, 10)).not.toThrow();
    });
  });

  describe('assertFPSThreshold', () => {
    it('should pass when actual FPS is above effective threshold', () => {
      // threshold 60 - 20% buffer = 48
      expect(() =>
        assertFPSThreshold({
          actual: 55,
          threshold: 60,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should pass when actual FPS equals effective threshold', () => {
      // threshold 60 - 20% buffer = 48
      expect(() =>
        assertFPSThreshold({
          actual: 48,
          threshold: 60,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when actual FPS is below effective threshold', () => {
      // threshold 60 - 20% buffer = 48
      expect(() =>
        assertFPSThreshold({
          actual: 40,
          threshold: 60,
          bufferPercent: 20,
        }),
      ).toThrow();
    });

    it('should calculate effective threshold correctly with buffer subtraction', () => {
      // threshold 100 - 10% buffer = 90
      // actual 89 should fail
      expect(() =>
        assertFPSThreshold({
          actual: 89,
          threshold: 100,
          bufferPercent: 10,
        }),
      ).toThrow();

      // actual 90 should pass
      expect(() =>
        assertFPSThreshold({
          actual: 90,
          threshold: 100,
          bufferPercent: 10,
        }),
      ).not.toThrow();
    });

    it('should handle zero buffer', () => {
      // threshold 60 - 0% = 60
      expect(() =>
        assertFPSThreshold({
          actual: 60,
          threshold: 60,
          bufferPercent: 0,
        }),
      ).not.toThrow();

      expect(() =>
        assertFPSThreshold({
          actual: 59,
          threshold: 60,
          bufferPercent: 0,
        }),
      ).toThrow();
    });
  });

  describe('assertHeapGrowthThreshold', () => {
    it('should pass when heap growth is below effective threshold', () => {
      // threshold 10MB + 20% buffer = 12MB
      expect(() =>
        assertHeapGrowthThreshold({
          actual: 5 * 1024 * 1024, // 5MB
          threshold: 10 * 1024 * 1024, // 10MB
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should pass when heap growth equals effective threshold', () => {
      // threshold 10MB + 20% buffer = 12MB
      expect(() =>
        assertHeapGrowthThreshold({
          actual: 12 * 1024 * 1024, // 12MB
          threshold: 10 * 1024 * 1024, // 10MB
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when heap growth exceeds effective threshold', () => {
      // threshold 10MB + 20% buffer = 12MB
      expect(() =>
        assertHeapGrowthThreshold({
          actual: 15 * 1024 * 1024, // 15MB
          threshold: 10 * 1024 * 1024, // 10MB
          bufferPercent: 20,
        }),
      ).toThrow();
    });

    it('should handle zero buffer', () => {
      // threshold 10MB + 0% = 10MB
      expect(() =>
        assertHeapGrowthThreshold({
          actual: 10 * 1024 * 1024, // 10MB exactly
          threshold: 10 * 1024 * 1024,
          bufferPercent: 0,
        }),
      ).not.toThrow();

      expect(() =>
        assertHeapGrowthThreshold({
          actual: 11 * 1024 * 1024, // 11MB
          threshold: 10 * 1024 * 1024,
          bufferPercent: 0,
        }),
      ).toThrow();
    });

    it('should handle negative heap growth (garbage collection)', () => {
      // Negative growth should always pass
      expect(() =>
        assertHeapGrowthThreshold({
          actual: -5 * 1024 * 1024, // -5MB (memory freed)
          threshold: 10 * 1024 * 1024,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });
  });

  describe('assertTBTThreshold', () => {
    it('should pass when TBT is below effective threshold', () => {
      // threshold 200ms + 20% buffer = 240ms
      expect(() =>
        assertTBTThreshold({
          actual: 100,
          threshold: 200,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should pass when TBT equals effective threshold', () => {
      // threshold 200ms + 20% buffer = 240ms
      expect(() =>
        assertTBTThreshold({
          actual: 240,
          threshold: 200,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when TBT exceeds effective threshold', () => {
      // threshold 200ms + 20% buffer = 240ms
      expect(() =>
        assertTBTThreshold({
          actual: 300,
          threshold: 200,
          bufferPercent: 20,
        }),
      ).toThrow();
    });

    it('should handle zero TBT', () => {
      expect(() =>
        assertTBTThreshold({
          actual: 0,
          threshold: 200,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should handle zero buffer', () => {
      expect(() =>
        assertTBTThreshold({
          actual: 200,
          threshold: 200,
          bufferPercent: 0,
        }),
      ).not.toThrow();

      expect(() =>
        assertTBTThreshold({
          actual: 201,
          threshold: 200,
          bufferPercent: 0,
        }),
      ).toThrow();
    });
  });

  describe('assertMaxTaskDurationThreshold', () => {
    it('should pass when max duration is below effective threshold', () => {
      // threshold 100ms + 20% buffer = 120ms
      expect(() =>
        assertMaxTaskDurationThreshold({
          actual: 80,
          threshold: 100,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should pass when max duration equals effective threshold', () => {
      // threshold 100ms + 20% buffer = 120ms
      expect(() =>
        assertMaxTaskDurationThreshold({
          actual: 120,
          threshold: 100,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when max duration exceeds effective threshold', () => {
      // threshold 100ms + 20% buffer = 120ms
      expect(() =>
        assertMaxTaskDurationThreshold({
          actual: 150,
          threshold: 100,
          bufferPercent: 20,
        }),
      ).toThrow();
    });

    it('should calculate effective threshold correctly with buffer', () => {
      // threshold 150ms + 10% buffer = 165ms
      expect(() =>
        assertMaxTaskDurationThreshold({
          actual: 165,
          threshold: 150,
          bufferPercent: 10,
        }),
      ).not.toThrow();

      expect(() =>
        assertMaxTaskDurationThreshold({
          actual: 166,
          threshold: 150,
          bufferPercent: 10,
        }),
      ).toThrow();
    });
  });

  describe('assertTaskCountThreshold', () => {
    it('should pass when task count is below effective threshold', () => {
      // threshold 5 + 20% buffer = 6
      expect(() =>
        assertTaskCountThreshold({
          actual: 3,
          threshold: 5,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should pass when task count equals effective threshold', () => {
      // threshold 5 + 20% buffer = 6
      expect(() =>
        assertTaskCountThreshold({
          actual: 6,
          threshold: 5,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should fail when task count exceeds effective threshold', () => {
      // threshold 5 + 20% buffer = 6
      expect(() =>
        assertTaskCountThreshold({
          actual: 10,
          threshold: 5,
          bufferPercent: 20,
        }),
      ).toThrow();
    });

    it('should handle zero task count', () => {
      expect(() =>
        assertTaskCountThreshold({
          actual: 0,
          threshold: 5,
          bufferPercent: 20,
        }),
      ).not.toThrow();
    });

    it('should handle zero buffer', () => {
      expect(() =>
        assertTaskCountThreshold({
          actual: 5,
          threshold: 5,
          bufferPercent: 0,
        }),
      ).not.toThrow();

      expect(() =>
        assertTaskCountThreshold({
          actual: 6,
          threshold: 5,
          bufferPercent: 0,
        }),
      ).toThrow();
    });
  });
});
