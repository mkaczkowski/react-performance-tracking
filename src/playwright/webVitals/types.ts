import type { Milliseconds, Percentage } from '../types';

/**
 * Web Vitals metrics captured during test execution.
 * All values are null if not observed during the test.
 */
export type WebVitalsMetrics = {
  /** Largest Contentful Paint - time until largest element renders (ms) */
  lcp: Milliseconds | null;
  /** Interaction to Next Paint - responsiveness to user input (ms) */
  inp: Milliseconds | null;
  /** Cumulative Layout Shift - visual stability score (unitless, 0-1+) */
  cls: number | null;
  /** Time to First Byte - server response time (ms) */
  ttfb: Milliseconds | null;
  /** First Contentful Paint - time until first content renders (ms) */
  fcp: Milliseconds | null;
};

/**
 * User-facing threshold configuration for web vitals.
 * All thresholds are optional - only set values are validated.
 */
export type WebVitalsThresholds = {
  /** Maximum allowed LCP in milliseconds (Google recommends ≤2500ms) */
  lcp?: Milliseconds;
  /** Maximum allowed INP in milliseconds (Google recommends ≤200ms) */
  inp?: Milliseconds;
  /** Maximum allowed CLS score (Google recommends ≤0.1) */
  cls?: number;
  /** Maximum allowed TTFB in milliseconds (Google recommends ≤800ms) */
  ttfb?: Milliseconds;
  /** Maximum allowed FCP in milliseconds (Google recommends ≤1800ms) */
  fcp?: Milliseconds;
};

/**
 * Resolved web vitals thresholds with guaranteed values.
 * 0 means no validation for that metric.
 */
export type ResolvedWebVitalsThresholds = {
  lcp: Milliseconds;
  inp: Milliseconds;
  cls: number;
  ttfb: Milliseconds;
  fcp: Milliseconds;
};

/**
 * Buffer configuration for web vitals thresholds.
 * All buffers are additive (threshold + buffer% = max allowed).
 */
export type WebVitalsBufferConfig = {
  lcp: Percentage;
  inp: Percentage;
  cls: Percentage;
  ttfb: Percentage;
  fcp: Percentage;
};

/**
 * Default resolved web vitals thresholds (all disabled).
 */
export const DEFAULT_WEB_VITALS_THRESHOLDS: ResolvedWebVitalsThresholds = {
  lcp: 0,
  inp: 0,
  cls: 0,
  ttfb: 0,
  fcp: 0,
};

/**
 * Default buffer configuration for web vitals (20% each).
 */
export const DEFAULT_WEB_VITALS_BUFFERS: WebVitalsBufferConfig = {
  lcp: 20,
  inp: 20,
  cls: 20,
  ttfb: 20,
  fcp: 20,
};
