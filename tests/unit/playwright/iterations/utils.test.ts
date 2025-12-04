import { describe, expect, it } from 'vitest';

import {
  aggregateIterationResults,
  calculateAverage,
  calculateComponentPercentiles,
  calculatePercentile,
  calculatePercentileMetrics,
  calculatePercentiles,
  calculatePerComponentPercentiles,
  calculateStandardDeviation,
  roundToDecimals,
} from '../../../../src/playwright/iterations/utils';
import type {
  ComponentIterationData,
  IterationResult,
} from '../../../../src/playwright/iterations/types';

describe('iterations utils', () => {
  describe('calculateAverage', () => {
    it.each([
      [[], 0, 'empty array'],
      [[5], 5, 'single element'],
      [[1, 2, 3, 4, 5], 3, 'multiple values'],
      [[1.5, 2.5, 3.5], 2.5, 'decimal values'],
      [[-2, 0, 2], 0, 'negative values'],
    ])('calculateAverage(%j) → %d (%s)', (input, expected) => {
      expect(calculateAverage(input)).toBe(expected);
    });
  });

  describe('calculateStandardDeviation', () => {
    it('should return 0 for empty array', () => {
      expect(calculateStandardDeviation([])).toBe(0);
    });

    it('should return 0 for array with single element', () => {
      expect(calculateStandardDeviation([5])).toBe(0);
    });

    it('should calculate standard deviation for uniform values', () => {
      expect(calculateStandardDeviation([5, 5, 5, 5])).toBe(0);
    });

    it('should calculate standard deviation for varied values', () => {
      // Values: [2, 4, 4, 4, 5, 5, 7, 9]
      // Mean: 5, Variance: 4, StdDev: 2
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      expect(calculateStandardDeviation(values)).toBe(2);
    });

    it('should handle two values', () => {
      // Values: [0, 10], Mean: 5, Variance: 25, StdDev: 5
      expect(calculateStandardDeviation([0, 10])).toBe(5);
    });
  });

  describe('roundToDecimals', () => {
    it.each([
      [1.234567, undefined, 1.23, '2 decimals (default)'],
      [1.234567, 3, 1.235, '3 decimals'],
      [1.567, 0, 2, '0 decimals'],
      [5, 2, 5, 'whole number'],
      [1.555, 2, 1.56, 'round up'],
    ])('roundToDecimals(%d, %s) → %d (%s)', (value, decimals, expected, _label) => {
      expect(roundToDecimals(value, decimals)).toBe(expected);
    });
  });

  describe('calculatePercentile', () => {
    it('should return 0 for empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });

    it('should return the single value for single element array', () => {
      expect(calculatePercentile([100], 50)).toBe(100);
      expect(calculatePercentile([100], 99)).toBe(100);
    });

    it('should throw for percentile < 0', () => {
      expect(() => calculatePercentile([1, 2, 3], -1)).toThrow(
        'Percentile must be between 0 and 100',
      );
    });

    it('should throw for percentile > 100', () => {
      expect(() => calculatePercentile([1, 2, 3], 101)).toThrow(
        'Percentile must be between 0 and 100',
      );
    });

    it('should calculate p50 (median) correctly', () => {
      // Odd number of elements
      expect(calculatePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
      // Even number of elements (interpolation)
      expect(calculatePercentile([1, 2, 3, 4], 50)).toBe(2.5);
    });

    it('should calculate p0 and p100 correctly', () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculatePercentile(values, 0)).toBe(10);
      expect(calculatePercentile(values, 100)).toBe(50);
    });

    it('should handle unsorted input', () => {
      const values = [50, 10, 30, 20, 40];
      expect(calculatePercentile(values, 50)).toBe(30);
    });

    it('should use linear interpolation', () => {
      // [10, 20, 30, 40, 50] -> p25 is between 10 and 20
      // rank = 0.25 * 4 = 1, exactly at index 1 = 20
      expect(calculatePercentile([10, 20, 30, 40, 50], 25)).toBe(20);

      // For p95 with 5 values: rank = 0.95 * 4 = 3.8
      // Interpolate between index 3 (40) and index 4 (50): 40 + 0.8*(50-40) = 48
      expect(calculatePercentile([10, 20, 30, 40, 50], 95)).toBe(48);
    });
  });

  describe('calculatePercentiles', () => {
    it('should calculate p50, p95, p99 correctly', () => {
      // Create 100 values from 1 to 100
      const values = Array.from({ length: 100 }, (_, i) => i + 1);

      const percentiles = calculatePercentiles(values);

      // p50 = 50th value (median)
      expect(percentiles.p50).toBeCloseTo(50.5, 1);
      // p95 = 95th value
      expect(percentiles.p95).toBeCloseTo(95.05, 1);
      // p99 = 99th value
      expect(percentiles.p99).toBeCloseTo(99.01, 1);
    });

    it('should handle small arrays', () => {
      const values = [10, 20, 30];
      const percentiles = calculatePercentiles(values);

      expect(percentiles.p50).toBe(20);
      // p95: rank = 0.95 * 2 = 1.9, interpolate between 20 and 30
      expect(percentiles.p95).toBe(29);
      // p99: rank = 0.99 * 2 = 1.98, interpolate between 20 and 30
      expect(percentiles.p99).toBe(29.8);
    });

    it('should use specified decimal precision', () => {
      const values = [10, 20, 30];
      const percentiles = calculatePercentiles(values, 0);

      expect(percentiles.p50).toBe(20);
      expect(percentiles.p95).toBe(29);
      expect(percentiles.p99).toBe(30);
    });
  });

  describe('calculatePercentileMetrics', () => {
    const createResult = (duration: number, rerenders: number, avg?: number): IterationResult => ({
      duration,
      rerenders,
      avg,
    });

    it('should calculate percentiles for duration and rerenders', () => {
      const results = [
        createResult(10, 2),
        createResult(20, 4),
        createResult(30, 6),
        createResult(40, 8),
        createResult(50, 10),
      ];

      const metrics = calculatePercentileMetrics(results);

      expect(metrics.duration.p50).toBe(30);
      expect(metrics.duration.p95).toBe(48);
      expect(metrics.duration.p99).toBe(49.6);

      // Rerenders use 0 decimals
      expect(metrics.rerenders.p50).toBe(6);
      expect(metrics.rerenders.p95).toBe(10);
      expect(metrics.rerenders.p99).toBe(10);

      // No FPS data
      expect(metrics.fps).toBeUndefined();
    });

    it('should calculate FPS percentiles when FPS data is present', () => {
      const results = [
        createResult(10, 2, 50),
        createResult(20, 4, 55),
        createResult(30, 6, 60),
        createResult(40, 8, 58),
        createResult(50, 10, 52),
      ];

      const metrics = calculatePercentileMetrics(results);

      expect(metrics.fps).toBeDefined();
      expect(metrics.fps?.p50).toBe(55);
      expect(metrics.fps?.p95).toBe(59.6);
      expect(metrics.fps?.p99).toBe(59.92);
    });

    it('should handle partial FPS data', () => {
      const results = [
        createResult(10, 2, 50),
        createResult(20, 4), // No FPS
        createResult(30, 6, 60),
        createResult(40, 8), // No FPS
        createResult(50, 10, 55),
      ];

      const metrics = calculatePercentileMetrics(results);

      // FPS percentiles calculated from available data only
      expect(metrics.fps).toBeDefined();
      expect(metrics.fps?.p50).toBe(55);
    });

    it('should handle single result', () => {
      const results = [createResult(100, 5)];
      const metrics = calculatePercentileMetrics(results);

      expect(metrics.duration.p50).toBe(100);
      expect(metrics.duration.p95).toBe(100);
      expect(metrics.duration.p99).toBe(100);
      expect(metrics.rerenders.p50).toBe(5);
      expect(metrics.fps).toBeUndefined();
    });

    it('should handle single result with FPS', () => {
      const results = [createResult(100, 5, 60)];
      const metrics = calculatePercentileMetrics(results);

      expect(metrics.fps).toBeDefined();
      expect(metrics.fps?.p50).toBe(60);
      expect(metrics.fps?.p95).toBe(60);
      expect(metrics.fps?.p99).toBe(60);
    });
  });

  describe('aggregateIterationResults', () => {
    const createResult = (duration: number, rerenders: number, avg?: number): IterationResult => ({
      duration,
      rerenders,
      avg,
    });

    it('should return zeros for empty results', () => {
      const result = aggregateIterationResults([]);

      expect(result.iterations).toBe(0);
      expect(result.duration).toBe(0);
      expect(result.rerenders).toBe(0);
      expect(result.iterationResults).toEqual([]);
    });

    it('should handle single iteration', () => {
      const results = [createResult(100, 5)];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.iterations).toBe(1);
      expect(aggregated.duration).toBe(100);
      expect(aggregated.rerenders).toBe(5);
      expect(aggregated.avg).toBeUndefined();
      expect(aggregated.standardDeviation).toBeUndefined();
      expect(aggregated.iterationResults).toEqual(results);
    });

    it('should calculate averages for multiple iterations', () => {
      const results = [createResult(100, 4), createResult(200, 6), createResult(150, 5)];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.iterations).toBe(3);
      expect(aggregated.duration).toBe(150); // (100 + 200 + 150) / 3
      expect(aggregated.rerenders).toBe(5); // (4 + 6 + 5) / 3
      expect(aggregated.standardDeviation).toBeDefined();
    });

    it('should include FPS averages when present', () => {
      const results = [
        createResult(100, 4, 60),
        createResult(200, 6, 50),
        createResult(150, 5, 55),
      ];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.avg).toBe(55); // (60 + 50 + 55) / 3
    });

    it('should handle mixed FPS availability', () => {
      const results = [
        createResult(100, 4, 60),
        createResult(200, 6, undefined),
        createResult(150, 5, 50),
      ];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.avg).toBe(55); // (60 + 50) / 2
    });

    it('should calculate standard deviation for multiple iterations', () => {
      const results = [createResult(100, 4, 50), createResult(200, 6, 60)];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.standardDeviation).toBeDefined();
      expect(aggregated.standardDeviation!.duration).toBe(50); // std dev of [100, 200]
      expect(aggregated.standardDeviation!.rerenders).toBe(1); // std dev of [4, 6]
      expect(aggregated.standardDeviation!.avg).toBe(5); // std dev of [50, 60]
    });

    it('should discard first iteration when warmup is enabled', () => {
      const results = [
        createResult(500, 10), // warmup - should be discarded
        createResult(100, 4),
        createResult(200, 6),
      ];
      const aggregated = aggregateIterationResults(results, true);

      expect(aggregated.iterations).toBe(2);
      expect(aggregated.duration).toBe(150); // (100 + 200) / 2
      expect(aggregated.rerenders).toBe(5); // (4 + 6) / 2
      // iterationResults still contains all results including warmup
      expect(aggregated.iterationResults).toHaveLength(3);
    });

    it('should not discard if only one result and warmup enabled', () => {
      const results = [createResult(100, 5)];
      const aggregated = aggregateIterationResults(results, true);

      expect(aggregated.iterations).toBe(1);
      expect(aggregated.duration).toBe(100);
    });

    it('should round values to 2 decimal places', () => {
      const results = [createResult(100.123, 4), createResult(200.456, 6)];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.duration).toBe(150.29); // rounded average
    });

    it('should calculate percentiles for multiple iterations', () => {
      const results = [
        createResult(10, 2),
        createResult(20, 4),
        createResult(30, 6),
        createResult(40, 8),
        createResult(50, 10),
      ];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.percentiles).toBeDefined();
      expect(aggregated.percentiles!.duration.p50).toBe(30);
      expect(aggregated.percentiles!.duration.p95).toBe(48);
      expect(aggregated.percentiles!.rerenders.p50).toBe(6);
    });

    it('should not calculate percentiles for single iteration', () => {
      const results = [createResult(100, 5)];
      const aggregated = aggregateIterationResults(results);

      expect(aggregated.percentiles).toBeUndefined();
    });

    it('should calculate percentiles after warmup discard', () => {
      const results = [
        createResult(500, 10), // warmup - discarded
        createResult(10, 2),
        createResult(20, 4),
        createResult(30, 6),
      ];
      const aggregated = aggregateIterationResults(results, true);

      expect(aggregated.iterations).toBe(3);
      expect(aggregated.percentiles).toBeDefined();
      // Percentiles calculated from [10, 20, 30] only
      expect(aggregated.percentiles!.duration.p50).toBe(20);
    });
  });

  describe('calculateComponentPercentiles', () => {
    const createComponentData = (duration: number, rerenders: number): ComponentIterationData => ({
      duration,
      rerenders,
    });

    it('should calculate duration and rerender percentiles for a component', () => {
      const data = [
        createComponentData(10, 2),
        createComponentData(20, 4),
        createComponentData(30, 6),
        createComponentData(40, 8),
        createComponentData(50, 10),
      ];

      const result = calculateComponentPercentiles(data);

      expect(result.duration.p50).toBe(30);
      expect(result.duration.p95).toBe(48);
      expect(result.duration.p99).toBe(49.6);
      expect(result.rerenders.p50).toBe(6);
      expect(result.rerenders.p95).toBe(10);
      expect(result.rerenders.p99).toBe(10);
    });

    it('should handle single data point', () => {
      const data = [createComponentData(100, 5)];

      const result = calculateComponentPercentiles(data);

      expect(result.duration.p50).toBe(100);
      expect(result.duration.p95).toBe(100);
      expect(result.duration.p99).toBe(100);
      expect(result.rerenders.p50).toBe(5);
    });

    it('should round duration to 2 decimals and rerenders to 0 decimals', () => {
      const data = [
        createComponentData(10.123, 2),
        createComponentData(20.456, 4),
        createComponentData(30.789, 6),
      ];

      const result = calculateComponentPercentiles(data);

      expect(result.duration.p50).toBe(20.46);
      expect(result.rerenders.p50).toBe(4);
    });
  });

  describe('calculatePerComponentPercentiles', () => {
    const createResultWithComponents = (
      duration: number,
      rerenders: number,
      components: Record<string, ComponentIterationData>,
    ): IterationResult => ({
      duration,
      rerenders,
      components,
    });

    it('should calculate percentiles for each component across iterations', () => {
      const results = [
        createResultWithComponents(100, 10, {
          header: { duration: 10, rerenders: 2 },
          content: { duration: 90, rerenders: 8 },
        }),
        createResultWithComponents(120, 12, {
          header: { duration: 20, rerenders: 4 },
          content: { duration: 100, rerenders: 8 },
        }),
        createResultWithComponents(140, 14, {
          header: { duration: 30, rerenders: 6 },
          content: { duration: 110, rerenders: 8 },
        }),
      ];

      const result = calculatePerComponentPercentiles(results);

      expect(result.header).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.header.duration.p50).toBe(20);
      expect(result.content.duration.p50).toBe(100);
    });

    it('should handle components that appear in only some iterations', () => {
      const results = [
        createResultWithComponents(100, 10, {
          header: { duration: 10, rerenders: 2 },
        }),
        createResultWithComponents(120, 12, {
          header: { duration: 20, rerenders: 4 },
          sidebar: { duration: 30, rerenders: 3 },
        }),
        createResultWithComponents(140, 14, {
          header: { duration: 30, rerenders: 6 },
          sidebar: { duration: 40, rerenders: 4 },
        }),
      ];

      const result = calculatePerComponentPercentiles(results);

      // Header appears in 3 iterations
      expect(result.header).toBeDefined();
      expect(result.header.duration.p50).toBe(20);

      // Sidebar appears in 2 iterations
      expect(result.sidebar).toBeDefined();
      expect(result.sidebar.duration.p50).toBe(35);
    });

    it('should not calculate percentiles for components with only 1 iteration of data', () => {
      const results = [
        createResultWithComponents(100, 10, {
          header: { duration: 10, rerenders: 2 },
        }),
        createResultWithComponents(120, 12, {
          header: { duration: 20, rerenders: 4 },
        }),
        createResultWithComponents(140, 14, {
          // header not present in this iteration
          sidebar: { duration: 30, rerenders: 3 },
        }),
      ];

      const result = calculatePerComponentPercentiles(results);

      // Header appears in 2 iterations - should have percentiles
      expect(result.header).toBeDefined();

      // Sidebar appears in only 1 iteration - should not have percentiles
      expect(result.sidebar).toBeUndefined();
    });

    it('should return empty object when no components have data', () => {
      const results = [
        createResultWithComponents(100, 10, {}),
        createResultWithComponents(120, 12, {}),
      ];

      const result = calculatePerComponentPercentiles(results);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle iteration results without components field', () => {
      const results: IterationResult[] = [
        { duration: 100, rerenders: 10 },
        { duration: 120, rerenders: 12 },
      ];

      const result = calculatePerComponentPercentiles(results);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
