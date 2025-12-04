import type {
  ComponentIterationData,
  ComponentPercentileValues,
  IterationMetrics,
  IterationResult,
  PercentileMetrics,
  PercentileValues,
  StandardDeviation,
} from './types';

/**
 * Calculates the arithmetic mean of an array of numbers.
 */
export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
};

/**
 * Calculates the population standard deviation of an array of numbers.
 */
export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length < 2) {
    return 0;
  }
  const avg = calculateAverage(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const avgSquaredDiff = calculateAverage(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
};

/**
 * Rounds a number to specified decimal places.
 */
export const roundToDecimals = (value: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Calculates a specific percentile from an array of numbers.
 *
 * Uses linear interpolation between adjacent values when the rank is not an integer.
 */
export const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) {
    return 0;
  }

  if (percentile < 0 || percentile > 100) {
    throw new Error(`Percentile must be between 0 and 100, got ${percentile}`);
  }

  const sorted = [...values].sort((a, b) => a - b);

  if (sorted.length === 1) {
    return sorted[0];
  }

  const rank = (percentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const fraction = rank - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  return sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex]);
};

/**
 * Calculates all standard percentiles (p50, p95, p99) for an array of numbers.
 */
export const calculatePercentiles = (values: number[], decimals: number = 2): PercentileValues => {
  return {
    p50: roundToDecimals(calculatePercentile(values, 50), decimals),
    p95: roundToDecimals(calculatePercentile(values, 95), decimals),
    p99: roundToDecimals(calculatePercentile(values, 99), decimals),
  };
};

/**
 * Calculates percentile metrics for a single component from iteration data.
 */
export const calculateComponentPercentiles = (
  componentData: ComponentIterationData[],
): ComponentPercentileValues => {
  const durations = componentData.map((c) => c.duration);
  const rerenders = componentData.map((c) => c.rerenders);

  return {
    duration: calculatePercentiles(durations),
    rerenders: calculatePercentiles(rerenders, 0),
  };
};

/**
 * Calculates per-component percentile metrics from iteration results.
 */
export const calculatePerComponentPercentiles = (
  results: IterationResult[],
): Record<string, ComponentPercentileValues> => {
  // Collect all unique component IDs across all iterations
  const componentIds = new Set<string>();
  for (const result of results) {
    if (result.components) {
      Object.keys(result.components).forEach((id) => componentIds.add(id));
    }
  }

  // Calculate percentiles for each component
  const componentPercentiles: Record<string, ComponentPercentileValues> = {};

  for (const componentId of componentIds) {
    // Get data for this component across all iterations that have it
    const componentData: ComponentIterationData[] = [];
    for (const result of results) {
      const data = result.components?.[componentId];
      if (data) {
        componentData.push(data);
      }
    }

    // Only calculate if we have data from multiple iterations
    if (componentData.length > 1) {
      componentPercentiles[componentId] = calculateComponentPercentiles(componentData);
    }
  }

  return componentPercentiles;
};

/**
 * Helper to calculate percentiles for optional metric values.
 * Filters out undefined values before calculation.
 * Returns undefined if no valid data exists.
 */
const calculateOptionalPercentiles = (
  values: (number | undefined)[],
  decimals?: number,
): PercentileValues | undefined => {
  const validValues = values.filter((v): v is number => v !== undefined);
  return validValues.length > 0 ? calculatePercentiles(validValues, decimals) : undefined;
};

/**
 * Calculates percentile metrics from iteration results.
 * Includes both global and per-component percentiles.
 * FPS percentiles are only calculated when FPS tracking is enabled.
 */
export const calculatePercentileMetrics = (results: IterationResult[]): PercentileMetrics => {
  return {
    duration: calculatePercentiles(results.map((r) => r.duration)),
    rerenders: calculatePercentiles(
      results.map((r) => r.rerenders),
      0,
    ),
    fps: calculateOptionalPercentiles(results.map((r) => r.avg)),
    components: calculatePerComponentPercentiles(results),
  };
};

/**
 * Aggregates iteration results into combined metrics.
 */
export const aggregateIterationResults = (
  results: IterationResult[],
  discardFirst: boolean = false,
): IterationMetrics => {
  const effectiveResults = discardFirst && results.length > 1 ? results.slice(1) : results;

  if (effectiveResults.length === 0) {
    return {
      iterations: 0,
      duration: 0,
      rerenders: 0,
      iterationResults: results,
    };
  }

  const durations = effectiveResults.map((r) => r.duration);
  const rerenders = effectiveResults.map((r) => r.rerenders);
  const fpsValues = effectiveResults.filter((r) => r.avg !== undefined).map((r) => r.avg as number);
  const heapGrowthValues = effectiveResults
    .filter((r) => r.heapGrowth !== undefined)
    .map((r) => r.heapGrowth as number);

  const avgDuration = roundToDecimals(calculateAverage(durations));
  const avgRerenders = roundToDecimals(calculateAverage(rerenders));
  const avg = fpsValues.length > 0 ? roundToDecimals(calculateAverage(fpsValues)) : undefined;

  let standardDeviation: StandardDeviation | undefined;
  let percentiles: PercentileMetrics | undefined;

  if (effectiveResults.length > 1) {
    standardDeviation = {
      duration: roundToDecimals(calculateStandardDeviation(durations)),
      rerenders: roundToDecimals(calculateStandardDeviation(rerenders)),
    };
    if (fpsValues.length > 1) {
      standardDeviation.avg = roundToDecimals(calculateStandardDeviation(fpsValues));
    }
    if (heapGrowthValues.length > 1) {
      standardDeviation.heapGrowth = Math.round(calculateStandardDeviation(heapGrowthValues));
    }

    percentiles = calculatePercentileMetrics(effectiveResults);
  }

  return {
    iterations: effectiveResults.length,
    duration: avgDuration,
    rerenders: avgRerenders,
    avg,
    iterationResults: results,
    standardDeviation,
    percentiles,
  };
};
