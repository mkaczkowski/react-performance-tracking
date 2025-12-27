import type { Milliseconds } from '../types';

/**
 * Container type for long task attribution.
 */
export type ContainerType = 'window' | 'iframe' | 'embed' | 'object';

/**
 * Individual long task entry with full attribution data.
 * Captures all available debugging information from the Long Task API.
 */
export interface LongTaskEntry {
  /** Task duration in milliseconds */
  duration: Milliseconds;
  /** Start time relative to navigation start */
  startTime: Milliseconds;
  /** Container type: "window", "iframe", "embed", "object" */
  containerType: ContainerType;
  /** Container element ID (if available) */
  containerId?: string;
  /** Container element name (if available) */
  containerName?: string;
  /** Container src URL (for iframes/embeds) */
  containerSrc?: string;
}

/**
 * Aggregated long task metrics collected during a test.
 */
export interface LongTaskMetrics {
  /** Total Blocking Time - sum of (duration - 50ms) for all long tasks */
  tbt: Milliseconds;
  /** Maximum single task duration */
  maxDuration: Milliseconds;
  /** Number of long tasks detected */
  count: number;
  /** Individual task entries (for debugging/reporting) */
  entries: LongTaskEntry[];
}

/**
 * Threshold configuration for long task assertions.
 * All values are optional - only configured metrics are validated.
 */
export interface LongTaskThresholds {
  /** Maximum Total Blocking Time allowed (ms) */
  tbt?: Milliseconds;
  /** Maximum duration for any single task (ms) */
  maxDuration?: Milliseconds;
  /** Maximum number of long tasks allowed */
  maxCount?: number;
}

/**
 * Resolved threshold values with defaults applied.
 * 0 means no validation for that metric.
 */
export interface ResolvedLongTaskThresholds {
  tbt: Milliseconds;
  maxDuration: Milliseconds;
  maxCount: number;
}

/**
 * Buffer configuration for long task thresholds.
 */
export interface LongTaskBufferConfig {
  /** Buffer percentage for TBT (additive) */
  tbt: number;
  /** Buffer percentage for maxDuration (additive) */
  maxDuration: number;
  /** Buffer percentage for maxCount (additive) */
  maxCount: number;
}
