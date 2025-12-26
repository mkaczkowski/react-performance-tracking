# Lighthouse Score Cards Integration - Implementation Plan

> **Status**: Proposed (Revised)
> **Created**: 2025-12-26
> **Revised**: 2025-12-26
> **Author**: Claude

## Overview

This document outlines the implementation plan for adding Lighthouse audit support to `react-performance-tracking` via a separate `test.lighthouse()` decorator.

## Design Philosophy

### Why a Separate Decorator?

Instead of integrating Lighthouse into the existing `test.performance()` decorator, we create a completely separate `test.lighthouse()` decorator because:

1. **Different Purpose**: React Profiler metrics (continuous during test) vs. Lighthouse audits (point-in-time page audit)
2. **Different Configuration**: Lighthouse has its own throttling, categories, and scoring system
3. **Cleaner API**: Users can choose which type of testing they need without configuration bloat
4. **Independent Lifecycle**: Lighthouse runs after page navigation, not during React interactions

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    react-performance-tracking                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐        │
│  │  test.performance()  │      │   test.lighthouse()  │        │
│  │  ─────────────────── │      │  ─────────────────── │        │
│  │  React Profiler      │      │  Lighthouse Audits   │        │
│  │  FPS/Memory/WebVitals│      │  Score Thresholds    │        │
│  │  Custom Metrics      │      │  CPU/Network         │        │
│  └──────────┬───────────┘      └──────────┬───────────┘        │
│             │                              │                    │
│             └──────────────┬───────────────┘                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Reused from playwright/                     │   │
│  │  • calculateEffectiveMinThreshold (utils/)               │   │
│  │  • NETWORK_PRESETS (features/networkThrottling)          │   │
│  │  • MetricRow, renderMetricsTable (assertions/logging)    │   │
│  │  • logTestHeader, logTestFooter (assertions/logging)     │   │
│  │  • createLogger (utils/)                                 │   │
│  │  • PERFORMANCE_CONFIG.isCI (config/)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Usage Examples

### Basic Usage

```typescript
import { test as base } from '@playwright/test';
import { createLighthouseTest } from 'react-performance-tracking/lighthouse';

const test = createLighthouseTest(base);

test.lighthouse({
  thresholds: {
    performance: 90,
    accessibility: 95,
  },
})('homepage audit', async ({ page }) => {
  await page.goto('/');
  // Lighthouse runs automatically after test function
});
```

### Full Configuration

```typescript
test.lighthouse({
  // Throttling settings
  throttling: {
    cpu: 4,                    // CPU slowdown multiplier
    network: 'fast-3g',        // Reuses existing network presets
  },

  // Score thresholds with CI overrides
  thresholds: {
    base: {
      performance: 90,
      accessibility: 95,
      bestPractices: 90,
      seo: 80,
    },
    ci: {
      performance: 80,         // More lenient in CI
    },
  },

  // Buffer tolerance (subtractive for scores)
  buffers: {
    performance: 5,            // 90 - 5% = 85.5 minimum
    accessibility: 5,
  },

  // Audit configuration
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  formFactor: 'mobile',
  warmup: true,                // Run warmup audit (discarded)
  skipAudits: ['robots-txt'],  // Skip specific audits

})('homepage audit', async ({ page }) => {
  await page.goto('/');
});
```

### Using Both Decorators

```typescript
import { test as base } from '@playwright/test';
import { createPerformanceTest } from 'react-performance-tracking/playwright';
import { createLighthouseTest } from 'react-performance-tracking/lighthouse';

const perfTest = createPerformanceTest(base);
const lhTest = createLighthouseTest(base);

// React Performance Test
perfTest.performance({
  throttleRate: 4,
  thresholds: {
    base: {
      profiler: { '*': { duration: 500, rerenders: 20 } },
      fps: 55,
    },
  },
})('dashboard renders fast', async ({ page, performance }) => {
  await page.goto('/dashboard');
  await performance.init();
});

// Lighthouse Audit Test (completely separate)
lhTest.lighthouse({
  throttling: { cpu: 4, network: 'fast-3g' },
  thresholds: { performance: 90, accessibility: 95 },
})('dashboard audit', async ({ page }) => {
  await page.goto('/dashboard');
});
```

---

## File Structure (Simplified)

```
src/
├── lighthouse/                          # NEW: Separate lighthouse module
│   ├── index.ts                         # Public exports
│   ├── types.ts                         # All lighthouse types
│   ├── createLighthouseTest.ts          # Factory function (mirrors createPerformanceTest)
│   ├── LighthouseTestRunner.ts          # Orchestrates execution (simpler than PerformanceTestRunner)
│   ├── lighthouseConfig.ts              # Config constants + resolution (single file)
│   └── lighthouseAssertions.ts          # Assertions using shared logging utilities
│
├── playwright/                          # EXISTING: No changes needed
│   ├── assertions/logging.ts            # REUSE: MetricRow, renderMetricsTable, etc.
│   ├── features/networkThrottling.ts    # REUSE: NETWORK_PRESETS
│   ├── utils/thresholdCalculator.ts     # REUSE: calculateEffectiveMinThreshold
│   └── config/performanceConfig.ts      # REUSE: PERFORMANCE_CONFIG.isCI
│
└── index.ts                             # UPDATE: Add lighthouse exports
```

**Total: 6 new files** (down from 10+ in original plan)

---

## Reusable Utilities (Import, Don't Recreate)

| What We Need | Import From | Why Reuse |
|--------------|-------------|-----------|
| `MetricRow` type | `playwright/assertions/logging.ts` | Standard row format for tables |
| `renderMetricsTable()` | `playwright/assertions/logging.ts` | Generic table rendering |
| `logTestHeader()` | `playwright/assertions/logging.ts` | Header with config display |
| `logTestFooter()` | `playwright/assertions/logging.ts` | Footer with pass/fail summary |
| `NETWORK_PRESETS` | `playwright/features/networkThrottling.ts` | Already defines slow-3g, fast-3g, etc. |
| `calculateEffectiveMinThreshold()` | `playwright/utils/thresholdCalculator.ts` | Buffer calc for "higher is better" |
| `PERFORMANCE_CONFIG.isCI` | `playwright/config/performanceConfig.ts` | CI detection |
| `createLogger()` | `utils/logger.ts` | Consistent logging |

---

## Detailed File Specifications

### 1. `src/lighthouse/types.ts`

Types only - no logic.

```typescript
import type { Page, TestInfo } from '@playwright/test';
import type { NetworkPreset } from '../playwright/features';

// ============================================
// Score & Metric Types
// ============================================

/** Lighthouse score (0-100) */
export type LighthouseScore = number;

/** Lighthouse audit category identifiers */
export type LighthouseCategoryId =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'pwa';

/** Lighthouse audit results */
export type LighthouseMetrics = {
  performance: LighthouseScore | null;
  accessibility: LighthouseScore | null;
  bestPractices: LighthouseScore | null;
  seo: LighthouseScore | null;
  pwa: LighthouseScore | null;
  auditDurationMs: number;
  url: string;
  timestamp: string;
};

// ============================================
// Throttling Types (Reuses NetworkPreset)
// ============================================

/** Custom network conditions for Lighthouse */
export type LighthouseNetworkConditions = {
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
};

/** Network throttling - reuses existing presets or custom */
export type LighthouseNetworkThrottling = NetworkPreset | LighthouseNetworkConditions;

/** Throttling configuration */
export type LighthouseThrottlingConfig = {
  cpu?: number;
  network?: LighthouseNetworkThrottling;
};

// ============================================
// Threshold Types
// ============================================

export type LighthouseThresholds = {
  performance?: LighthouseScore;
  accessibility?: LighthouseScore;
  bestPractices?: LighthouseScore;
  seo?: LighthouseScore;
  pwa?: LighthouseScore;
};

export type ResolvedLighthouseThresholds = Required<LighthouseThresholds>;

export type LighthouseThresholdConfig = {
  base: LighthouseThresholds;
  ci?: Partial<LighthouseThresholds>;
};

// ============================================
// Buffer Types
// ============================================

export type LighthouseBufferConfig = {
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  pwa?: number;
};

export type ResolvedLighthouseBufferConfig = Required<LighthouseBufferConfig>;

// ============================================
// Test Configuration
// ============================================

export type LighthouseTestConfig = {
  throttling?: LighthouseThrottlingConfig;
  thresholds: LighthouseThresholds | LighthouseThresholdConfig;
  buffers?: LighthouseBufferConfig;
  categories?: LighthouseCategoryId[];
  formFactor?: 'mobile' | 'desktop';
  warmup?: boolean;
  name?: string;
  skipAudits?: string[];
};

export type ResolvedLighthouseTestConfig = {
  throttling: Required<LighthouseThrottlingConfig>;
  thresholds: ResolvedLighthouseThresholds;
  buffers: ResolvedLighthouseBufferConfig;
  categories: LighthouseCategoryId[];
  formFactor: 'mobile' | 'desktop';
  warmup: boolean;
  name: string;
  skipAudits: string[];
};

// ============================================
// Test Function Types
// ============================================

export type LighthouseTestFixtures = {
  page: Page;
};

export type LighthouseTestFunction = (
  fixtures: LighthouseTestFixtures,
  testInfo: ConfiguredLighthouseTestInfo,
) => Promise<void> | void;

export type ConfiguredLighthouseTestInfo = TestInfo & ResolvedLighthouseTestConfig;
```

---

### 2. `src/lighthouse/lighthouseConfig.ts`

Config defaults + resolution in a single file (matches existing pattern simplicity).

```typescript
import type { TestInfo } from '@playwright/test';

import { PERFORMANCE_CONFIG } from '../playwright/config/performanceConfig';
import { NETWORK_PRESETS, type NetworkPreset } from '../playwright/features';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseBufferConfig,
  LighthouseCategoryId,
  LighthouseNetworkThrottling,
  LighthouseTestConfig,
  LighthouseThresholdConfig,
  LighthouseThresholds,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseTestConfig,
  ResolvedLighthouseThresholds,
} from './types';

// ============================================
// Defaults
// ============================================

const DEFAULT_CPU_THROTTLE = 4;
const DEFAULT_NETWORK_PRESET: NetworkPreset = 'fast-4g';
const DEFAULT_BUFFER_PERCENT = 5;

const DEFAULT_CATEGORIES: LighthouseCategoryId[] = [
  'performance',
  'accessibility',
  'best-practices',
  'seo',
];

const DEFAULT_THRESHOLDS: ResolvedLighthouseThresholds = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  pwa: 0,
};

const DEFAULT_BUFFERS: ResolvedLighthouseBufferConfig = {
  performance: DEFAULT_BUFFER_PERCENT,
  accessibility: DEFAULT_BUFFER_PERCENT,
  bestPractices: DEFAULT_BUFFER_PERCENT,
  seo: DEFAULT_BUFFER_PERCENT,
  pwa: DEFAULT_BUFFER_PERCENT,
};

// ============================================
// Resolution Functions
// ============================================

function isShorthandThresholds(
  thresholds: LighthouseThresholds | LighthouseThresholdConfig,
): thresholds is LighthouseThresholds {
  return !('base' in thresholds);
}

export function resolveThresholds(
  config: LighthouseThresholds | LighthouseThresholdConfig,
): ResolvedLighthouseThresholds {
  const normalized = isShorthandThresholds(config) ? { base: config } : config;
  const merged = PERFORMANCE_CONFIG.isCI
    ? { ...normalized.base, ...normalized.ci }
    : normalized.base;

  return {
    performance: merged.performance ?? 0,
    accessibility: merged.accessibility ?? 0,
    bestPractices: merged.bestPractices ?? 0,
    seo: merged.seo ?? 0,
    pwa: merged.pwa ?? 0,
  };
}

export function resolveBuffers(
  buffers?: LighthouseBufferConfig,
): ResolvedLighthouseBufferConfig {
  return {
    performance: buffers?.performance ?? DEFAULT_BUFFERS.performance,
    accessibility: buffers?.accessibility ?? DEFAULT_BUFFERS.accessibility,
    bestPractices: buffers?.bestPractices ?? DEFAULT_BUFFERS.bestPractices,
    seo: buffers?.seo ?? DEFAULT_BUFFERS.seo,
    pwa: buffers?.pwa ?? DEFAULT_BUFFERS.pwa,
  };
}

function generateArtifactName(title: string): string {
  return `lighthouse-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}

export function resolveConfig(
  config: LighthouseTestConfig,
  testTitle: string,
): ResolvedLighthouseTestConfig {
  return {
    throttling: {
      cpu: config.throttling?.cpu ?? DEFAULT_CPU_THROTTLE,
      network: config.throttling?.network ?? DEFAULT_NETWORK_PRESET,
    },
    thresholds: resolveThresholds(config.thresholds),
    buffers: resolveBuffers(config.buffers),
    categories: config.categories ?? DEFAULT_CATEGORIES,
    formFactor: config.formFactor ?? 'mobile',
    warmup: config.warmup ?? PERFORMANCE_CONFIG.isCI,
    name: config.name ?? generateArtifactName(testTitle),
    skipAudits: config.skipAudits ?? [],
  };
}

export function createConfiguredTestInfo(
  testInfo: TestInfo,
  config: LighthouseTestConfig,
  testTitle: string,
): ConfiguredLighthouseTestInfo {
  const resolved = resolveConfig(config, testTitle);
  const configured = Object.create(testInfo) as ConfiguredLighthouseTestInfo;
  Object.assign(configured, resolved);
  return configured;
}

// ============================================
// Throttling Mapping (Reuses NETWORK_PRESETS)
// ============================================

export interface LighthouseThrottlingSettings {
  cpuSlowdownMultiplier: number;
  requestLatencyMs: number;
  downloadThroughputKbps: number;
  uploadThroughputKbps: number;
  rttMs: number;
}

function isNetworkPreset(network: LighthouseNetworkThrottling): network is NetworkPreset {
  return typeof network === 'string' && network in NETWORK_PRESETS;
}

export function mapToLighthouseThrottling(
  cpu: number,
  network: LighthouseNetworkThrottling,
): LighthouseThrottlingSettings {
  if (isNetworkPreset(network)) {
    const preset = NETWORK_PRESETS[network];
    return {
      cpuSlowdownMultiplier: cpu,
      requestLatencyMs: preset.latency,
      // Convert bytes/sec to Kbps
      downloadThroughputKbps: (preset.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (preset.uploadThroughput * 8) / 1024,
      rttMs: preset.latency,
    };
  }

  // Custom network conditions (already in Kbps)
  return {
    cpuSlowdownMultiplier: cpu,
    requestLatencyMs: network.latencyMs,
    downloadThroughputKbps: network.downloadKbps,
    uploadThroughputKbps: network.uploadKbps,
    rttMs: network.latencyMs,
  };
}

export function formatThrottling(cpu: number, network: LighthouseNetworkThrottling): string {
  const networkStr = typeof network === 'string'
    ? network
    : `${network.downloadKbps}Kbps`;
  return `CPU ${cpu}x, Network: ${networkStr}`;
}
```

---

### 3. `src/lighthouse/lighthouseAssertions.ts`

Reuses logging utilities from playwright.

```typescript
import { expect } from '@playwright/test';

import {
  type MetricRow,
  logTestHeader,
  logTestFooter,
  logGlobalMetricsTable,
} from '../playwright/assertions/logging';
import { calculateEffectiveMinThreshold } from '../playwright/utils/thresholdCalculator';
import { PERFORMANCE_CONFIG } from '../playwright/config/performanceConfig';
import { formatThrottling } from './lighthouseConfig';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseMetrics,
  LighthouseScore,
  ResolvedLighthouseBufferConfig,
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
    threshold: `≥ ${effective.toFixed(0)}`,
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
  const categories: Array<{ key: keyof ResolvedLighthouseThresholds; actual: LighthouseScore | null }> = [
    { key: 'performance', actual: metrics.performance },
    { key: 'accessibility', actual: metrics.accessibility },
    { key: 'bestPractices', actual: metrics.bestPractices },
    { key: 'seo', actual: metrics.seo },
    { key: 'pwa', actual: metrics.pwa },
  ];

  for (const { key, actual } of categories) {
    const threshold = thresholds[key];
    if (threshold > 0 && actual !== null) {
      rows.push(createScoreMetricRow(
        CATEGORY_NAMES[key] ?? key,
        actual,
        threshold,
        buffers[key],
      ));
    }
  }

  // Log results table using shared utility
  logGlobalMetricsTable(rows);

  // Log URL and duration
  console.log(`  URL: ${metrics.url}`);
  console.log(`  Duration: ${(metrics.auditDurationMs / 1000).toFixed(1)}s`);

  // Count pass/fail
  const passedCount = rows.filter(r => r.passed).length;
  logTestFooter(passedCount, rows.length);

  // Run actual assertions
  for (const { key, actual } of categories) {
    const threshold = thresholds[key];
    if (threshold > 0 && actual !== null) {
      const effective = calculateEffectiveMinThreshold(threshold, buffers[key]);
      const displayName = CATEGORY_NAMES[key] ?? key;

      expect(
        actual,
        `Lighthouse ${displayName} should be ≥${effective.toFixed(0)} ` +
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
```

---

### 4. `src/lighthouse/LighthouseTestRunner.ts`

Simpler than PerformanceTestRunner - no FPS/memory tracking, no iterations.

```typescript
import type { Page } from '@playwright/test';

import { createLogger } from '../utils';
import {
  formatThrottling,
  mapToLighthouseThrottling,
} from './lighthouseConfig';
import {
  assertLighthouseThresholds,
  attachLighthouseResults,
} from './lighthouseAssertions';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseMetrics,
  LighthouseTestFixtures,
  LighthouseTestFunction,
} from './types';

const logger = createLogger('Lighthouse');

async function isLighthouseAvailable(): Promise<boolean> {
  try {
    await import('lighthouse');
    return true;
  } catch {
    return false;
  }
}

/**
 * Orchestrates Lighthouse test execution.
 * Simpler than PerformanceTestRunner - single audit, no iterations.
 */
export class LighthouseTestRunner {
  constructor(
    private readonly page: Page,
    private readonly fixtures: LighthouseTestFixtures,
    private readonly testInfo: ConfiguredLighthouseTestInfo,
  ) {}

  async execute(testFn: LighthouseTestFunction): Promise<void> {
    this.validateBrowser();

    if (!(await isLighthouseAvailable())) {
      throw new Error(
        'Lighthouse is not installed. Run: npm install -D lighthouse',
      );
    }

    // Execute test function (user navigates to page)
    await testFn(this.fixtures, this.testInfo);

    // Warmup audit if enabled
    if (this.testInfo.warmup) {
      logger.info('Running warmup audit...');
      try {
        await this.runAudit();
      } catch (e) {
        logger.warn('Warmup failed, continuing:', e);
      }
    }

    // Actual audit
    const metrics = await this.runAudit();

    // Assert and attach
    let error: Error | null = null;
    try {
      assertLighthouseThresholds({ metrics, testInfo: this.testInfo });
    } catch (e) {
      error = e as Error;
    }

    try {
      await attachLighthouseResults(this.testInfo, metrics);
    } catch (e) {
      logger.warn('Failed to attach results:', e);
    }

    if (error) throw error;
  }

  private validateBrowser(): void {
    const browserName = this.page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      throw new Error(
        `Lighthouse requires Chromium. Current: ${browserName ?? 'unknown'}`,
      );
    }
  }

  private async runAudit(): Promise<LighthouseMetrics> {
    const { throttling, categories, formFactor, skipAudits } = this.testInfo;
    const url = this.page.url();

    logger.info(`Auditing ${url}...`);
    logger.info(`Throttling: ${formatThrottling(throttling.cpu, throttling.network)}`);

    const lighthouse = (await import('lighthouse')).default;
    const browser = this.page.context().browser()!;
    const port = parseInt(new URL(browser.wsEndpoint()).port, 10);

    const lhThrottling = mapToLighthouseThrottling(throttling.cpu, throttling.network);

    const startTime = Date.now();
    const result = await lighthouse(url, {
      port,
      output: 'json',
      onlyCategories: categories,
      skipAudits: skipAudits.length > 0 ? skipAudits : undefined,
      formFactor,
      throttling: lhThrottling,
      disableStorageReset: true,
    });

    if (!result?.lhr) {
      throw new Error('Lighthouse returned no results');
    }

    const { categories: cats } = result.lhr;
    const metrics: LighthouseMetrics = {
      performance: this.extractScore(cats.performance),
      accessibility: this.extractScore(cats.accessibility),
      bestPractices: this.extractScore(cats['best-practices']),
      seo: this.extractScore(cats.seo),
      pwa: this.extractScore(cats.pwa),
      auditDurationMs: Date.now() - startTime,
      url: result.lhr.finalDisplayedUrl || url,
      timestamp: new Date().toISOString(),
    };

    logger.info(
      `Completed in ${(metrics.auditDurationMs / 1000).toFixed(1)}s: ` +
      `Perf=${metrics.performance ?? 'N/A'}, A11y=${metrics.accessibility ?? 'N/A'}`,
    );

    return metrics;
  }

  private extractScore(category?: { score: number | null }): number | null {
    return category?.score !== null && category?.score !== undefined
      ? Math.round(category.score * 100)
      : null;
  }
}
```

---

### 5. `src/lighthouse/createLighthouseTest.ts`

Mirrors createPerformanceTest.ts pattern.

```typescript
import type { TestType } from '@playwright/test';

import { createConfiguredTestInfo } from './lighthouseConfig';
import { LighthouseTestRunner } from './LighthouseTestRunner';
import type {
  LighthouseTestConfig,
  LighthouseTestFixtures,
  LighthouseTestFunction,
} from './types';

export type LighthouseTest<
  T extends LighthouseTestFixtures,
  W extends object = object,
> = TestType<T, W> & {
  lighthouse: (
    config: LighthouseTestConfig,
  ) => (
    title: string,
    testFn: LighthouseTestFunction,
  ) => ReturnType<TestType<T, W>>;
};

/**
 * Extends a Playwright test with the `lighthouse` method.
 */
export function createLighthouseTest<
  T extends LighthouseTestFixtures,
  W extends object = object,
>(baseTest: TestType<T, W>): LighthouseTest<T, W> {
  const lighthouse = (config: LighthouseTestConfig) => {
    return (title: string, testFn: LighthouseTestFunction) => {
      return baseTest(title, async ({ page }, testInfo) => {
        const configured = createConfiguredTestInfo(testInfo, config, title);
        const fixtures: LighthouseTestFixtures = { page };
        const runner = new LighthouseTestRunner(page, fixtures, configured);
        await runner.execute(testFn);
      });
    };
  };

  return Object.assign(baseTest, { lighthouse }) as LighthouseTest<T, W>;
}
```

---

### 6. `src/lighthouse/index.ts`

```typescript
// Factory
export { createLighthouseTest, type LighthouseTest } from './createLighthouseTest';

// Runner
export { LighthouseTestRunner } from './LighthouseTestRunner';

// Config
export {
  createConfiguredTestInfo,
  formatThrottling,
  mapToLighthouseThrottling,
  resolveBuffers,
  resolveConfig,
  resolveThresholds,
  type LighthouseThrottlingSettings,
} from './lighthouseConfig';

// Assertions
export { assertLighthouseThresholds, attachLighthouseResults } from './lighthouseAssertions';

// Types
export type {
  ConfiguredLighthouseTestInfo,
  LighthouseBufferConfig,
  LighthouseCategoryId,
  LighthouseMetrics,
  LighthouseNetworkConditions,
  LighthouseNetworkThrottling,
  LighthouseScore,
  LighthouseTestConfig,
  LighthouseTestFixtures,
  LighthouseTestFunction,
  LighthouseThresholdConfig,
  LighthouseThresholds,
  LighthouseThrottlingConfig,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseTestConfig,
  ResolvedLighthouseThresholds,
} from './types';
```

---

### 7. Update `src/index.ts`

```typescript
// ... existing exports

// Lighthouse
export { createLighthouseTest, type LighthouseTest } from './lighthouse';
export type {
  LighthouseMetrics,
  LighthouseTestConfig,
  LighthouseThresholds,
} from './lighthouse';
```

---

### 8. Update `package.json`

```json
{
  "exports": {
    "./lighthouse": {
      "types": "./dist/lighthouse/index.d.ts",
      "import": "./dist/lighthouse/index.js",
      "require": "./dist/lighthouse/index.cjs"
    }
  },
  "peerDependencies": {
    "lighthouse": ">=11.0.0"
  },
  "peerDependenciesMeta": {
    "lighthouse": {
      "optional": true
    }
  }
}
```

---

## What Changed from Original Plan

| Aspect | Original | Revised |
|--------|----------|---------|
| File count | 10+ files | 6 files |
| Directory depth | 4 levels (config/, runner/, etc.) | Flat |
| Shared module | New `src/shared/` with moved files | None - import from existing |
| Network presets | Duplicated | Reuse from `features/networkThrottling` |
| Logging/tables | Custom implementation | Reuse from `assertions/logging.ts` |
| isCI detection | Own constant | Reuse `PERFORMANCE_CONFIG.isCI` |
| thresholdCalculator | Moved to shared | Import from existing location |

---

## Testing Strategy

### Unit Tests

```
tests/unit/lighthouse/
├── lighthouseConfig.test.ts    # Config resolution
└── lighthouseAssertions.test.ts # Score validation
```

### Integration Tests

```typescript
// tests/integration/lighthouse.spec.ts
import { test as base } from '@playwright/test';
import { createLighthouseTest } from '../../src/lighthouse';

const test = createLighthouseTest(base);

test.lighthouse({
  thresholds: { performance: 50, accessibility: 50 },
})('basic audit', async ({ page }) => {
  await page.goto('/');
});
```

---

## Implementation Phases

### Phase 1: Core (2 files)
- [ ] `src/lighthouse/types.ts`
- [ ] `src/lighthouse/lighthouseConfig.ts`

### Phase 2: Execution (2 files)
- [ ] `src/lighthouse/lighthouseAssertions.ts`
- [ ] `src/lighthouse/LighthouseTestRunner.ts`

### Phase 3: Factory & Exports (2 files)
- [ ] `src/lighthouse/createLighthouseTest.ts`
- [ ] `src/lighthouse/index.ts`

### Phase 4: Integration
- [ ] Update `src/index.ts`
- [ ] Update `package.json`

### Phase 5: Testing
- [ ] Unit tests
- [ ] Integration tests

### Phase 6: Documentation
- [ ] `site/pages/docs/guides/lighthouse.mdx`
- [ ] Update `CLAUDE.md`

---

## Acceptance Criteria

1. **6 new files** in `src/lighthouse/`
2. **No moved files** - reuse via imports
3. **Consistent patterns** with existing playwright module
4. **Reuses** logging, network presets, threshold calculator
5. **Separate import path**: `react-performance-tracking/lighthouse`
6. **Chromium-only** with clear error
7. **Optional lighthouse** peer dependency
