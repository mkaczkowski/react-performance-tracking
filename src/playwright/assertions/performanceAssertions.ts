/* eslint-disable no-console -- Required for test output logging */
import { expect } from '@playwright/test';

import type { ComponentPercentileValues, IterationMetrics, PercentileValues } from '../iterations';
import type { CapturedComponentMetrics, CapturedProfilerState } from '../profiler/profilerState';
import type {
  BufferConfig,
  ConfiguredTestInfo,
  LighthouseMetrics,
  Percentage,
  ResolvedComponentThresholds,
  ResolvedDurationThresholds,
  ResolvedFPSThresholds,
  ResolvedLighthouseThresholds,
  ResolvedThresholdValues,
  ThrottleRate,
} from '../types';
import { DEFAULT_COMPONENT_KEY } from '../types';

import {
  type createComponentMetrics,
  createDurationMetricRow,
  createDurationPercentileRows,
  createFPSMetricRow,
  createFPSPercentileRows,
  createHeapGrowthMetricRow,
  createLighthouseMetricRows,
  createSamplesMetricRow,
  createWebVitalsMetricRows,
  hasFPSPercentileThresholds,
  hasPercentileThresholds,
  logComponentResultsTables,
  logCustomMetrics,
  logGlobalMetricsTable,
  logIterationsTable,
  logResultsTable,
  logTestFooter,
  logTestHeader,
  type MetricRow,
} from './logging';
import {
  assertCLSThreshold,
  assertDurationThreshold,
  assertFPSThreshold,
  assertHeapGrowthThreshold,
  assertINPThreshold,
  assertLCPThreshold,
  assertMemoizationEffectiveness,
  assertMinimumActivity,
  assertPercentileThreshold,
  assertSampleCountThreshold,
} from './validators';

/**
 * Metrics with optional iteration and Lighthouse data.
 */
type MetricsWithIterations = CapturedProfilerState & {
  iterationMetrics?: IterationMetrics;
  lighthouse?: LighthouseMetrics;
};

/**
 * Configuration for building global metric rows.
 */
type GlobalMetricsConfig = {
  metrics: MetricsWithIterations;
  thresholds: ResolvedThresholdValues;
  buffers: BufferConfig;
  trackFps: boolean;
  trackMemory: boolean;
  trackWebVitals: boolean;
  trackLighthouse: boolean;
};

/**
 * Gets the resolved threshold for a specific component.
 * Falls back to "*" default if explicit threshold not found.
 * Throws user-friendly error if neither explicit nor default threshold exists.
 */
export const getComponentThreshold = (
  componentId: string,
  thresholds: ResolvedThresholdValues,
): ResolvedComponentThresholds => {
  // Check for explicit component threshold
  const explicit = thresholds.profiler[componentId];
  if (explicit) {
    return explicit;
  }

  // Fall back to default "*" threshold
  const defaultThreshold = thresholds.profiler[DEFAULT_COMPONENT_KEY];
  if (defaultThreshold) {
    return defaultThreshold;
  }

  // No threshold found - throw helpful error
  const availableKeys = Object.keys(thresholds.profiler).filter((k) => k !== DEFAULT_COMPONENT_KEY);
  const suggestion =
    availableKeys.length > 0
      ? `Available component thresholds: ${availableKeys.map((k) => `"${k}"`).join(', ')}`
      : 'No component thresholds are defined.';

  throw new Error(
    `No threshold defined for component "${componentId}".\n` +
      `Either add thresholds.base.profiler["${componentId}"] or define a default with thresholds.base.profiler["${DEFAULT_COMPONENT_KEY}"].\n` +
      suggestion,
  );
};

/**
 * Builds global metric rows (FPS, Memory, Web Vitals).
 * These metrics apply to the entire test, not per-component.
 * Note: Per-component percentile calculations are handled in runComponentPercentileAssertions().
 */
const buildGlobalMetricRows = ({
  metrics,
  thresholds,
  buffers,
  trackFps,
  trackMemory,
  trackWebVitals,
  trackLighthouse,
}: GlobalMetricsConfig): MetricRow[] => {
  const rows: MetricRow[] = [];

  // FPS metric
  if (trackFps && metrics.fps) {
    rows.push(createFPSMetricRow(metrics.fps.avg, thresholds.fps.avg, buffers.fps));

    // FPS percentile metrics
    const fpsPercentiles = metrics.iterationMetrics?.percentiles?.fps;
    if (fpsPercentiles && hasFPSPercentileThresholds(thresholds.fps)) {
      const fpsPercentileRows = createFPSPercentileRows(
        fpsPercentiles,
        thresholds.fps,
        buffers.fps,
      );
      rows.push(...fpsPercentileRows);
    }
  }

  // Heap growth metric
  if (trackMemory && metrics.memory && thresholds.memory.heapGrowth > 0) {
    rows.push(
      createHeapGrowthMetricRow(
        metrics.memory.heapGrowth,
        thresholds.memory.heapGrowth,
        buffers.heapGrowth,
      ),
    );
  }

  // Web vitals metrics
  if (trackWebVitals && metrics.webVitals) {
    const webVitalsRows = createWebVitalsMetricRows(
      metrics.webVitals,
      thresholds.webVitals,
      buffers.webVitals,
    );
    rows.push(...webVitalsRows);
  }

  // Lighthouse metrics
  if (trackLighthouse && metrics.lighthouse) {
    const lighthouseRows = createLighthouseMetricRows(
      metrics.lighthouse,
      thresholds.lighthouse,
      buffers.lighthouse,
    );
    rows.push(...lighthouseRows);
  }

  return rows;
};

/**
 * Configuration for running assertions.
 */
type AssertionConfig = {
  metrics: MetricsWithIterations;
  thresholds: ResolvedThresholdValues;
  buffers: BufferConfig;
  throttleRate: ThrottleRate;
  trackFps: boolean;
  trackMemory: boolean;
  trackWebVitals: boolean;
  trackLighthouse: boolean;
};

/**
 * Runs per-component percentile assertions.
 * Only validates percentile levels with non-zero thresholds.
 * Uses the duration buffer for all percentile thresholds.
 */
const runComponentPercentileAssertions = (
  actualPercentiles: ComponentPercentileValues,
  thresholds: ResolvedDurationThresholds,
  durationBufferPercent: Percentage,
): void => {
  const levels: Array<'p50' | 'p95' | 'p99'> = ['p50', 'p95', 'p99'];

  for (const level of levels) {
    if (thresholds[level] > 0) {
      assertPercentileThreshold({
        level,
        actual: actualPercentiles.duration[level],
        threshold: thresholds[level],
        bufferPercent: durationBufferPercent,
      });
    }
  }
};

/**
 * Runs FPS percentile assertions.
 * Only validates percentile levels with non-zero thresholds.
 * Uses the avg (FPS) buffer for all FPS percentile thresholds.
 */
const runFPSPercentileAssertions = (
  actualPercentiles: PercentileValues,
  thresholds: ResolvedFPSThresholds,
  avgBufferPercent: Percentage,
): void => {
  const levels: Array<'p50' | 'p95' | 'p99'> = ['p50', 'p95', 'p99'];

  for (const level of levels) {
    if (thresholds[level] > 0) {
      assertPercentileThreshold({
        level,
        actual: actualPercentiles[level],
        threshold: thresholds[level],
        bufferPercent: avgBufferPercent,
      });
    }
  }
};

/**
 * Runs assertions for a single component.
 */
const runComponentAssertions = (
  componentId: string,
  componentMetrics: CapturedComponentMetrics,
  componentThresholds: ResolvedComponentThresholds,
  buffers: BufferConfig,
  throttleRate: ThrottleRate,
  iterationMetrics?: IterationMetrics,
): void => {
  // Only assert duration.avg if it's configured (> 0)
  if (componentThresholds.duration.avg > 0) {
    assertDurationThreshold({
      actual: componentMetrics.totalActualDuration,
      threshold: componentThresholds.duration.avg,
      bufferPercent: buffers.duration,
      throttleRate,
    });
  }

  assertSampleCountThreshold({
    actual: componentMetrics.renderCount,
    threshold: componentThresholds.rerenders,
    bufferPercent: buffers.rerenders,
  });

  assertMemoizationEffectiveness(
    componentMetrics.totalActualDuration,
    componentMetrics.totalBaseDuration,
  );

  // Per-component percentile assertions
  const componentPercentiles = iterationMetrics?.percentiles?.components[componentId];
  if (componentPercentiles && hasPercentileThresholds(componentThresholds.duration)) {
    runComponentPercentileAssertions(
      componentPercentiles,
      componentThresholds.duration,
      buffers.duration,
    );
  }
};

/**
 * Runs all threshold assertions against captured metrics.
 * Validates each component against its specific threshold (or "*" default).
 */
const runAllAssertions = ({
  metrics,
  thresholds,
  buffers,
  throttleRate,
  trackFps,
  trackMemory,
  trackWebVitals,
  trackLighthouse,
}: AssertionConfig): void => {
  // Skip profiler assertions if no profiler thresholds are configured (e.g., Lighthouse-only tests)
  const hasProfilerThresholds = Object.keys(thresholds.profiler).length > 0;

  if (hasProfilerThresholds) {
    // Basic activity assertion
    assertMinimumActivity(metrics.sampleCount);

    // Per-component assertions
    const componentEntries = Object.entries(metrics.components);
    for (const [componentId, componentMetrics] of componentEntries) {
      const componentThresholds = getComponentThreshold(componentId, thresholds);
      runComponentAssertions(
        componentId,
        componentMetrics,
        componentThresholds,
        buffers,
        throttleRate,
        metrics.iterationMetrics,
      );
    }
  }

  // FPS assertion (global)
  if (trackFps && metrics.fps) {
    assertFPSThreshold({
      actual: metrics.fps.avg,
      threshold: thresholds.fps.avg,
      bufferPercent: buffers.fps,
    });

    // FPS percentile assertions
    const fpsPercentiles = metrics.iterationMetrics?.percentiles?.fps;
    if (fpsPercentiles && hasFPSPercentileThresholds(thresholds.fps)) {
      runFPSPercentileAssertions(fpsPercentiles, thresholds.fps, buffers.fps);
    }
  }

  // Heap growth assertion (global)
  if (trackMemory && metrics.memory && thresholds.memory.heapGrowth > 0) {
    assertHeapGrowthThreshold({
      actual: metrics.memory.heapGrowth,
      threshold: thresholds.memory.heapGrowth,
      bufferPercent: buffers.heapGrowth,
    });
  }

  // Web vitals assertions (global)
  if (trackWebVitals && metrics.webVitals) {
    runWebVitalsAssertions(metrics.webVitals, thresholds.webVitals, buffers.webVitals);
  }

  // Lighthouse assertions (global)
  if (trackLighthouse && metrics.lighthouse) {
    runLighthouseAssertions(metrics.lighthouse, thresholds.lighthouse, buffers.lighthouse);
  }
};

/**
 * Runs web vitals threshold assertions.
 */
const runWebVitalsAssertions = (
  webVitals: NonNullable<CapturedProfilerState['webVitals']>,
  thresholds: ResolvedThresholdValues['webVitals'],
  buffers: BufferConfig['webVitals'],
): void => {
  const { lcp, inp, cls } = webVitals;

  if (lcp !== null && thresholds.lcp > 0) {
    assertLCPThreshold({ actual: lcp, threshold: thresholds.lcp, bufferPercent: buffers.lcp });
  }

  if (inp !== null && thresholds.inp > 0) {
    assertINPThreshold({ actual: inp, threshold: thresholds.inp, bufferPercent: buffers.inp });
  }

  if (cls !== null && thresholds.cls > 0) {
    assertCLSThreshold({ actual: cls, threshold: thresholds.cls, bufferPercent: buffers.cls });
  }
};

/**
 * Runs Lighthouse threshold assertions.
 * Uses soft assertions so all checks run even if some fail.
 */
const runLighthouseAssertions = (
  lighthouse: LighthouseMetrics,
  thresholds: ResolvedLighthouseThresholds,
  bufferPercent: Percentage,
): void => {
  const categories: Array<{
    key: keyof ResolvedLighthouseThresholds;
    name: string;
    actual: number | null;
  }> = [
    { key: 'performance', name: 'LH Performance', actual: lighthouse.performance },
    { key: 'accessibility', name: 'LH Accessibility', actual: lighthouse.accessibility },
    { key: 'bestPractices', name: 'LH Best Practices', actual: lighthouse.bestPractices },
    { key: 'seo', name: 'LH SEO', actual: lighthouse.seo },
    { key: 'pwa', name: 'LH PWA', actual: lighthouse.pwa },
  ];

  for (const { key, name, actual } of categories) {
    const threshold = thresholds[key];
    if (threshold > 0 && actual !== null) {
      // Calculate effective threshold (subtractive buffer since higher is better)
      const effective = threshold * (1 - bufferPercent / 100);
      expect
        .soft(actual, `${name}: expected ≥ ${effective.toFixed(0)}, got ${actual}`)
        .toBeGreaterThanOrEqual(effective);
    }
  }
};

/**
 * Logs single component breakdown (phases and component name).
 */
const logSingleComponentBreakdown = (
  componentId: string,
  phaseBreakdown: Record<string, number>,
): void => {
  const phases = Object.entries(phaseBreakdown);
  if (phases.length > 0) {
    console.log('');
    console.log(' BREAKDOWN');
    const phasesStr = phases
      .sort(([, a], [, b]) => b - a)
      .map(([phase, count]) => `${phase}: ${count}`)
      .join(', ');
    console.log(` • Phases: ${phasesStr}`);
    console.log(` • Component: ${componentId}`);
  }
};

/**
 * Validates performance metrics against thresholds.
 * Logs test results and runs all threshold assertions.
 */
export const assertPerformanceThresholds = ({
  metrics,
  testInfo: {
    throttleRate,
    thresholds,
    buffers,
    warmup,
    name,
    trackFps,
    trackMemory,
    trackWebVitals,
    iterations,
    networkThrottling,
    lighthouse,
  },
}: {
  metrics: MetricsWithIterations | null;
  testInfo: ConfiguredTestInfo;
}): void => {
  expect(metrics, 'Performance metrics should be captured').not.toBeNull();
  if (!metrics) {
    return;
  }

  const trackLighthouse = lighthouse.enabled;

  // Log test header
  logTestHeader({ testName: name, throttleRate, warmup, iterations, networkThrottling });

  logIterationsIfMultiple(metrics, warmup, trackFps, trackMemory);

  // Build global metric rows
  const globalMetricRows = buildGlobalMetricRows({
    metrics,
    thresholds,
    buffers,
    trackFps: trackFps === true,
    trackMemory: trackMemory === true,
    trackWebVitals: trackWebVitals === true,
    trackLighthouse,
  });

  // Build and log metrics based on component count
  // Skip profiler-specific metrics if no profiler thresholds are configured (e.g., Lighthouse-only tests)
  const hasProfilerThresholds = Object.keys(thresholds.profiler).length > 0;
  const componentCount = Object.keys(metrics.components).length;

  let allMetricRows: MetricRow[];
  if (!hasProfilerThresholds) {
    // Lighthouse-only: just use global metric rows (FPS, memory, webVitals, lighthouse)
    allMetricRows = globalMetricRows;
    logResultsTable(allMetricRows);
  } else if (componentCount > 1) {
    allMetricRows = logMultiComponentMetrics(metrics, thresholds, buffers, globalMetricRows);
  } else {
    allMetricRows = logSingleComponentMetrics(
      metrics,
      thresholds,
      buffers,
      globalMetricRows,
      componentCount,
    );
  }

  // Log custom metrics if present
  if (metrics.customMetrics) {
    logCustomMetrics(metrics.customMetrics);
  }

  // Run assertions with pass/fail tracking
  const passedCount = allMetricRows.filter((row) => row.passed).length;
  const totalCount = allMetricRows.length;

  try {
    runAllAssertions({
      metrics,
      thresholds,
      buffers,
      throttleRate,
      trackFps,
      trackMemory,
      trackWebVitals,
      trackLighthouse,
    });
    logTestFooter(passedCount, totalCount);
  } catch (e) {
    logTestFooter(passedCount, totalCount);
    throw e;
  }
};

/**
 * Logs iterations table if there are multiple iterations.
 */
const logIterationsIfMultiple = (
  metrics: MetricsWithIterations,
  warmup: boolean | undefined,
  trackFps: boolean | undefined,
  trackMemory: boolean | undefined,
): void => {
  if (!metrics.iterationMetrics || metrics.iterationMetrics.iterationResults.length <= 1) {
    return;
  }

  const iterationRows = metrics.iterationMetrics.iterationResults.map((result, i) => ({
    index: i + 1,
    isWarmup: warmup === true && i === 0,
    duration: result.duration,
    renders: result.rerenders,
    fps: result.avg,
    heapGrowth: result.heapGrowth,
  }));

  logIterationsTable({
    iterations: iterationRows,
    averages: {
      duration: metrics.iterationMetrics.duration,
      renders: metrics.iterationMetrics.rerenders,
      fps: metrics.iterationMetrics.avg,
      heapGrowth: trackMemory && metrics.memory ? metrics.memory.heapGrowth : undefined,
    },
    standardDeviation: metrics.iterationMetrics.standardDeviation,
    hasWarmup: warmup === true,
    trackFps: trackFps === true,
    trackMemory: trackMemory === true,
  });
};

/**
 * Logs metrics for multiple components and returns all metric rows.
 * Uses per-component thresholds with "*" fallback.
 */
const logMultiComponentMetrics = (
  metrics: MetricsWithIterations,
  thresholds: ResolvedThresholdValues,
  buffers: BufferConfig,
  globalMetricRows: MetricRow[],
): MetricRow[] => {
  const componentMetrics = createComponentMetricsWithThresholds(
    metrics.components,
    thresholds,
    { duration: buffers.duration, rerenders: buffers.rerenders },
    metrics.iterationMetrics,
  );

  logComponentResultsTables(componentMetrics);

  const allMetricRows: MetricRow[] = [];
  for (const comp of componentMetrics) {
    allMetricRows.push(comp.duration, comp.renders);
    // Include percentile rows in total count
    if (comp.percentileRows) {
      allMetricRows.push(...comp.percentileRows);
    }
  }

  if (globalMetricRows.length > 0) {
    logGlobalMetricsTable(globalMetricRows);
    allMetricRows.push(...globalMetricRows);
  }

  return allMetricRows;
};

/**
 * Creates component metrics for logging using per-component thresholds.
 */
const createComponentMetricsWithThresholds = (
  components: Record<string, CapturedComponentMetrics>,
  thresholds: ResolvedThresholdValues,
  buffers: { duration: Percentage; rerenders: Percentage },
  iterationMetrics?: IterationMetrics,
): ReturnType<typeof createComponentMetrics> => {
  return Object.entries(components).map(([componentId, componentMetrics]) => {
    const componentThresholds = getComponentThreshold(componentId, thresholds);

    // Build percentile rows if iteration data available for this component
    let percentileRows: MetricRow[] | undefined;
    const componentPercentiles = iterationMetrics?.percentiles?.components[componentId];
    if (componentPercentiles && hasPercentileThresholds(componentThresholds.duration)) {
      percentileRows = createDurationPercentileRows(
        componentPercentiles.duration,
        componentThresholds.duration,
        buffers.duration,
      );
    }

    return {
      id: componentId,
      duration: createDurationMetricRow(
        componentMetrics.totalActualDuration,
        componentThresholds.duration.avg,
        buffers.duration,
      ),
      renders: createSamplesMetricRow(
        componentMetrics.renderCount,
        componentThresholds.rerenders,
        buffers.rerenders,
      ),
      phaseBreakdown: componentMetrics.phaseBreakdown,
      percentileRows,
    };
  });
};

/**
 * Logs metrics for single component (or no components) and returns all metric rows.
 * Uses per-component thresholds with "*" fallback.
 */
const logSingleComponentMetrics = (
  metrics: MetricsWithIterations,
  thresholds: ResolvedThresholdValues,
  buffers: BufferConfig,
  globalMetricRows: MetricRow[],
  componentCount: number,
): MetricRow[] => {
  // Get threshold for the single component (or use "*" default)
  let durationThreshold: number;
  let rerendersThreshold: number;

  if (componentCount === 1) {
    const [componentId] = Object.keys(metrics.components);
    const componentThresholds = getComponentThreshold(componentId, thresholds);
    durationThreshold = componentThresholds.duration.avg;
    rerendersThreshold = componentThresholds.rerenders;
  } else {
    // No components - use "*" default or first available threshold
    const defaultThreshold = thresholds.profiler[DEFAULT_COMPONENT_KEY];
    const firstThreshold = Object.values(thresholds.profiler)[0];
    const threshold = defaultThreshold || firstThreshold;
    if (!threshold) {
      throw new Error(
        'No profiler thresholds defined. Add thresholds.base.profiler["*"] or specific component thresholds.',
      );
    }
    durationThreshold = threshold.duration.avg;
    rerendersThreshold = threshold.rerenders;
  }

  const metricRows: MetricRow[] = [
    createDurationMetricRow(metrics.totalActualDuration, durationThreshold, buffers.duration),
    createSamplesMetricRow(metrics.sampleCount, rerendersThreshold, buffers.rerenders),
    ...globalMetricRows,
  ];

  logResultsTable(metricRows);

  // Show component breakdown if there's exactly one component
  if (componentCount === 1) {
    const [componentId, componentData] = Object.entries(metrics.components)[0];
    logSingleComponentBreakdown(componentId, componentData.phaseBreakdown);
  }

  return metricRows;
};
