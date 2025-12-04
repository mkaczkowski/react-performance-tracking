import type { FPSMetrics, MemoryMetrics } from '../features';
import type { Bytes, FPS, Milliseconds } from '../types';

/**
 * Supported percentile levels.
 */
export type PercentileLevel = 'p50' | 'p95' | 'p99';

/**
 * Percentile values for a metric.
 */
export type PercentileValues = {
  p50: number;
  p95: number;
  p99: number;
};

/**
 * Per-component metrics captured for a single iteration.
 */
export type ComponentIterationData = {
  /** Total time spent rendering this component */
  duration: Milliseconds;
  /** Number of renders for this component */
  rerenders: number;
};

/**
 * Metrics captured for a single test iteration.
 */
export type IterationResult = {
  /** Total time spent rendering (including memoized components) */
  duration: Milliseconds;
  /** Total number of React commits/renders */
  rerenders: number;
  /** FPS metrics (only present when FPS tracking is enabled) */
  avg?: FPS;
  /** Full FPS metrics for this iteration */
  fpsMetrics?: FPSMetrics;
  /** Heap growth in bytes (only present when memory tracking is enabled) */
  heapGrowth?: Bytes;
  /** Full memory metrics for this iteration */
  memoryMetrics?: MemoryMetrics;
  /** Per-component metrics for this iteration */
  components?: Record<string, ComponentIterationData>;
};

/**
 * Standard deviation values for metrics across iterations.
 */
export type StandardDeviation = {
  duration: number;
  rerenders: number;
  avg?: number;
  heapGrowth?: Bytes;
};

/**
 * Per-component percentile values.
 */
export type ComponentPercentileValues = {
  /** Duration percentiles (p50, p95, p99) */
  duration: PercentileValues;
  /** Rerender count percentiles (p50, p95, p99) */
  rerenders: PercentileValues;
};

/**
 * Percentile metrics computed from iteration results.
 * Includes both global and per-component percentiles.
 */
export type PercentileMetrics = {
  /** Global duration percentiles (p50, p95, p99) - for backwards compatibility */
  duration: PercentileValues;
  /** Global rerender count percentiles (p50, p95, p99) - for backwards compatibility */
  rerenders: PercentileValues;
  /** FPS percentiles (p50, p95, p99) - only present when FPS tracking is enabled */
  fps?: PercentileValues;
  /** Per-component percentile metrics */
  components: Record<string, ComponentPercentileValues>;
};

/**
 * Aggregated metrics from multiple test iterations.
 */
export type IterationMetrics = {
  /** Number of iterations run */
  iterations: number;
  /** Average duration across all iterations */
  duration: Milliseconds;
  /** Average rerenders across all iterations */
  rerenders: number;
  /** Average FPS across all iterations (only if FPS tracking enabled) */
  avg?: FPS;
  /** Individual results for each iteration */
  iterationResults: IterationResult[];
  /** Standard deviation of metrics (only if more than 1 iteration) */
  standardDeviation?: StandardDeviation;
  /** Percentile metrics (only if more than 1 effective iteration) */
  percentiles?: PercentileMetrics;
};
