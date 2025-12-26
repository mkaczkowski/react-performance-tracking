import { expect } from '@playwright/test';

import { PERFORMANCE_CONFIG } from '../playwright/config/performanceConfig';
import {
  logGlobalMetricsTable,
  logTestFooter,
  logTestHeader,
  type MetricRow,
} from '../playwright/assertions/logging';
import { calculateEffectiveMinThreshold } from '../playwright/utils/thresholdCalculator';

import type {
  ConfiguredLighthouseTestInfo,
  LighthouseMetrics,
  LighthouseScore,
  ResolvedLighthouseThresholds,
} from './types';

const CATEGORY_NAMES: Record<string, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  bestPractices: 'Best Practices',
  seo: 'SEO',
  pwa: 'PWA',
};

type AssertParams = {
  metrics: LighthouseMetrics;
  testInfo: ConfiguredLighthouseTestInfo;
};

/**
 * Creates a MetricRow for a Lighthouse score (higher is better).
 * Reuses the same pattern as createFPSMetricRow from logging.ts.
 */
function createScoreMetricRow(
  name: string,
  actual: LighthouseScore,
  threshold: LighthouseScore,
  bufferPercent: number,
): MetricRow {
  const effective = calculateEffectiveMinThreshold(threshold, bufferPercent);
  const passed = actual >= effective;
  return {
    name,
    actual: String(actual),
    threshold: `>= ${effective.toFixed(0)}`,
    passed,
  };
}

/**
 * Asserts all configured Lighthouse thresholds.
 */
export function assertLighthouseThresholds({ metrics, testInfo }: AssertParams): void {
  const { thresholds, buffers, throttling, warmup, name } = testInfo;

  // Log header using shared utility
  logTestHeader({
    testName: name,
    throttleRate: throttling.cpu,
    warmup,
    networkThrottling: typeof throttling.network === 'string' ? throttling.network : undefined,
  });

  // Build metric rows
  const rows: MetricRow[] = [];
  const categories: Array<{
    key: keyof ResolvedLighthouseThresholds;
    actual: LighthouseScore | null;
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
      rows.push(createScoreMetricRow(CATEGORY_NAMES[key] ?? key, actual, threshold, buffers[key]));
    }
  }

  // Log results table using shared utility
  logGlobalMetricsTable(rows);

  // Log URL and duration
  console.log(`  URL: ${metrics.url}`);
  console.log(`  Duration: ${(metrics.auditDurationMs / 1000).toFixed(1)}s`);

  // Count pass/fail
  const passedCount = rows.filter((r) => r.passed).length;
  logTestFooter(passedCount, rows.length);

  // Run actual assertions
  for (const { key, actual } of categories) {
    const threshold = thresholds[key];
    if (threshold > 0 && actual !== null) {
      const effective = calculateEffectiveMinThreshold(threshold, buffers[key]);
      const displayName = CATEGORY_NAMES[key] ?? key;

      expect(
        actual,
        `Lighthouse ${displayName} should be >= ${effective.toFixed(0)} ` +
          `(actual: ${actual}, threshold: ${threshold} - ${buffers[key]}% buffer)`,
      ).toBeGreaterThanOrEqual(effective);
    }
  }
}

/**
 * Attaches Lighthouse results as JSON artifact.
 */
export async function attachLighthouseResults(
  testInfo: ConfiguredLighthouseTestInfo,
  metrics: LighthouseMetrics,
): Promise<void> {
  const data = {
    metrics,
    throttling: testInfo.throttling,
    thresholds: testInfo.thresholds,
    buffers: testInfo.buffers,
    categories: testInfo.categories,
    formFactor: testInfo.formFactor,
    warmup: testInfo.warmup,
    environment: PERFORMANCE_CONFIG.isCI ? 'ci' : 'local',
  };

  await testInfo.attach(testInfo.name, {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  });
}
