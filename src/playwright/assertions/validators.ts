import { expect } from '@playwright/test';

import { formatBytes } from '../features';
import type { Bytes, FPS, Milliseconds, Percentage, ThrottleRate } from '../types';
import {
  calculateEffectiveMinThreshold,
  calculateEffectiveThreshold,
} from '../utils/thresholdCalculator';

/**
 * Base parameters for threshold assertions.
 * All threshold assertions require actual value, threshold, and buffer percentage.
 *
 * @typeParam T - The type of the actual and threshold values (e.g., Milliseconds, Bytes)
 */
type BaseThresholdParams<T = number> = {
  /** The actual measured value */
  actual: T;
  /** The threshold to compare against */
  threshold: T;
  /** Buffer percentage to apply (0-100) */
  bufferPercent: Percentage;
};

/**
 * Validates at least one React commit was triggered.
 */
export const assertMinimumActivity = (sampleCount: number): void => {
  expect(sampleCount, 'Should trigger at least one React commit').toBeGreaterThan(0);
};

/**
 * Parameters for duration threshold assertion.
 * Extends base params with throttle rate for error messaging.
 */
type DurationThresholdParams = BaseThresholdParams<Milliseconds> & {
  /** CPU throttle rate for error message context */
  throttleRate: ThrottleRate;
};

/**
 * Validates duration is within threshold.
 */
export const assertDurationThreshold = ({
  actual,
  threshold,
  bufferPercent,
  throttleRate,
}: DurationThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `Should complete within ${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, throttle: ${throttleRate}x, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThan(effective);
};

/**
 * Parameters for sample count threshold assertion.
 */
type SampleCountThresholdParams = BaseThresholdParams;

/**
 * Validates sample count is within threshold.
 */
export const assertSampleCountThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: SampleCountThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent, true);

  expect(
    actual,
    `Should trigger ≤${effective} samples (actual: ${actual}, threshold: ${threshold} + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Validates React memoization is reducing render time.
 * Allows small tolerance to prevent flaky tests from timing variations.
 */
export const assertMemoizationEffectiveness = (
  actualDuration: Milliseconds,
  baseDuration: Milliseconds,
): void => {
  const allowedDelta = Math.max(1, baseDuration * 0.05);
  expect(
    actualDuration,
    `React memoization should reduce render time (actual: ${actualDuration.toFixed(
      2,
    )}ms, base: ${baseDuration.toFixed(2)}ms, tolerance: ${allowedDelta.toFixed(2)}ms)`,
  ).toBeLessThan(baseDuration + allowedDelta);
};

/**
 * Parameters for FPS threshold assertion.
 */
type FPSThresholdParams = BaseThresholdParams<FPS>;

/**
 * Validates average FPS meets minimum threshold.
 * Buffer is subtracted since higher FPS is better.
 */
export const assertFPSThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: FPSThresholdParams): void => {
  const effective = calculateEffectiveMinThreshold(threshold, bufferPercent);

  expect(
    actual,
    `Should maintain ≥${effective.toFixed(1)} FPS ` +
      `(actual: ${actual.toFixed(2)} FPS, ` +
      `threshold: ${threshold} FPS - ${bufferPercent}% buffer)`,
  ).toBeGreaterThanOrEqual(effective);
};

/**
 * Parameters for heap growth threshold assertion.
 */
type HeapGrowthThresholdParams = BaseThresholdParams<Bytes>;

/**
 * Validates heap growth is within threshold.
 * Buffer is additive (more tolerance for growth).
 */
export const assertHeapGrowthThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: HeapGrowthThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `Should not exceed ${formatBytes(effective)} heap growth ` +
      `(actual: ${formatBytes(actual)}, ` +
      `threshold: ${formatBytes(threshold)} + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for LCP threshold assertion.
 */
type LCPThresholdParams = BaseThresholdParams<Milliseconds>;

/**
 * Validates LCP (Largest Contentful Paint) is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 */
export const assertLCPThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: LCPThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `LCP should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for INP threshold assertion.
 */
type INPThresholdParams = BaseThresholdParams<Milliseconds>;

/**
 * Validates INP (Interaction to Next Paint) is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 */
export const assertINPThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: INPThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `INP should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for CLS threshold assertion.
 * CLS is a unitless score, so uses base number type.
 */
type CLSThresholdParams = BaseThresholdParams;

/**
 * Validates CLS (Cumulative Layout Shift) is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 * CLS is a unitless score where lower is better.
 */
export const assertCLSThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: CLSThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `CLS should be ≤${effective.toFixed(3)} ` +
      `(actual: ${actual.toFixed(3)}, ` +
      `threshold: ${threshold} + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for TTFB threshold assertion.
 */
type TTFBThresholdParams = BaseThresholdParams<Milliseconds>;

/**
 * Validates TTFB (Time to First Byte) is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 */
export const assertTTFBThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: TTFBThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `TTFB should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for FCP threshold assertion.
 */
type FCPThresholdParams = BaseThresholdParams<Milliseconds>;

/**
 * Validates FCP (First Contentful Paint) is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 */
export const assertFCPThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: FCPThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `FCP should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for percentile threshold assertion.
 * Extends base params with percentile level name for error messaging.
 */
type PercentileThresholdParams = BaseThresholdParams<Milliseconds> & {
  /** The percentile level name (e.g., 'p50', 'p95', 'p99') */
  level: string;
};

/**
 * Validates a percentile value is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 */
export const assertPercentileThreshold = ({
  level,
  actual,
  threshold,
  bufferPercent,
}: PercentileThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `${level.toUpperCase()} should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};
