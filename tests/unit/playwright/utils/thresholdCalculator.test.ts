import { describe, expect, it } from 'vitest';

import {
  calculateEffectiveMinThreshold,
  calculateEffectiveThreshold,
} from '@lib/playwright/utils/thresholdCalculator';

describe('calculateEffectiveThreshold', () => {
  it('should calculate effective threshold with buffer', () => {
    // 500ms + 20% buffer = 600ms
    expect(calculateEffectiveThreshold(500, 20)).toBe(600);
  });

  it('should return exact threshold when buffer is 0', () => {
    expect(calculateEffectiveThreshold(100, 0)).toBe(100);
  });

  it('should handle decimal results', () => {
    // 100 + 15% = 115 (floating point tolerance)
    expect(calculateEffectiveThreshold(100, 15)).toBeCloseTo(115);
  });

  it('should ceil result when ceil option is true', () => {
    // 20 + 20% = 24
    expect(calculateEffectiveThreshold(20, 20, true)).toBe(24);

    // 15 + 10% = 16.5 -> 17
    expect(calculateEffectiveThreshold(15, 10, true)).toBe(17);
  });

  it('should not ceil result when ceil option is false', () => {
    // 15 + 10% = 16.5
    expect(calculateEffectiveThreshold(15, 10, false)).toBe(16.5);
  });

  it('should handle large buffer percentages', () => {
    // 100 + 100% = 200
    expect(calculateEffectiveThreshold(100, 100)).toBe(200);
  });

  it('should handle small thresholds', () => {
    // 1 + 50% = 1.5
    expect(calculateEffectiveThreshold(1, 50)).toBe(1.5);
    expect(calculateEffectiveThreshold(1, 50, true)).toBe(2);
  });
});

describe('calculateEffectiveMinThreshold', () => {
  it('should calculate effective minimum threshold with buffer (subtract)', () => {
    // 60 FPS - 20% buffer = 48 FPS
    expect(calculateEffectiveMinThreshold(60, 20)).toBe(48);
  });

  it('should return exact threshold when buffer is 0', () => {
    expect(calculateEffectiveMinThreshold(60, 0)).toBe(60);
  });

  it('should handle decimal results', () => {
    // 60 - 15% = 51
    expect(calculateEffectiveMinThreshold(60, 15)).toBeCloseTo(51);
  });

  it('should floor result when floor option is true', () => {
    // 60 - 10% = 54
    expect(calculateEffectiveMinThreshold(60, 10, true)).toBe(54);

    // 55 - 10% = 49.5 -> 49
    expect(calculateEffectiveMinThreshold(55, 10, true)).toBe(49);
  });

  it('should not floor result when floor option is false', () => {
    // 55 - 10% = 49.5
    expect(calculateEffectiveMinThreshold(55, 10, false)).toBe(49.5);
  });

  it('should handle large buffer percentages', () => {
    // 100 - 50% = 50
    expect(calculateEffectiveMinThreshold(100, 50)).toBe(50);
  });

  it('should handle small thresholds', () => {
    // 10 - 50% = 5
    expect(calculateEffectiveMinThreshold(10, 50)).toBe(5);
    expect(calculateEffectiveMinThreshold(10, 50, true)).toBe(5);
  });
});

describe('threshold validation', () => {
  describe('calculateEffectiveThreshold validation', () => {
    it('should throw for negative threshold', () => {
      expect(() => calculateEffectiveThreshold(-1, 20)).toThrow(
        'Threshold must be non-negative, got: -1',
      );
    });

    it('should throw for negative buffer percent', () => {
      expect(() => calculateEffectiveThreshold(100, -5)).toThrow(
        'Buffer percent must be between 0 and 100, got: -5',
      );
    });

    it('should throw for buffer percent greater than 100', () => {
      expect(() => calculateEffectiveThreshold(100, 150)).toThrow(
        'Buffer percent must be between 0 and 100, got: 150',
      );
    });

    it('should accept zero threshold', () => {
      expect(calculateEffectiveThreshold(0, 20)).toBe(0);
    });

    it('should accept zero buffer percent', () => {
      expect(calculateEffectiveThreshold(100, 0)).toBe(100);
    });

    it('should accept 100 buffer percent', () => {
      expect(calculateEffectiveThreshold(100, 100)).toBe(200);
    });
  });

  describe('calculateEffectiveMinThreshold validation', () => {
    it('should throw for negative threshold', () => {
      expect(() => calculateEffectiveMinThreshold(-10, 20)).toThrow(
        'Threshold must be non-negative, got: -10',
      );
    });

    it('should throw for negative buffer percent', () => {
      expect(() => calculateEffectiveMinThreshold(60, -20)).toThrow(
        'Buffer percent must be between 0 and 100, got: -20',
      );
    });

    it('should throw for buffer percent greater than 100', () => {
      expect(() => calculateEffectiveMinThreshold(60, 101)).toThrow(
        'Buffer percent must be between 0 and 100, got: 101',
      );
    });

    it('should accept zero threshold', () => {
      expect(calculateEffectiveMinThreshold(0, 20)).toBe(0);
    });

    it('should accept zero buffer percent', () => {
      expect(calculateEffectiveMinThreshold(60, 0)).toBe(60);
    });

    it('should accept 100 buffer percent (results in 0)', () => {
      expect(calculateEffectiveMinThreshold(60, 100)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very small positive threshold', () => {
      expect(calculateEffectiveThreshold(0.001, 20)).toBeCloseTo(0.0012);
    });

    it('should handle very large threshold', () => {
      expect(calculateEffectiveThreshold(1000000, 20)).toBe(1200000);
    });

    it('should handle threshold at boundary of negative (just above 0)', () => {
      expect(calculateEffectiveThreshold(Number.MIN_VALUE, 20)).toBeGreaterThan(0);
    });
  });
});
