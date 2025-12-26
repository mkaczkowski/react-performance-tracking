import { LOG_PREFIX } from '../../utils';
import { PERFORMANCE_CONFIG } from '../config/performanceConfig';
import type { CustomMetrics } from '../customMetrics';
import {
  formatBytes,
  formatNetworkConditions,
  type NetworkThrottlingConfig,
  resolveNetworkConditions,
} from '../features';
import type {
  IterationMetrics,
  PercentileLevel,
  PercentileMetrics,
  PercentileValues,
} from '../iterations';
import type { CapturedComponentMetrics } from '../profiler/profilerState';
import type {
  Bytes,
  LighthouseMetrics,
  Milliseconds,
  Percentage,
  PhaseBreakdown,
  ResolvedDurationThresholds,
  ResolvedFPSThresholds,
  ResolvedLighthouseThresholds,
  ThrottleRate,
} from '../types';
import {
  calculateEffectiveMinThreshold,
  calculateEffectiveThreshold,
} from '../utils/thresholdCalculator';
import type {
  ResolvedWebVitalsThresholds,
  WebVitalsBufferConfig,
  WebVitalsMetrics,
} from '../webVitals';

const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
} as const;

const ICONS = {
  pass: '✓',
  fail: '✗',
  warmup: '○',
  bullet: '•',
} as const;

/** Default table width */
const TABLE_WIDTH = 80;

/**
 * Pads a string to a specified width with alignment.
 */
const padCell = (
  text: string,
  width: number,
  align: 'left' | 'right' | 'center' = 'left',
): string => {
  const padding = width - text.length;
  if (padding <= 0) return text.slice(0, width);

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center': {
      const left = Math.floor(padding / 2);
      return ' '.repeat(left) + text + ' '.repeat(padding - left);
    }
    default:
      return text + ' '.repeat(padding);
  }
};

/**
 * Creates a horizontal line for the table.
 */
const createLine = (
  widths: number[],
  left: string,
  middle: string,
  right: string,
  fill: string = BOX.horizontal,
): string => {
  const segments = widths.map((w) => fill.repeat(w + 2));
  return left + segments.join(middle) + right;
};

/**
 * Creates a row for the table.
 */
const createRow = (
  cells: string[],
  widths: number[],
  aligns?: ('left' | 'right' | 'center')[],
): string => {
  const paddedCells = cells.map((cell, i) => padCell(cell, widths[i], aligns?.[i] ?? 'left'));
  return BOX.vertical + ' ' + paddedCells.join(' ' + BOX.vertical + ' ') + ' ' + BOX.vertical;
};

/**
 * Creates a divider string for console output.
 */
const divider = (char = '─', length = TABLE_WIDTH): string => char.repeat(length);

/**
 * Represents a single metric row in the results table.
 */
export type MetricRow = {
  name: string;
  actual: string;
  threshold: string;
  passed: boolean;
};

/**
 * Parameters for logging test header.
 */
type TestHeaderParams = {
  testName: string;
  throttleRate: ThrottleRate;
  warmup?: boolean;
  iterations?: number;
  networkThrottling?: NetworkThrottlingConfig;
};

/**
 * Logs performance test header with configuration.
 */
export const logTestHeader = ({
  testName,
  throttleRate,
  warmup,
  iterations,
  networkThrottling,
}: TestHeaderParams): void => {
  const isCI = PERFORMANCE_CONFIG.isCI;

  // Build config parts
  const configParts: string[] = [];
  configParts.push(`Environment: ${isCI ? 'CI' : 'local'}`);

  if (throttleRate > 1) {
    configParts.push(`CPU: ${throttleRate}x`);
  }

  if (networkThrottling) {
    const conditions = resolveNetworkConditions(networkThrottling);
    if (conditions.offline) {
      configParts.push('Network: offline');
    } else if (typeof networkThrottling === 'string') {
      configParts.push(`Network: ${networkThrottling}`);
    } else {
      configParts.push(`Network: ${formatNetworkConditions(conditions)}`);
    }
  }

  if (iterations !== undefined && iterations > 1) {
    const warmupNote = warmup ? ' (first is warmup)' : '';
    configParts.push(`Iterations: ${iterations}${warmupNote}`);
  }

  console.log('');
  console.log(divider('═'));
  console.log(` ${LOG_PREFIX} PERFORMANCE TEST: ${testName}`);
  console.log(divider('═'));
  console.log(` ${configParts.join(' | ')}`);
  console.log(divider());
};

/**
 * Logs summary footer with pass/fail count.
 */
export const logTestFooter = (passedCount: number, totalCount: number): void => {
  const allPassed = passedCount === totalCount;

  console.log('');
  console.log(divider('═'));

  if (allPassed) {
    console.log(` ${ICONS.pass} ALL CHECKS PASSED`);
  } else {
    const failedCount = totalCount - passedCount;
    console.log(` ${ICONS.fail} ${failedCount} OF ${totalCount} CHECKS FAILED`);
  }

  console.log(divider('═'));
  console.log('');
};

/**
 * Helper to render a metrics table with a title.
 */
const renderMetricsTable = (title: string, metrics: MetricRow[]): void => {
  if (metrics.length === 0) return;

  // Calculate column widths
  const headers = ['Metric', 'Actual', 'Threshold', 'Status'];
  const widths = headers.map((h, i) => {
    const headerLen = h.length;
    const maxDataLen = Math.max(
      ...metrics.map((m) => {
        switch (i) {
          case 0:
            return m.name.length;
          case 1:
            return m.actual.length;
          case 2:
            return m.threshold.length;
          case 3:
            return 6; // "✓ PASS" or "✗ FAIL"
          default:
            return 0;
        }
      }),
    );
    return Math.max(headerLen, maxDataLen);
  });

  console.log('');
  console.log(` ${title}`);

  // Top border
  console.log(createLine(widths, BOX.topLeft, BOX.topT, BOX.topRight));

  // Header row
  console.log(createRow(headers, widths, ['left', 'left', 'left', 'left']));

  // Header separator
  console.log(createLine(widths, BOX.leftT, BOX.cross, BOX.rightT));

  // Data rows
  metrics.forEach((metric) => {
    const status = metric.passed ? `${ICONS.pass} PASS` : `${ICONS.fail} FAIL`;
    console.log(
      createRow([metric.name, metric.actual, metric.threshold, status], widths, [
        'left',
        'right',
        'right',
        'left',
      ]),
    );
  });

  // Bottom border
  console.log(createLine(widths, BOX.bottomLeft, BOX.bottomT, BOX.bottomRight));
};

/**
 * Logs the main results table with all metrics.
 */
export const logResultsTable = (metrics: MetricRow[]): void => {
  renderMetricsTable('RESULTS', metrics);
};

/**
 * Component metrics for logging.
 */
export type ComponentMetricsForLogging = {
  id: string;
  duration: MetricRow;
  renders: MetricRow;
  phaseBreakdown: PhaseBreakdown;
  percentileRows?: MetricRow[];
};

/**
 * Logs per-component results tables.
 * Each component gets its own table with Duration and Renders.
 */
export const logComponentResultsTables = (components: ComponentMetricsForLogging[]): void => {
  if (components.length === 0) return;

  // Sort by duration (highest first)
  const sorted = [...components].sort(
    (a, b) => parseFloat(b.duration.actual) - parseFloat(a.duration.actual),
  );

  for (const component of sorted) {
    const metrics: MetricRow[] = [component.duration, component.renders];

    // Add percentile rows if present
    if (component.percentileRows && component.percentileRows.length > 0) {
      metrics.push(...component.percentileRows);
    }

    renderMetricsTable(`COMPONENT: ${component.id}`, metrics);

    // Show phase breakdown inline
    const phases = Object.entries(component.phaseBreakdown);
    if (phases.length > 0) {
      const phasesStr = phases
        .sort(([, a], [, b]) => b - a)
        .map(([phase, count]) => `${phase}: ${count}`)
        .join(', ');
      console.log(` ${ICONS.bullet} Phases: ${phasesStr}`);
    }
  }
};

/**
 * Logs global metrics table (FPS, Memory, Web Vitals).
 * These metrics apply to the entire test, not per-component.
 */
export const logGlobalMetricsTable = (metrics: MetricRow[]): void => {
  if (metrics.length === 0) return;
  renderMetricsTable('GLOBAL METRICS', metrics);
};

/**
 * Parameters for iteration table row.
 */
type IterationTableRow = {
  index: number;
  isWarmup: boolean;
  duration: Milliseconds;
  renders: number;
  fps?: number;
  heapGrowth?: Bytes;
};

/**
 * Parameters for logging iterations table.
 */
type IterationsTableParams = {
  iterations: IterationTableRow[];
  averages: {
    duration: Milliseconds;
    renders: number;
    fps?: number;
    heapGrowth?: Bytes;
  };
  standardDeviation?: {
    duration: number;
    rerenders: number;
    avg?: number;
    heapGrowth?: Bytes;
  };
  hasWarmup: boolean;
  trackFps: boolean;
  trackMemory: boolean;
};

/**
 * Logs the iterations table with per-iteration metrics and averages.
 */
export const logIterationsTable = ({
  iterations,
  averages,
  standardDeviation,
  hasWarmup,
  trackFps,
  trackMemory,
}: IterationsTableParams): void => {
  if (iterations.length <= 1) return;

  // Build headers dynamically based on tracked metrics
  const headers: string[] = ['#', 'Duration', 'Renders'];
  if (trackFps) headers.push('FPS');
  if (trackMemory) headers.push('Heap Growth');

  // Build rows
  const rows: string[][] = iterations.map((iter) => {
    const indexLabel = iter.isWarmup ? `${iter.index} ${ICONS.warmup}` : `${iter.index}`;
    const row: string[] = [indexLabel, `${iter.duration.toFixed(2)}ms`, `${iter.renders}`];
    if (trackFps) row.push(iter.fps !== undefined ? iter.fps.toFixed(1) : '-');
    if (trackMemory) row.push(iter.heapGrowth !== undefined ? formatBytes(iter.heapGrowth) : '-');
    return row;
  });

  // Build average row
  const avgRow: string[] = [
    'AVG',
    standardDeviation
      ? `${averages.duration.toFixed(2)}ms ±${standardDeviation.duration.toFixed(1)}`
      : `${averages.duration.toFixed(2)}ms`,
    standardDeviation
      ? `${averages.renders} ±${standardDeviation.rerenders.toFixed(1)}`
      : `${averages.renders}`,
  ];
  if (trackFps) {
    avgRow.push(
      averages.fps !== undefined
        ? standardDeviation?.avg !== undefined
          ? `${averages.fps.toFixed(1)} ±${standardDeviation.avg.toFixed(1)}`
          : averages.fps.toFixed(1)
        : '-',
    );
  }
  if (trackMemory) {
    avgRow.push(averages.heapGrowth !== undefined ? formatBytes(averages.heapGrowth) : '-');
  }

  // Calculate column widths
  const allRows = [...rows, avgRow];
  const widths = headers.map((h, i) => {
    const maxDataLen = Math.max(...allRows.map((r) => r[i]?.length ?? 0));
    return Math.max(h.length, maxDataLen);
  });

  console.log('');
  console.log(' ITERATIONS');

  // Top border
  console.log(createLine(widths, BOX.topLeft, BOX.topT, BOX.topRight));

  // Header row
  console.log(createRow(headers, widths));

  // Header separator
  console.log(createLine(widths, BOX.leftT, BOX.cross, BOX.rightT));

  // Data rows
  rows.forEach((row) => {
    console.log(createRow(row, widths, ['left', 'right', 'right', 'right', 'right']));
  });

  // Separator before average
  console.log(createLine(widths, BOX.leftT, BOX.cross, BOX.rightT));

  // Average row
  console.log(createRow(avgRow, widths, ['left', 'right', 'right', 'right', 'right']));

  // Bottom border
  console.log(createLine(widths, BOX.bottomLeft, BOX.bottomT, BOX.bottomRight));

  // Warmup legend
  if (hasWarmup) {
    console.log(` ${ICONS.warmup} = warmup (excluded from average)`);
  }
};

/**
 * Parameters for logging breakdown section.
 */
type BreakdownParams = {
  phaseBreakdown: PhaseBreakdown;
  components: Record<string, CapturedComponentMetrics>;
};

/**
 * Logs the breakdown section with phases and components.
 */
export const logBreakdown = ({ phaseBreakdown, components }: BreakdownParams): void => {
  const hasPhases = Object.keys(phaseBreakdown).length > 0;
  const hasComponents = Object.keys(components).length > 0;

  if (!hasPhases && !hasComponents) return;

  console.log('');
  console.log(' BREAKDOWN');

  // Phases (inline format)
  if (hasPhases) {
    const phasesStr = Object.entries(phaseBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([phase, count]) => `${phase}: ${count}`)
      .join(', ');
    console.log(` ${ICONS.bullet} Phases: ${phasesStr}`);
  }

  // Components
  if (hasComponents) {
    console.log(` ${ICONS.bullet} Components:`);

    // Sort by total duration (highest first)
    const sortedComponents = Object.entries(components)
      .map(([id, metrics]) => ({ id, ...metrics }))
      .sort((a, b) => b.totalActualDuration - a.totalActualDuration);

    for (const { id, totalActualDuration, renderCount } of sortedComponents) {
      console.log(`   - ${id}: ${totalActualDuration.toFixed(2)}ms, ${renderCount} renders`);
    }
  }
};

/**
 * Logs custom metrics (marks and measures).
 */
export const logCustomMetrics = (customMetrics: CustomMetrics): void => {
  const { marks, measures } = customMetrics;

  if (marks.length === 0 && measures.length === 0) {
    return;
  }

  console.log('');
  console.log(' CUSTOM METRICS');

  // Measures first (more important)
  if (measures.length > 0) {
    measures.forEach(({ name, duration, startMark, endMark }) => {
      console.log(` ${ICONS.bullet} ${name}: ${duration.toFixed(2)}ms (${startMark} → ${endMark})`);
    });
  }

  // Then marks
  if (marks.length > 0) {
    marks.forEach(({ name, timestamp }) => {
      console.log(` ${ICONS.bullet} ${name}: ${timestamp.toFixed(2)}ms`);
    });
  }
};

/**
 * Creates a metric row for duration.
 */
export const createDurationMetricRow = (
  actual: Milliseconds,
  threshold: Milliseconds,
  bufferPercent: Percentage,
): MetricRow => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);
  const passed = actual < effective;
  return {
    name: 'Duration',
    actual: `${actual.toFixed(2)}ms`,
    threshold: `< ${effective.toFixed(0)}ms`,
    passed,
  };
};

/**
 * Creates a metric row for sample/render count.
 */
export const createSamplesMetricRow = (
  actual: number,
  threshold: number,
  bufferPercent: Percentage,
): MetricRow => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent, true);
  const passed = actual <= effective;
  return {
    name: 'Renders',
    actual: `${actual}`,
    threshold: `≤ ${effective}`,
    passed,
  };
};

/**
 * Creates component metrics for logging from captured component data.
 */
export const createComponentMetrics = (
  components: Record<string, CapturedComponentMetrics>,
  thresholdDuration: Milliseconds,
  thresholdRerenders: number,
  buffers: { duration: Percentage; rerenders: Percentage },
): ComponentMetricsForLogging[] => {
  return Object.entries(components).map(([id, metrics]) => ({
    id,
    duration: createDurationMetricRow(
      metrics.totalActualDuration,
      thresholdDuration,
      buffers.duration,
    ),
    renders: createSamplesMetricRow(metrics.renderCount, thresholdRerenders, buffers.rerenders),
    phaseBreakdown: metrics.phaseBreakdown,
  }));
};

/**
 * Creates a metric row for FPS.
 */
export const createFPSMetricRow = (
  actual: number,
  threshold: number,
  bufferPercent: Percentage,
): MetricRow => {
  const effective = calculateEffectiveMinThreshold(threshold, bufferPercent);
  const passed = actual >= effective;
  return {
    name: 'FPS',
    actual: actual.toFixed(1),
    threshold: `≥ ${effective.toFixed(1)}`,
    passed,
  };
};

/**
 * Creates a metric row for heap growth.
 */
export const createHeapGrowthMetricRow = (
  actual: Bytes,
  threshold: Bytes,
  bufferPercent: Percentage,
): MetricRow => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);
  const passed = actual <= effective;
  return {
    name: 'Heap Growth',
    actual: formatBytes(actual),
    threshold: `≤ ${formatBytes(effective)}`,
    passed,
  };
};

/**
 * Creates metric rows for web vitals.
 */
export const createWebVitalsMetricRows = (
  webVitals: WebVitalsMetrics,
  thresholds: ResolvedWebVitalsThresholds,
  buffers: WebVitalsBufferConfig,
): MetricRow[] => {
  const rows: MetricRow[] = [];

  // LCP
  if (webVitals.lcp !== null && thresholds.lcp > 0) {
    const effective = calculateEffectiveThreshold(thresholds.lcp, buffers.lcp);
    rows.push({
      name: 'LCP',
      actual: `${webVitals.lcp.toFixed(0)}ms`,
      threshold: `≤ ${effective.toFixed(0)}ms`,
      passed: webVitals.lcp <= effective,
    });
  }

  // INP
  if (webVitals.inp !== null && thresholds.inp > 0) {
    const effective = calculateEffectiveThreshold(thresholds.inp, buffers.inp);
    rows.push({
      name: 'INP',
      actual: `${webVitals.inp.toFixed(0)}ms`,
      threshold: `≤ ${effective.toFixed(0)}ms`,
      passed: webVitals.inp <= effective,
    });
  }

  // CLS
  if (webVitals.cls !== null && thresholds.cls > 0) {
    const effective = calculateEffectiveThreshold(thresholds.cls, buffers.cls);
    rows.push({
      name: 'CLS',
      actual: webVitals.cls.toFixed(3),
      threshold: `≤ ${effective.toFixed(3)}`,
      passed: webVitals.cls <= effective,
    });
  }

  return rows;
};

// ============================================
// Lighthouse Metric Rows
// ============================================

const LIGHTHOUSE_CATEGORY_NAMES: Record<string, string> = {
  performance: 'LH Performance',
  accessibility: 'LH Accessibility',
  bestPractices: 'LH Best Practices',
  seo: 'LH SEO',
  pwa: 'LH PWA',
};

/**
 * Creates metric rows for Lighthouse scores (higher is better).
 * Uses subtractive buffer (like FPS) since higher scores are better.
 */
export const createLighthouseMetricRows = (
  metrics: LighthouseMetrics,
  thresholds: ResolvedLighthouseThresholds,
  bufferPercent: Percentage,
): MetricRow[] => {
  const rows: MetricRow[] = [];

  const categories: Array<{
    key: keyof ResolvedLighthouseThresholds;
    actual: number | null;
  }> = [
    { key: 'performance', actual: metrics.performance },
    { key: 'accessibility', actual: metrics.accessibility },
    { key: 'bestPractices', actual: metrics.bestPractices },
    { key: 'seo', actual: metrics.seo },
    { key: 'pwa', actual: metrics.pwa },
  ];

  for (const { key, actual } of categories) {
    const threshold = thresholds[key];
    if (threshold > 0 && actual !== null) {
      const effective = calculateEffectiveMinThreshold(threshold, bufferPercent);
      rows.push({
        name: LIGHTHOUSE_CATEGORY_NAMES[key] ?? key,
        actual: String(actual),
        threshold: `≥ ${effective.toFixed(0)}`,
        passed: actual >= effective,
      });
    }
  }

  return rows;
};

/**
 * Creates metric rows for duration percentile values.
 * Only creates rows for percentiles that have thresholds set (> 0).
 * Uses the duration buffer for all percentile thresholds.
 */
export const createDurationPercentileRows = (
  durationPercentiles: PercentileValues,
  thresholds: ResolvedDurationThresholds,
  durationBufferPercent: Percentage,
): MetricRow[] => {
  const rows: MetricRow[] = [];
  const levels: Array<{ key: PercentileLevel; name: string }> = [
    { key: 'p50', name: 'P50' },
    { key: 'p95', name: 'P95' },
    { key: 'p99', name: 'P99' },
  ];

  for (const { key, name } of levels) {
    if (thresholds[key] > 0) {
      const effective = calculateEffectiveThreshold(thresholds[key], durationBufferPercent);
      rows.push({
        name,
        actual: `${durationPercentiles[key].toFixed(2)}ms`,
        threshold: `≤ ${effective.toFixed(0)}ms`,
        passed: durationPercentiles[key] <= effective,
      });
    }
  }

  return rows;
};

/**
 * Creates metric rows for percentile thresholds from full PercentileMetrics.
 * Only creates rows for percentiles that have thresholds set (> 0).
 * Uses the duration buffer for all percentile thresholds.
 */
export const createPercentileMetricRows = (
  percentiles: PercentileMetrics,
  thresholds: ResolvedDurationThresholds,
  durationBufferPercent: Percentage,
): MetricRow[] => {
  return createDurationPercentileRows(percentiles.duration, thresholds, durationBufferPercent);
};

/**
 * Creates metric rows for FPS percentile values.
 * Only creates rows for percentiles that have thresholds set (> 0).
 * Uses the avg (FPS) buffer for all FPS percentile thresholds (subtractive).
 */
export const createFPSPercentileRows = (
  fpsPercentiles: PercentileValues,
  thresholds: ResolvedFPSThresholds,
  avgBufferPercent: Percentage,
): MetricRow[] => {
  const rows: MetricRow[] = [];
  const levels: Array<{ key: PercentileLevel; name: string }> = [
    { key: 'p50', name: 'FPS P50' },
    { key: 'p95', name: 'FPS P95' },
    { key: 'p99', name: 'FPS P99' },
  ];

  for (const { key, name } of levels) {
    if (thresholds[key] > 0) {
      const effective = calculateEffectiveMinThreshold(thresholds[key], avgBufferPercent);
      rows.push({
        name,
        actual: `${fpsPercentiles[key].toFixed(1)} FPS`,
        threshold: `≥ ${effective.toFixed(0)} FPS`,
        passed: fpsPercentiles[key] >= effective,
      });
    }
  }

  return rows;
};

/**
 * Checks if any percentile thresholds are configured.
 */
export const hasPercentileThresholds = (thresholds: ResolvedDurationThresholds): boolean => {
  return thresholds.p50 > 0 || thresholds.p95 > 0 || thresholds.p99 > 0;
};

/**
 * Checks if any FPS percentile thresholds are configured.
 */
export const hasFPSPercentileThresholds = (thresholds: ResolvedFPSThresholds): boolean => {
  return thresholds.p50 > 0 || thresholds.p95 > 0 || thresholds.p99 > 0;
};

/**
 * @deprecated Use logIterationsTable instead. Will be removed in next major version.
 */
export const logSummary = ({
  duration: _duration,
  renders: _renders,
  fps,
  heapGrowth,
  iterationMetrics,
  warmup,
}: {
  duration: number;
  renders: number;
  fps?: number;
  heapGrowth?: Bytes;
  iterationMetrics?: IterationMetrics;
  warmup?: boolean;
}): void => {
  // Convert to new format if iterations are present
  if (iterationMetrics && iterationMetrics.iterationResults.length > 1) {
    const iterations: IterationTableRow[] = iterationMetrics.iterationResults.map((result, i) => ({
      index: i + 1,
      isWarmup: warmup === true && i === 0,
      duration: result.duration,
      renders: result.rerenders,
      fps: result.avg,
      heapGrowth: result.heapGrowth,
    }));

    logIterationsTable({
      iterations,
      averages: {
        duration: iterationMetrics.duration,
        renders: iterationMetrics.rerenders,
        fps: iterationMetrics.avg,
        heapGrowth: heapGrowth,
      },
      standardDeviation: iterationMetrics.standardDeviation,
      hasWarmup: warmup === true,
      trackFps: fps !== undefined,
      trackMemory: heapGrowth !== undefined,
    });
  }
};

/**
 * @deprecated Use logBreakdown instead. Will be removed in next major version.
 */
export const logPhaseBreakdown = (phaseBreakdown: PhaseBreakdown): void => {
  if (Object.keys(phaseBreakdown).length === 0) return;

  console.log('');
  console.log(`${LOG_PREFIX} PHASE BREAKDOWN`);
  Object.entries(phaseBreakdown)
    .sort(([, a], [, b]) => b - a)
    .forEach(([phase, count]) => {
      console.log(`    ${phase}: ${count}`);
    });
};

/**
 * @deprecated Use logBreakdown instead. Will be removed in next major version.
 */
export const logComponentMetrics = (components: Record<string, CapturedComponentMetrics>): void => {
  const componentIds = Object.keys(components);

  if (componentIds.length === 0) {
    return;
  }

  console.log('');
  console.log(`${LOG_PREFIX} COMPONENT BREAKDOWN`);

  const sortedComponents = componentIds
    .map((id) => ({ id, ...components[id] }))
    .sort((a, b) => b.totalActualDuration - a.totalActualDuration);

  for (const { id, totalActualDuration, renderCount, phaseBreakdown } of sortedComponents) {
    const phases = Object.entries(phaseBreakdown)
      .map(([phase, count]) => `${phase}: ${count}`)
      .join(', ');
    console.log(
      `    ${id}: ${totalActualDuration.toFixed(2)}ms, ${renderCount} renders (${phases})`,
    );
  }
};
