# Lighthouse Integration - Implementation Plan

> **Status**: Proposed (Revised v2)
> **Created**: 2025-12-26
> **Revised**: 2025-12-26
> **Author**: Claude

## Overview

Add Lighthouse audit support to `react-performance-tracking` as an **integrated feature** within the existing `test.performance()` decorator, following the same pattern as FPS, memory, and web vitals tracking.

## Design Philosophy

### Why Integrate Rather Than Separate?

The previous plan proposed a separate `test.lighthouse()` decorator. This revision integrates Lighthouse directly into `test.performance()` because:

1. **Consistent UX**: Same pattern as existing features (FPS, memory, web vitals)
2. **Combined testing**: Run React profiler + Lighthouse in a single test when needed
3. **Less API surface**: No new factory function or test type to learn
4. **Shared infrastructure**: Reuses throttling, config resolution, logging already in place
5. **Simpler setup**: One test extension, not two

### How It Fits

```
test.performance({
  throttleRate: 4,
  networkThrottling: 'fast-3g',
  thresholds: {
    base: {
      profiler: { '*': { duration: 500 } },
      lighthouse: {                          // NEW
        performance: 90,
        accessibility: 95,
      },
    },
  },
})('dashboard test', async ({ page, performance }) => {
  await page.goto('/dashboard');
  await performance.init();
  // Lighthouse runs automatically after test if thresholds configured
});
```

---

## Usage Examples

### Basic: Lighthouse Only

```typescript
test.performance({
  thresholds: {
    base: {
      profiler: {},  // Empty = skip profiler assertions
      lighthouse: { performance: 90 },
    },
  },
})('homepage audit', async ({ page }) => {
  await page.goto('/');
  // Lighthouse runs automatically
});
```

### Combined: Profiler + Lighthouse

```typescript
test.performance({
  throttleRate: 4,
  thresholds: {
    base: {
      profiler: { '*': { duration: 500, rerenders: 20 } },
      lighthouse: { performance: 85, accessibility: 90 },
    },
    ci: {
      lighthouse: { performance: 75 },  // More lenient in CI
    },
  },
})('dashboard perf', async ({ page, performance }) => {
  await page.goto('/dashboard');
  await performance.init();
  // Both profiler and Lighthouse assertions run
});
```

### Advanced Configuration

```typescript
test.performance({
  throttleRate: 4,
  networkThrottling: 'slow-3g',
  warmup: true,
  thresholds: {
    base: {
      profiler: { '*': { duration: 500 } },
      lighthouse: {
        performance: 90,
        accessibility: 95,
        bestPractices: 85,
        seo: 80,
      },
    },
  },
  buffers: {
    duration: 20,
    lighthouse: 5,  // 5% buffer for all Lighthouse scores
  },
  lighthouse: {
    // Lighthouse-specific options
    formFactor: 'mobile',
    categories: ['performance', 'accessibility'],
    skipAudits: ['robots-txt'],
  },
})('full audit', async ({ page, performance }) => {
  await page.goto('/');
  await performance.init();
});
```

---

## File Changes

### Modified Files (4)

| File | Change |
|------|--------|
| `src/playwright/types.ts` | Add `LighthouseThresholds`, `LighthouseConfig` types |
| `src/playwright/config/configResolver.ts` | Add `resolveLighthouseThresholds()`, `resolveLighthouseConfig()` |
| `src/playwright/runner/PerformanceTestRunner.ts` | Add Lighthouse execution after test |
| `src/playwright/assertions/performanceAssertions.ts` | Add Lighthouse score assertions |

### New Files (2)

| File | Purpose |
|------|---------|
| `src/playwright/lighthouse/lighthouseRunner.ts` | Run Lighthouse audit via CDP |
| `src/playwright/lighthouse/index.ts` | Export types and runner |

**Total: 2 new files, 4 modified files**

---

## Type Definitions

Add to `src/playwright/types.ts`:

```typescript
// ============================================
// Lighthouse Types
// ============================================

/** Lighthouse score (0-100) */
export type LighthouseScore = number;

/** Lighthouse category identifiers */
export type LighthouseCategoryId =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'pwa';

/** Lighthouse score thresholds (0 = skip validation) */
export type LighthouseThresholds = {
  performance?: LighthouseScore;
  accessibility?: LighthouseScore;
  bestPractices?: LighthouseScore;
  seo?: LighthouseScore;
  pwa?: LighthouseScore;
};

/** Resolved Lighthouse thresholds with defaults applied */
export type ResolvedLighthouseThresholds = Required<LighthouseThresholds>;

/** Lighthouse-specific configuration options */
export type LighthouseConfig = {
  formFactor?: 'mobile' | 'desktop';
  categories?: LighthouseCategoryId[];
  skipAudits?: string[];
};

/** Resolved Lighthouse configuration */
export type ResolvedLighthouseConfig = Required<LighthouseConfig> & {
  enabled: boolean;
};

/** Lighthouse audit results */
export type LighthouseMetrics = {
  performance: LighthouseScore | null;
  accessibility: LighthouseScore | null;
  bestPractices: LighthouseScore | null;
  seo: LighthouseScore | null;
  pwa: LighthouseScore | null;
  auditDurationMs: number;
  url: string;
};
```

Update `ThresholdValues`:

```typescript
export type ThresholdValues = {
  profiler: { [componentId: string]: ComponentThresholds };
  fps?: FPSThresholds;
  memory?: { heapGrowth?: Bytes };
  webVitals?: WebVitalsThresholds;
  lighthouse?: LighthouseThresholds;  // NEW
};
```

Update `TestConfig`:

```typescript
export type TestConfig = {
  throttleRate?: ThrottleRate;
  warmup?: boolean;
  thresholds: ThresholdConfig;
  buffers?: PartialBufferConfig & {
    lighthouse?: number;  // NEW: single buffer for all Lighthouse scores
  };
  name?: string;
  iterations?: number;
  networkThrottling?: NetworkThrottlingConfig;
  exportTrace?: TraceExportConfig;
  lighthouse?: LighthouseConfig;  // NEW: Lighthouse-specific options
};
```

Update `ResolvedTestConfig`:

```typescript
export type ResolvedTestConfig = {
  // ... existing fields ...
  lighthouse: ResolvedLighthouseConfig;  // NEW
};

export type ResolvedThresholdValues = {
  // ... existing fields ...
  lighthouse: ResolvedLighthouseThresholds;  // NEW
};
```

---

## Config Resolution

Add to `src/playwright/config/configResolver.ts`:

```typescript
import { PERFORMANCE_CONFIG } from './performanceConfig';

const DEFAULT_LIGHTHOUSE_BUFFER = 5;

const DEFAULT_LIGHTHOUSE_CATEGORIES: LighthouseCategoryId[] = [
  'performance',
  'accessibility',
  'best-practices',
  'seo',
];

/**
 * Check if Lighthouse thresholds are configured
 */
const hasLighthouseThresholds = (config: TestConfig): boolean => {
  return !!(config.thresholds.base.lighthouse || config.thresholds.ci?.lighthouse);
};

/**
 * Resolves Lighthouse thresholds with CI overrides
 */
export const resolveLighthouseThresholds = (
  config: TestConfig,
  isCI: boolean,
): ResolvedLighthouseThresholds => {
  const base = config.thresholds.base.lighthouse ?? {};
  const ci = config.thresholds.ci?.lighthouse ?? {};
  const merged = isCI ? { ...base, ...ci } : base;

  return {
    performance: merged.performance ?? 0,
    accessibility: merged.accessibility ?? 0,
    bestPractices: merged.bestPractices ?? 0,
    seo: merged.seo ?? 0,
    pwa: merged.pwa ?? 0,
  };
};

/**
 * Resolves Lighthouse configuration
 */
export const resolveLighthouseConfig = (config: TestConfig): ResolvedLighthouseConfig => {
  const enabled = hasLighthouseThresholds(config);
  const userConfig = config.lighthouse ?? {};

  return {
    enabled,
    formFactor: userConfig.formFactor ?? 'mobile',
    categories: userConfig.categories ?? DEFAULT_LIGHTHOUSE_CATEGORIES,
    skipAudits: userConfig.skipAudits ?? [],
  };
};

/**
 * Resolves Lighthouse buffer (single value for all scores)
 */
export const resolveLighthouseBuffer = (config: TestConfig): number => {
  return config.buffers?.lighthouse ?? DEFAULT_LIGHTHOUSE_BUFFER;
};
```

Update `resolveThresholds`:

```typescript
export const resolveThresholds = (config: TestConfig, isCI: boolean): ResolvedThresholdValues => {
  // ... existing code ...

  return {
    profiler: resolveProfilerThresholds(config, isCI),
    fps: resolveFPSThresholds(...),
    memory: { heapGrowth },
    webVitals: resolveWebVitalsThresholds(config, isCI),
    lighthouse: resolveLighthouseThresholds(config, isCI),  // NEW
  };
};
```

Update `resolveBuffers`:

```typescript
export const resolveBuffers = (config: TestConfig): BufferConfig => ({
  duration: config.buffers?.duration ?? PERFORMANCE_CONFIG.buffers.duration,
  rerenders: config.buffers?.rerenders ?? PERFORMANCE_CONFIG.buffers.rerenders,
  fps: config.buffers?.fps ?? PERFORMANCE_CONFIG.buffers.fps,
  heapGrowth: config.buffers?.heapGrowth ?? PERFORMANCE_CONFIG.buffers.heapGrowth,
  webVitals: resolveWebVitalsBuffers(config),
  lighthouse: resolveLighthouseBuffer(config),  // NEW
});
```

Update `createConfiguredTestInfo`:

```typescript
export const createConfiguredTestInfo = (...): ConfiguredTestInfo => {
  // ... existing code ...
  const lighthouse = resolveLighthouseConfig(testConfig);  // NEW

  const configuredInfo = Object.create(testInfo) as ConfiguredTestInfo;
  // ... existing assignments ...
  configuredInfo.lighthouse = lighthouse;  // NEW

  return configuredInfo;
};
```

---

## Lighthouse Runner

Create `src/playwright/lighthouse/lighthouseRunner.ts`:

```typescript
import type { Page } from '@playwright/test';

import { logger } from '../../utils';
import { NETWORK_PRESETS, type NetworkThrottlingConfig } from '../features';
import type {
  LighthouseMetrics,
  ResolvedLighthouseConfig,
} from '../types';

/**
 * Maps our network throttling config to Lighthouse throttling settings
 */
function mapNetworkToLighthouse(
  network: NetworkThrottlingConfig | undefined,
  cpuRate: number,
) {
  const baseThrottling = {
    cpuSlowdownMultiplier: cpuRate,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
    rttMs: 0,
  };

  if (!network) return baseThrottling;

  if (typeof network === 'string' && network in NETWORK_PRESETS) {
    const preset = NETWORK_PRESETS[network];
    return {
      cpuSlowdownMultiplier: cpuRate,
      requestLatencyMs: preset.latency,
      downloadThroughputKbps: (preset.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (preset.uploadThroughput * 8) / 1024,
      rttMs: preset.latency,
    };
  }

  // Custom network conditions
  if (typeof network === 'object' && 'downloadThroughput' in network) {
    return {
      cpuSlowdownMultiplier: cpuRate,
      requestLatencyMs: network.latency ?? 0,
      downloadThroughputKbps: (network.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (network.uploadThroughput * 8) / 1024,
      rttMs: network.latency ?? 0,
    };
  }

  return baseThrottling;
}

/**
 * Checks if Lighthouse is available as a dependency
 */
async function isLighthouseAvailable(): Promise<boolean> {
  try {
    await import('lighthouse');
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates browser is Chromium (required for Lighthouse)
 */
function validateBrowser(page: Page): void {
  const browserName = page.context().browser()?.browserType().name();
  if (browserName !== 'chromium') {
    throw new Error(
      `Lighthouse requires Chromium browser. Current: ${browserName ?? 'unknown'}. ` +
      `Run tests with --project=chromium or remove lighthouse thresholds.`
    );
  }
}

export type RunLighthouseOptions = {
  page: Page;
  config: ResolvedLighthouseConfig;
  throttleRate: number;
  networkThrottling?: NetworkThrottlingConfig;
};

/**
 * Runs a Lighthouse audit on the current page.
 * Returns null if Lighthouse is not installed or browser is not Chromium.
 */
export async function runLighthouseAudit({
  page,
  config,
  throttleRate,
  networkThrottling,
}: RunLighthouseOptions): Promise<LighthouseMetrics | null> {
  if (!config.enabled) {
    return null;
  }

  validateBrowser(page);

  if (!(await isLighthouseAvailable())) {
    throw new Error(
      'Lighthouse is not installed. Install it with: npm install -D lighthouse'
    );
  }

  const url = page.url();
  logger.info(`Running Lighthouse audit on ${url}...`);

  const lighthouse = (await import('lighthouse')).default;
  const browser = page.context().browser()!;
  const port = parseInt(new URL(browser.wsEndpoint()).port, 10);

  const throttling = mapNetworkToLighthouse(networkThrottling, throttleRate);

  const startTime = Date.now();

  const result = await lighthouse(url, {
    port,
    output: 'json',
    onlyCategories: config.categories,
    skipAudits: config.skipAudits.length > 0 ? config.skipAudits : undefined,
    formFactor: config.formFactor,
    throttling,
    disableStorageReset: true,  // Preserve page state
  });

  if (!result?.lhr) {
    throw new Error('Lighthouse returned no results');
  }

  const extractScore = (cat?: { score: number | null }): number | null =>
    cat?.score != null ? Math.round(cat.score * 100) : null;

  const { categories } = result.lhr;
  const metrics: LighthouseMetrics = {
    performance: extractScore(categories.performance),
    accessibility: extractScore(categories.accessibility),
    bestPractices: extractScore(categories['best-practices']),
    seo: extractScore(categories.seo),
    pwa: extractScore(categories.pwa),
    auditDurationMs: Date.now() - startTime,
    url: result.lhr.finalDisplayedUrl || url,
  };

  logger.info(
    `Lighthouse completed in ${(metrics.auditDurationMs / 1000).toFixed(1)}s: ` +
    `Performance=${metrics.performance ?? 'N/A'}, ` +
    `Accessibility=${metrics.accessibility ?? 'N/A'}`
  );

  return metrics;
}
```

Create `src/playwright/lighthouse/index.ts`:

```typescript
export { runLighthouseAudit, type RunLighthouseOptions } from './lighthouseRunner';
```

---

## Test Runner Integration

Update `src/playwright/runner/PerformanceTestRunner.ts`:

```typescript
import { runLighthouseAudit } from '../lighthouse';
import type { LighthouseMetrics } from '../types';

export type CombinedMetrics = CapturedProfilerState & {
  iterationMetrics?: IterationMetrics;
  lighthouse?: LighthouseMetrics;  // NEW
};

export class PerformanceTestRunner<T extends BasePerformanceFixtures> {
  // ... existing code ...

  async execute(testFn: PerformanceTestFunction<T>): Promise<void> {
    try {
      await this.setup();

      if (this.testInfo.iterations > 1) {
        await this.runMultipleIterations(testFn);
      } else {
        const warmupResult = await this.runWarmupIfEnabled(testFn);
        await this.runSingleIteration(testFn, warmupResult);
      }

      // NEW: Run Lighthouse after test completes (if configured)
      await this.runLighthouseIfEnabled();
    } finally {
      await this.cleanup();
    }
  }

  // NEW
  private lighthouseMetrics: LighthouseMetrics | null = null;

  // NEW
  private async runLighthouseIfEnabled(): Promise<void> {
    if (!this.testInfo.lighthouse.enabled) {
      return;
    }

    // Run warmup audit if enabled
    if (this.testInfo.warmup) {
      logger.debug('Running Lighthouse warmup audit...');
      try {
        await runLighthouseAudit({
          page: this.page,
          config: this.testInfo.lighthouse,
          throttleRate: this.testInfo.throttleRate,
          networkThrottling: this.testInfo.networkThrottling,
        });
      } catch (error) {
        logger.warn('Lighthouse warmup failed, continuing:', error);
      }
    }

    // Run actual audit
    this.lighthouseMetrics = await runLighthouseAudit({
      page: this.page,
      config: this.testInfo.lighthouse,
      throttleRate: this.testInfo.throttleRate,
      networkThrottling: this.testInfo.networkThrottling,
    });
  }

  // Update captureMetricsWithOptionals to include Lighthouse
  private async captureMetricsWithOptionals(...): Promise<CapturedProfilerState> {
    // ... existing code ...
    return {
      ...profilerState,
      ...(fpsMetrics && { fps: fpsMetrics }),
      ...(memoryMetrics && { memory: memoryMetrics }),
      ...(webVitals && { webVitals }),
      ...(customMetrics && { customMetrics }),
      ...(this.lighthouseMetrics && { lighthouse: this.lighthouseMetrics }),  // NEW
    };
  }
}
```

---

## Assertions

Add to `src/playwright/assertions/logging.ts`:

```typescript
import type { LighthouseMetrics, ResolvedLighthouseThresholds } from '../types';

const LIGHTHOUSE_CATEGORY_NAMES: Record<string, string> = {
  performance: 'LH Performance',
  accessibility: 'LH Accessibility',
  bestPractices: 'LH Best Practices',
  seo: 'LH SEO',
  pwa: 'LH PWA',
};

/**
 * Creates metric rows for Lighthouse scores (higher is better)
 */
export const createLighthouseMetricRows = (
  metrics: LighthouseMetrics,
  thresholds: ResolvedLighthouseThresholds,
  buffer: number,
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
      const effective = calculateEffectiveMinThreshold(threshold, buffer);
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
```

Add to `src/playwright/assertions/performanceAssertions.ts`:

```typescript
import { createLighthouseMetricRows } from './logging';

export function assertPerformanceThresholds({ metrics, testInfo }: AssertParams): void {
  // ... existing code ...

  // NEW: Add Lighthouse assertions
  if (metrics.lighthouse) {
    const lighthouseRows = createLighthouseMetricRows(
      metrics.lighthouse,
      testInfo.thresholds.lighthouse,
      testInfo.buffers.lighthouse,
    );
    allMetricRows.push(...lighthouseRows);

    // Run Lighthouse score assertions
    for (const row of lighthouseRows) {
      if (!row.passed) {
        expect.soft(
          true,
          `${row.name}: expected ${row.threshold}, got ${row.actual}`
        ).toBe(false);
      }
    }
  }

  // ... rest of existing code ...
}
```

---

## Package.json Update

```json
{
  "peerDependencies": {
    "@playwright/test": ">=1.40.0",
    "lighthouse": ">=11.0.0",
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "lighthouse": {
      "optional": true
    }
  }
}
```

---

## Export Updates

Update `src/playwright/index.ts`:

```typescript
// ... existing exports ...

// Lighthouse
export { runLighthouseAudit, type RunLighthouseOptions } from './lighthouse';

export type {
  LighthouseCategoryId,
  LighthouseConfig,
  LighthouseMetrics,
  LighthouseScore,
  LighthouseThresholds,
  ResolvedLighthouseConfig,
  ResolvedLighthouseThresholds,
} from './types';
```

---

## Implementation Phases

### Phase 1: Types & Config
- [ ] Add Lighthouse types to `types.ts`
- [ ] Add config resolution to `configResolver.ts`
- [ ] Update `BufferConfig` type

### Phase 2: Runner
- [ ] Create `lighthouse/lighthouseRunner.ts`
- [ ] Create `lighthouse/index.ts`

### Phase 3: Integration
- [ ] Update `PerformanceTestRunner` to run Lighthouse
- [ ] Add Lighthouse to `CombinedMetrics`

### Phase 4: Assertions & Logging
- [ ] Add `createLighthouseMetricRows` to logging
- [ ] Update `assertPerformanceThresholds`

### Phase 5: Exports & Package
- [ ] Update `src/playwright/index.ts`
- [ ] Add optional peer dependency

### Phase 6: Testing
- [ ] Unit tests for config resolution
- [ ] Integration test with real Lighthouse

### Phase 7: Documentation
- [ ] Add `site/pages/docs/guides/lighthouse.mdx`
- [ ] Update CLAUDE.md

---

## Comparison: Previous vs. Revised Plan

| Aspect | Previous Plan | Revised Plan |
|--------|---------------|--------------|
| Approach | Separate `test.lighthouse()` | Integrated into `test.performance()` |
| New files | 6 files in `src/lighthouse/` | 2 files in `src/playwright/lighthouse/` |
| Modified files | 2 | 4 |
| New factory function | `createLighthouseTest()` | None |
| Config pattern | Different (`throttling: { cpu, network }`) | Same as existing (`throttleRate`, `networkThrottling`) |
| User learns | New API pattern | Nothing new |
| Combined testing | Two separate test decorators | Single test, both features |

---

## Acceptance Criteria

1. **Minimal new code**: 2 new files, ~200 lines
2. **Zero API changes**: Users learn nothing new
3. **Auto-enabled**: Configure thresholds → Lighthouse runs
4. **Graceful degradation**: Works without `lighthouse` installed (throws helpful error)
5. **Chromium-only**: Clear error for non-Chromium browsers
6. **Reuses everything**: Throttling, buffers, logging, assertions patterns
7. **Combined tests**: Profiler + Lighthouse in single test when desired
