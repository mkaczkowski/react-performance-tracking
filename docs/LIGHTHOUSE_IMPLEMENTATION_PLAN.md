# Lighthouse Score Cards Integration - Implementation Plan

> **Status**: Proposed
> **Created**: 2025-12-26
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
│             └──────────┬───────────────────┘                    │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Shared Utilities                       │   │
│  │  • calculateEffectiveMinThreshold (buffer calc)          │   │
│  │  • createLogger (logging)                                │   │
│  │  • Network presets                                       │   │
│  │  • TestInfo.attach pattern                               │   │
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
    network: 'fast-3g',        // Network preset or custom config
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

## File Structure

```
src/
├── lighthouse/                          # NEW: Separate lighthouse module
│   ├── index.ts                         # Public exports
│   ├── types.ts                         # All lighthouse types
│   ├── createLighthouseTest.ts          # Factory function
│   ├── config/
│   │   ├── lighthouseConfig.ts          # Default config constants
│   │   └── configResolver.ts            # Config resolution with CI handling
│   ├── runner/
│   │   └── LighthouseTestRunner.ts      # Orchestrates lighthouse execution
│   ├── throttling/
│   │   └── throttlingMapper.ts          # Maps config to Lighthouse throttling
│   ├── assertions/
│   │   ├── lighthouseAssertions.ts      # Main assertion orchestrator
│   │   └── validators.ts                # Individual score validators
│   └── metrics/
│       └── metricsAttachment.ts         # Attach results to test report
│
├── shared/                              # NEW: Extracted shared utilities
│   ├── index.ts
│   └── thresholdCalculator.ts           # MOVED from playwright/utils
│
├── playwright/                          # EXISTING: Minor updates only
│   └── utils/thresholdCalculator.ts     # UPDATE: Re-export from shared
│
└── index.ts                             # UPDATE: Add lighthouse exports
```

---

## Detailed File Specifications

### 1. `src/lighthouse/types.ts`

```typescript
import type { Page, TestInfo } from '@playwright/test';

// ============================================
// Score Types
// ============================================

/** Lighthouse score (0-100) */
export type LighthouseScore = number;

/** Percentage for buffers (0-100) */
export type Percentage = number;

/** Lighthouse audit category identifiers */
export type LighthouseCategoryId =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'pwa';

// ============================================
// Metrics Types
// ============================================

/**
 * Lighthouse audit results captured during test execution.
 */
export type LighthouseMetrics = {
  /** Performance score (0-100) */
  performance: LighthouseScore | null;
  /** Accessibility score (0-100) */
  accessibility: LighthouseScore | null;
  /** Best Practices score (0-100) */
  bestPractices: LighthouseScore | null;
  /** SEO score (0-100) */
  seo: LighthouseScore | null;
  /** PWA score (0-100) */
  pwa: LighthouseScore | null;
  /** Audit duration in milliseconds */
  auditDurationMs: number;
  /** The URL that was audited */
  url: string;
  /** Timestamp of the audit */
  timestamp: string;
};

/**
 * Extended metrics including raw Lighthouse report.
 */
export type LighthouseMetricsWithRaw = LighthouseMetrics & {
  /** Raw Lighthouse Result (LHR) for advanced inspection */
  rawLhr?: unknown;
};

// ============================================
// Throttling Types
// ============================================

/** Network throttling preset names */
export type NetworkPreset =
  | 'slow-3g'
  | 'fast-3g'
  | 'slow-4g'
  | 'fast-4g'
  | 'desktop'
  | 'offline';

/** Custom network conditions */
export type NetworkConditions = {
  /** Request latency in milliseconds */
  latencyMs: number;
  /** Download throughput in Kbps */
  downloadKbps: number;
  /** Upload throughput in Kbps */
  uploadKbps: number;
};

/** Network throttling configuration */
export type NetworkThrottling = NetworkPreset | NetworkConditions;

/**
 * Throttling configuration for Lighthouse audits.
 */
export type LighthouseThrottlingConfig = {
  /** CPU slowdown multiplier (1 = no throttling, 4 = 4x slower) */
  cpu?: number;
  /** Network throttling preset or custom config */
  network?: NetworkThrottling;
};

// ============================================
// Threshold Types
// ============================================

/**
 * User-facing threshold configuration for Lighthouse scores.
 * All thresholds are optional - only configured values are validated.
 */
export type LighthouseThresholds = {
  /** Minimum Performance score (0-100) */
  performance?: LighthouseScore;
  /** Minimum Accessibility score (0-100) */
  accessibility?: LighthouseScore;
  /** Minimum Best Practices score (0-100) */
  bestPractices?: LighthouseScore;
  /** Minimum SEO score (0-100) */
  seo?: LighthouseScore;
  /** Minimum PWA score (0-100) */
  pwa?: LighthouseScore;
};

/**
 * Resolved thresholds with all values guaranteed.
 * 0 means no validation for that category.
 */
export type ResolvedLighthouseThresholds = Required<LighthouseThresholds>;

/**
 * Environment-aware threshold configuration.
 */
export type LighthouseThresholdConfig = {
  base: LighthouseThresholds;
  ci?: Partial<LighthouseThresholds>;
};

// ============================================
// Buffer Types
// ============================================

/**
 * Buffer configuration for Lighthouse thresholds.
 * Buffers are SUBTRACTIVE (threshold - buffer% = minimum).
 */
export type LighthouseBufferConfig = {
  performance?: Percentage;
  accessibility?: Percentage;
  bestPractices?: Percentage;
  seo?: Percentage;
  pwa?: Percentage;
};

/**
 * Resolved buffer configuration with defaults applied.
 */
export type ResolvedLighthouseBufferConfig = Required<LighthouseBufferConfig>;

// ============================================
// Test Configuration Types
// ============================================

/**
 * User-facing configuration for test.lighthouse().
 */
export type LighthouseTestConfig = {
  /**
   * Throttling settings for the audit.
   * - cpu: CPU slowdown multiplier (default: 4)
   * - network: Network preset or custom config (default: 'fast-4g')
   */
  throttling?: LighthouseThrottlingConfig;

  /**
   * Score thresholds. Supports environment-specific config.
   * Shorthand: `{ performance: 90 }` expands to `{ base: { performance: 90 } }`
   */
  thresholds: LighthouseThresholds | LighthouseThresholdConfig;

  /**
   * Buffer percentages for threshold tolerance.
   * Default: 5% for all categories.
   */
  buffers?: LighthouseBufferConfig;

  /**
   * Categories to audit.
   * Default: ['performance', 'accessibility', 'best-practices', 'seo']
   */
  categories?: LighthouseCategoryId[];

  /**
   * Form factor for the audit.
   * Default: 'mobile'
   */
  formFactor?: 'mobile' | 'desktop';

  /**
   * Run a warmup audit before the actual audit.
   * Warmup results are discarded.
   * Default: true in CI, false locally
   */
  warmup?: boolean;

  /**
   * Custom name for test artifacts.
   */
  name?: string;

  /**
   * Include raw Lighthouse result in metrics attachment.
   * Useful for debugging but increases file size.
   * Default: false
   */
  includeRawResult?: boolean;

  /**
   * Specific audits to skip (e.g., 'robots-txt' for local testing).
   */
  skipAudits?: string[];
};

/**
 * Resolved configuration with all defaults applied.
 */
export type ResolvedLighthouseTestConfig = {
  throttling: Required<LighthouseThrottlingConfig>;
  thresholds: ResolvedLighthouseThresholds;
  buffers: ResolvedLighthouseBufferConfig;
  categories: LighthouseCategoryId[];
  formFactor: 'mobile' | 'desktop';
  warmup: boolean;
  name: string;
  includeRawResult: boolean;
  skipAudits: string[];
};

// ============================================
// Test Function Types
// ============================================

/**
 * Fixtures available in lighthouse tests.
 */
export type LighthouseTestFixtures = {
  page: Page;
};

/**
 * Test function signature for lighthouse tests.
 */
export type LighthouseTestFunction = (
  fixtures: LighthouseTestFixtures,
  testInfo: ConfiguredLighthouseTestInfo,
) => Promise<void> | void;

/**
 * TestInfo extended with resolved lighthouse configuration.
 */
export type ConfiguredLighthouseTestInfo = TestInfo & ResolvedLighthouseTestConfig;
```

---

### 2. `src/lighthouse/config/lighthouseConfig.ts`

```typescript
import type {
  LighthouseCategoryId,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseThresholds,
} from '../types';

/** Default CPU throttling multiplier (matches Lighthouse mobile) */
export const DEFAULT_CPU_THROTTLE = 4;

/** Default network throttling preset */
export const DEFAULT_NETWORK_PRESET = 'fast-4g' as const;

/** Default categories to audit */
export const DEFAULT_CATEGORIES: LighthouseCategoryId[] = [
  'performance',
  'accessibility',
  'best-practices',
  'seo',
];

/** Default buffer percentage (5% for scores 0-100) */
export const DEFAULT_BUFFER_PERCENT = 5;

/** Default resolved thresholds (all disabled) */
export const DEFAULT_LIGHTHOUSE_THRESHOLDS: ResolvedLighthouseThresholds = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  pwa: 0,
};

/** Default resolved buffers */
export const DEFAULT_LIGHTHOUSE_BUFFERS: ResolvedLighthouseBufferConfig = {
  performance: DEFAULT_BUFFER_PERCENT,
  accessibility: DEFAULT_BUFFER_PERCENT,
  bestPractices: DEFAULT_BUFFER_PERCENT,
  seo: DEFAULT_BUFFER_PERCENT,
  pwa: DEFAULT_BUFFER_PERCENT,
};

/** Detect CI environment */
export const isCI = Boolean(process.env.CI);

/** Google's recommended score thresholds for reference */
export const GOOGLE_RECOMMENDATIONS = {
  performance: { good: 90, poor: 50 },
  accessibility: { good: 90, poor: 50 },
  bestPractices: { good: 90, poor: 50 },
  seo: { good: 90, poor: 50 },
} as const;
```

---

### 3. `src/lighthouse/config/configResolver.ts`

```typescript
import type { TestInfo } from '@playwright/test';

import {
  DEFAULT_CATEGORIES,
  DEFAULT_CPU_THROTTLE,
  DEFAULT_LIGHTHOUSE_BUFFERS,
  DEFAULT_NETWORK_PRESET,
  isCI,
} from './lighthouseConfig';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseBufferConfig,
  LighthouseTestConfig,
  LighthouseThresholdConfig,
  LighthouseThresholds,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseTestConfig,
  ResolvedLighthouseThresholds,
} from '../types';

/**
 * Checks if thresholds use the shorthand format.
 */
function isShorthandThresholds(
  thresholds: LighthouseThresholds | LighthouseThresholdConfig,
): thresholds is LighthouseThresholds {
  return !('base' in thresholds);
}

/**
 * Normalizes threshold config to full format.
 */
function normalizeThresholdConfig(
  thresholds: LighthouseThresholds | LighthouseThresholdConfig,
): LighthouseThresholdConfig {
  if (isShorthandThresholds(thresholds)) {
    return { base: thresholds };
  }
  return thresholds;
}

/**
 * Resolves thresholds with CI overrides.
 */
export function resolveThresholds(
  config: LighthouseThresholds | LighthouseThresholdConfig,
): ResolvedLighthouseThresholds {
  const normalized = normalizeThresholdConfig(config);
  const merged = isCI
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

/**
 * Resolves buffer configuration with defaults.
 */
export function resolveBuffers(
  buffers?: LighthouseBufferConfig,
): ResolvedLighthouseBufferConfig {
  return {
    performance: buffers?.performance ?? DEFAULT_LIGHTHOUSE_BUFFERS.performance,
    accessibility: buffers?.accessibility ?? DEFAULT_LIGHTHOUSE_BUFFERS.accessibility,
    bestPractices: buffers?.bestPractices ?? DEFAULT_LIGHTHOUSE_BUFFERS.bestPractices,
    seo: buffers?.seo ?? DEFAULT_LIGHTHOUSE_BUFFERS.seo,
    pwa: buffers?.pwa ?? DEFAULT_LIGHTHOUSE_BUFFERS.pwa,
  };
}

/**
 * Creates fully resolved configuration.
 */
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
    warmup: config.warmup ?? isCI,
    name: config.name ?? `lighthouse-${testTitle.replace(/\s+/g, '-').toLowerCase()}`,
    includeRawResult: config.includeRawResult ?? false,
    skipAudits: config.skipAudits ?? [],
  };
}

/**
 * Creates ConfiguredLighthouseTestInfo by merging TestInfo with resolved config.
 */
export function createConfiguredTestInfo(
  testInfo: TestInfo,
  config: LighthouseTestConfig,
  testTitle: string,
): ConfiguredLighthouseTestInfo {
  const resolved = resolveConfig(config, testTitle);
  return Object.assign({}, testInfo, resolved) as ConfiguredLighthouseTestInfo;
}

/**
 * Adds configuration annotation for test reports.
 */
export function addConfigurationAnnotation(
  testInfo: TestInfo,
  config: ResolvedLighthouseTestConfig,
): void {
  testInfo.annotations.push({
    type: 'lighthouse-config',
    description: JSON.stringify({
      throttling: config.throttling,
      categories: config.categories,
      formFactor: config.formFactor,
      warmup: config.warmup,
    }),
  });
}
```

---

### 4. `src/lighthouse/throttling/throttlingMapper.ts`

```typescript
import type {
  LighthouseThrottlingConfig,
  NetworkPreset,
  NetworkThrottling
} from '../types';
import {
  DEFAULT_CPU_THROTTLE,
  DEFAULT_NETWORK_PRESET
} from '../config/lighthouseConfig';

/**
 * Lighthouse throttling settings passed to the lighthouse API.
 */
export interface LighthouseThrottlingSettings {
  cpuSlowdownMultiplier: number;
  requestLatencyMs: number;
  downloadThroughputKbps: number;
  uploadThroughputKbps: number;
  throughputKbps: number;
  rttMs: number;
}

/**
 * Network preset configurations (matching Chrome DevTools).
 */
const NETWORK_PRESETS: Record<
  NetworkPreset,
  Omit<LighthouseThrottlingSettings, 'cpuSlowdownMultiplier'>
> = {
  'slow-3g': {
    requestLatencyMs: 400,
    downloadThroughputKbps: 500,
    uploadThroughputKbps: 500,
    throughputKbps: 500,
    rttMs: 400,
  },
  'fast-3g': {
    requestLatencyMs: 150,
    downloadThroughputKbps: 1600,
    uploadThroughputKbps: 750,
    throughputKbps: 1600,
    rttMs: 150,
  },
  'slow-4g': {
    requestLatencyMs: 100,
    downloadThroughputKbps: 3000,
    uploadThroughputKbps: 1500,
    throughputKbps: 3000,
    rttMs: 100,
  },
  'fast-4g': {
    requestLatencyMs: 20,
    downloadThroughputKbps: 10000,
    uploadThroughputKbps: 5000,
    throughputKbps: 10000,
    rttMs: 20,
  },
  'desktop': {
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,  // 0 = no throttling
    uploadThroughputKbps: 0,
    throughputKbps: 0,
    rttMs: 0,
  },
  'offline': {
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
    throughputKbps: 0,
    rttMs: 0,
  },
};

/**
 * Checks if network config is a preset name.
 */
function isNetworkPreset(network: NetworkThrottling): network is NetworkPreset {
  return typeof network === 'string';
}

/**
 * Resolves network throttling to Lighthouse settings.
 */
function resolveNetworkThrottling(
  network: NetworkThrottling,
): Omit<LighthouseThrottlingSettings, 'cpuSlowdownMultiplier'> {
  if (isNetworkPreset(network)) {
    return NETWORK_PRESETS[network];
  }

  // Custom network conditions
  return {
    requestLatencyMs: network.latencyMs,
    downloadThroughputKbps: network.downloadKbps,
    uploadThroughputKbps: network.uploadKbps,
    throughputKbps: network.downloadKbps,
    rttMs: network.latencyMs,
  };
}

/**
 * Maps test throttling config to Lighthouse throttling settings.
 */
export function mapToLighthouseThrottling(
  config?: LighthouseThrottlingConfig,
): LighthouseThrottlingSettings {
  const cpu = config?.cpu ?? DEFAULT_CPU_THROTTLE;
  const network = config?.network ?? DEFAULT_NETWORK_PRESET;
  const networkSettings = resolveNetworkThrottling(network);

  return {
    cpuSlowdownMultiplier: cpu,
    ...networkSettings,
  };
}

/**
 * Formats throttling config for display.
 */
export function formatThrottling(config: LighthouseThrottlingConfig): string {
  const cpu = config.cpu ?? DEFAULT_CPU_THROTTLE;
  const network = config.network ?? DEFAULT_NETWORK_PRESET;

  const networkStr = typeof network === 'string'
    ? network
    : `${network.downloadKbps}Kbps/${network.latencyMs}ms`;

  return `CPU ${cpu}x, Network: ${networkStr}`;
}
```

---

### 5. `src/lighthouse/runner/LighthouseTestRunner.ts`

```typescript
import type { Page } from '@playwright/test';

import { createLogger } from '../../utils';
import {
  mapToLighthouseThrottling,
  formatThrottling
} from '../throttling/throttlingMapper';
import { assertLighthouseThresholds } from '../assertions/lighthouseAssertions';
import { attachLighthouseResults } from '../metrics/metricsAttachment';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseMetrics,
  LighthouseTestFixtures,
  LighthouseTestFunction,
} from '../types';

const logger = createLogger('Lighthouse');

/**
 * Checks if Lighthouse is available.
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
 * Orchestrates Lighthouse test execution.
 */
export class LighthouseTestRunner {
  private readonly page: Page;
  private readonly fixtures: LighthouseTestFixtures;
  private readonly testInfo: ConfiguredLighthouseTestInfo;

  constructor(
    page: Page,
    fixtures: LighthouseTestFixtures,
    testInfo: ConfiguredLighthouseTestInfo,
  ) {
    this.page = page;
    this.fixtures = fixtures;
    this.testInfo = testInfo;
  }

  /**
   * Executes the complete lighthouse test flow.
   */
  async execute(testFn: LighthouseTestFunction): Promise<void> {
    // Validate browser compatibility
    await this.validateBrowser();

    // Check lighthouse availability
    if (!(await isLighthouseAvailable())) {
      throw new Error(
        'Lighthouse is not installed. Add "lighthouse" as a dev dependency:\n' +
        '  npm install -D lighthouse',
      );
    }

    // Execute test function (user navigates to desired page)
    await testFn(this.fixtures, this.testInfo);

    // Run warmup if enabled
    if (this.testInfo.warmup) {
      await this.runWarmupAudit();
    }

    // Run actual audit
    const metrics = await this.runAudit();

    // Assert thresholds
    await this.assertAndReport(metrics);
  }

  private async validateBrowser(): Promise<void> {
    const browser = this.page.context().browser();
    const browserName = browser?.browserType().name();

    if (browserName !== 'chromium') {
      throw new Error(
        `Lighthouse requires Chromium browser. Current: ${browserName ?? 'unknown'}.\n` +
        'Run with: npx playwright test --project=chromium',
      );
    }
  }

  private async runWarmupAudit(): Promise<void> {
    logger.info('Running warmup audit (results will be discarded)...');

    try {
      await this.runLighthouseAudit();
      logger.debug('Warmup audit completed');
    } catch (error) {
      logger.warn('Warmup audit failed (continuing with actual audit):', error);
    }
  }

  private async runAudit(): Promise<LighthouseMetrics> {
    logger.info(`Running Lighthouse audit on ${this.page.url()}...`);
    logger.info(`Throttling: ${formatThrottling(this.testInfo.throttling)}`);

    const startTime = Date.now();
    const result = await this.runLighthouseAudit();
    const auditDurationMs = Date.now() - startTime;

    const metrics: LighthouseMetrics = {
      performance: this.extractScore(result.categories.performance),
      accessibility: this.extractScore(result.categories.accessibility),
      bestPractices: this.extractScore(result.categories['best-practices']),
      seo: this.extractScore(result.categories.seo),
      pwa: this.extractScore(result.categories.pwa),
      auditDurationMs,
      url: result.finalDisplayedUrl || this.page.url(),
      timestamp: new Date().toISOString(),
    };

    logger.info(
      `Audit completed in ${(auditDurationMs / 1000).toFixed(1)}s: ` +
      `Performance=${metrics.performance ?? 'N/A'}, ` +
      `Accessibility=${metrics.accessibility ?? 'N/A'}, ` +
      `Best Practices=${metrics.bestPractices ?? 'N/A'}, ` +
      `SEO=${metrics.seo ?? 'N/A'}`,
    );

    return metrics;
  }

  private extractScore(
    category?: { score: number | null },
  ): number | null {
    if (!category || category.score === null) {
      return null;
    }
    return Math.round(category.score * 100);
  }

  private async runLighthouseAudit(): Promise<LighthouseResult> {
    const lighthouse = (await import('lighthouse')).default;
    const browser = this.page.context().browser()!;
    const wsEndpoint = browser.wsEndpoint();
    const port = parseInt(new URL(wsEndpoint).port, 10);
    const url = this.page.url();

    const throttling = mapToLighthouseThrottling(this.testInfo.throttling);

    const result = await lighthouse(url, {
      port,
      output: 'json',
      onlyCategories: this.testInfo.categories,
      skipAudits: this.testInfo.skipAudits.length > 0
        ? this.testInfo.skipAudits
        : undefined,
      formFactor: this.testInfo.formFactor,
      throttling,
      // Preserve browser state (cookies, localStorage, etc.)
      disableStorageReset: true,
    });

    if (!result?.lhr) {
      throw new Error('Lighthouse returned no results');
    }

    return result.lhr;
  }

  private async assertAndReport(metrics: LighthouseMetrics): Promise<void> {
    let assertionError: Error | null = null;

    try {
      assertLighthouseThresholds({
        metrics,
        testInfo: this.testInfo,
      });
    } catch (error) {
      assertionError = error as Error;
    }

    // Always attach results, even if assertions failed
    try {
      await attachLighthouseResults({
        testInfo: this.testInfo,
        metrics,
      });
    } catch (attachError) {
      logger.warn('Failed to attach Lighthouse results:', attachError);
    }

    if (assertionError) {
      throw assertionError;
    }
  }
}

// Type for Lighthouse result (simplified)
interface LighthouseResult {
  categories: {
    performance?: { score: number | null };
    accessibility?: { score: number | null };
    'best-practices'?: { score: number | null };
    seo?: { score: number | null };
    pwa?: { score: number | null };
  };
  finalDisplayedUrl?: string;
}
```

---

### 6. `src/lighthouse/assertions/validators.ts`

```typescript
import { expect } from '@playwright/test';

import { calculateEffectiveMinThreshold } from '../../shared/thresholdCalculator';
import type { LighthouseScore, Percentage } from '../types';

/** Category display names for assertions */
export const CATEGORY_NAMES: Record<string, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  bestPractices: 'Best Practices',
  seo: 'SEO',
  pwa: 'PWA',
};

type ScoreAssertionParams = {
  actual: LighthouseScore;
  threshold: LighthouseScore;
  bufferPercent: Percentage;
  category: string;
};

/**
 * Validates a Lighthouse category score meets the minimum threshold.
 * Buffer is SUBTRACTIVE since higher scores are better.
 */
export function assertScore({
  actual,
  threshold,
  bufferPercent,
  category,
}: ScoreAssertionParams): void {
  const effective = calculateEffectiveMinThreshold(threshold, bufferPercent);
  const displayName = CATEGORY_NAMES[category] ?? category;

  expect(
    actual,
    `Lighthouse ${displayName} should be ≥${effective.toFixed(0)} ` +
      `(actual: ${actual}, threshold: ${threshold} - ${bufferPercent}% buffer)`,
  ).toBeGreaterThanOrEqual(effective);
}
```

---

### 7. `src/lighthouse/assertions/lighthouseAssertions.ts`

```typescript
import { createLogger } from '../../utils';
import { assertScore, CATEGORY_NAMES } from './validators';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseMetrics,
  LighthouseScore,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseThresholds,
} from '../types';

const logger = createLogger('Lighthouse');

type AssertParams = {
  metrics: LighthouseMetrics;
  testInfo: ConfiguredLighthouseTestInfo;
};

type CategoryResult = {
  category: string;
  displayName: string;
  actual: LighthouseScore | null;
  threshold: LighthouseScore;
  effective: number;
  passed: boolean | null; // null if not audited
};

/**
 * Asserts all configured Lighthouse thresholds.
 */
export function assertLighthouseThresholds({ metrics, testInfo }: AssertParams): void {
  const { thresholds, buffers } = testInfo;

  // Build results for logging
  const results = buildCategoryResults(metrics, thresholds, buffers);

  // Log results table
  logResultsTable(results, metrics);

  // Run assertions (throws on first failure)
  runAssertions(results, buffers);
}

function buildCategoryResults(
  metrics: LighthouseMetrics,
  thresholds: ResolvedLighthouseThresholds,
  buffers: ResolvedLighthouseBufferConfig,
): CategoryResult[] {
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

  return categories.map(({ key, actual }) => {
    const threshold = thresholds[key];
    const buffer = buffers[key];
    const effective = threshold * (1 - buffer / 100);

    let passed: boolean | null = null;
    if (threshold > 0 && actual !== null) {
      passed = actual >= effective;
    }

    return {
      category: key,
      displayName: CATEGORY_NAMES[key] ?? key,
      actual,
      threshold,
      effective,
      passed,
    };
  });
}

function logResultsTable(
  results: CategoryResult[],
  metrics: LighthouseMetrics,
): void {
  console.log('\n┌─────────────────┬───────┬───────────┬────────┐');
  console.log('│ Category        │ Score │ Threshold │ Status │');
  console.log('├─────────────────┼───────┼───────────┼────────┤');

  for (const result of results) {
    if (result.threshold === 0 && result.actual === null) {
      continue; // Skip unconfigured categories
    }

    const scoreStr = result.actual !== null
      ? String(result.actual).padStart(3)
      : 'N/A';
    const thresholdStr = result.threshold > 0
      ? `≥${result.effective.toFixed(0)}`.padStart(5)
      : '  -  ';
    const statusStr = result.passed === null
      ? '   -   '
      : result.passed
        ? ' ✓ PASS'
        : ' ✗ FAIL';

    console.log(
      `│ ${result.displayName.padEnd(15)} │ ${scoreStr}   │ ${thresholdStr}     │${statusStr} │`,
    );
  }

  console.log('└─────────────────┴───────┴───────────┴────────┘');
  console.log(`  URL: ${metrics.url}`);
  console.log(`  Duration: ${(metrics.auditDurationMs / 1000).toFixed(1)}s\n`);
}

function runAssertions(
  results: CategoryResult[],
  buffers: ResolvedLighthouseBufferConfig,
): void {
  for (const result of results) {
    if (result.threshold > 0 && result.actual !== null) {
      assertScore({
        actual: result.actual,
        threshold: result.threshold,
        bufferPercent: buffers[result.category as keyof ResolvedLighthouseBufferConfig],
        category: result.category,
      });
    }
  }
}
```

---

### 8. `src/lighthouse/metrics/metricsAttachment.ts`

```typescript
import { isCI } from '../config/lighthouseConfig';
import type { ConfiguredLighthouseTestInfo, LighthouseMetrics } from '../types';

/**
 * Attachment data structure for test results.
 */
type AttachmentData = {
  metrics: LighthouseMetrics;
  throttling: ConfiguredLighthouseTestInfo['throttling'];
  thresholds: ConfiguredLighthouseTestInfo['thresholds'];
  buffers: ConfiguredLighthouseTestInfo['buffers'];
  categories: ConfiguredLighthouseTestInfo['categories'];
  formFactor: ConfiguredLighthouseTestInfo['formFactor'];
  warmup: boolean;
  environment: 'ci' | 'local';
};

/**
 * Attaches Lighthouse test results as JSON artifact to test report.
 */
export async function attachLighthouseResults({
  testInfo,
  metrics,
}: {
  testInfo: ConfiguredLighthouseTestInfo;
  metrics: LighthouseMetrics;
}): Promise<void> {
  const {
    name,
    throttling,
    thresholds,
    buffers,
    categories,
    formFactor,
    warmup
  } = testInfo;

  const attachmentData: AttachmentData = {
    metrics,
    throttling,
    thresholds,
    buffers,
    categories,
    formFactor,
    warmup,
    environment: isCI ? 'ci' : 'local',
  };

  await testInfo.attach(name, {
    body: JSON.stringify(attachmentData, null, 2),
    contentType: 'application/json',
  });
}
```

---

### 9. `src/lighthouse/createLighthouseTest.ts`

```typescript
import type { TestType } from '@playwright/test';

import {
  addConfigurationAnnotation,
  createConfiguredTestInfo
} from './config/configResolver';
import { LighthouseTestRunner } from './runner/LighthouseTestRunner';
import type {
  LighthouseTestConfig,
  LighthouseTestFixtures,
  LighthouseTestFunction,
} from './types';

/**
 * Type for the extended test with lighthouse method.
 */
export type LighthouseTest<
  T extends LighthouseTestFixtures,
  W extends object = object
> = TestType<T, W> & {
  lighthouse: (
    config: LighthouseTestConfig,
  ) => (
    title: string,
    testFn: LighthouseTestFunction,
  ) => ReturnType<TestType<T, W>>;
};

/**
 * Extends a Playwright test with the `lighthouse` helper method
 * that runs Lighthouse audits and asserts score thresholds.
 *
 * @example
 * ```typescript
 * import { test as base } from '@playwright/test';
 * import { createLighthouseTest } from 'react-performance-tracking/lighthouse';
 *
 * const test = createLighthouseTest(base);
 *
 * test.lighthouse({
 *   thresholds: { performance: 90, accessibility: 95 },
 * })('homepage audit', async ({ page }) => {
 *   await page.goto('/');
 * });
 * ```
 */
export function createLighthouseTest<
  T extends LighthouseTestFixtures,
  W extends object = object,
>(baseTest: TestType<T, W>): LighthouseTest<T, W> {
  /**
   * Creates a Lighthouse test with the given configuration.
   */
  const lighthouse = (config: LighthouseTestConfig) => {
    return (title: string, testFn: LighthouseTestFunction) => {
      return baseTest(title, async ({ page }, testInfo) => {
        // Create configured test info
        const configuredTestInfo = createConfiguredTestInfo(
          testInfo,
          config,
          title,
        );

        // Add configuration annotation for test reports
        addConfigurationAnnotation(testInfo, configuredTestInfo);

        // Create fixtures
        const fixtures: LighthouseTestFixtures = { page };

        // Execute test with runner
        const runner = new LighthouseTestRunner(
          page,
          fixtures,
          configuredTestInfo,
        );
        await runner.execute(testFn);
      });
    };
  };

  // Return the base test with lighthouse method attached
  return Object.assign(baseTest, { lighthouse }) as LighthouseTest<T, W>;
}
```

---

### 10. `src/lighthouse/index.ts`

```typescript
// Main factory function
export {
  createLighthouseTest,
  type LighthouseTest
} from './createLighthouseTest';

// Configuration
export {
  DEFAULT_BUFFER_PERCENT,
  DEFAULT_CATEGORIES,
  DEFAULT_CPU_THROTTLE,
  DEFAULT_LIGHTHOUSE_BUFFERS,
  DEFAULT_LIGHTHOUSE_THRESHOLDS,
  DEFAULT_NETWORK_PRESET,
  GOOGLE_RECOMMENDATIONS,
  isCI,
} from './config/lighthouseConfig';

export {
  addConfigurationAnnotation,
  createConfiguredTestInfo,
  resolveBuffers,
  resolveConfig,
  resolveThresholds,
} from './config/configResolver';

// Throttling
export {
  formatThrottling,
  mapToLighthouseThrottling,
  type LighthouseThrottlingSettings,
} from './throttling/throttlingMapper';

// Assertions
export { assertLighthouseThresholds } from './assertions/lighthouseAssertions';
export { assertScore, CATEGORY_NAMES } from './assertions/validators';

// Runner
export { LighthouseTestRunner } from './runner/LighthouseTestRunner';

// Metrics
export { attachLighthouseResults } from './metrics/metricsAttachment';

// Types
export type {
  ConfiguredLighthouseTestInfo,
  LighthouseBufferConfig,
  LighthouseCategoryId,
  LighthouseMetrics,
  LighthouseMetricsWithRaw,
  LighthouseScore,
  LighthouseTestConfig,
  LighthouseTestFixtures,
  LighthouseTestFunction,
  LighthouseThresholdConfig,
  LighthouseThresholds,
  LighthouseThrottlingConfig,
  NetworkConditions,
  NetworkPreset,
  NetworkThrottling,
  Percentage,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseTestConfig,
  ResolvedLighthouseThresholds,
} from './types';
```

---

### 11. `src/shared/thresholdCalculator.ts`

Move from `src/playwright/utils/thresholdCalculator.ts`:

```typescript
/**
 * Validates threshold and buffer parameters.
 * @throws {Error} If threshold is negative or buffer is out of valid range
 */
const validateThresholdParams = (
  threshold: number,
  bufferPercent: number,
): void => {
  if (threshold < 0) {
    throw new Error(`Threshold must be non-negative, got: ${threshold}`);
  }
  if (bufferPercent < 0 || bufferPercent > 100) {
    throw new Error(
      `Buffer percent must be between 0 and 100, got: ${bufferPercent}`,
    );
  }
};

/**
 * Calculates the effective threshold with buffer tolerance.
 * For "lower is better" metrics (duration, rerenders), buffer is added.
 *
 * @param threshold - The base threshold value (must be non-negative)
 * @param bufferPercent - The buffer percentage to add (0-100)
 * @param ceil - Whether to ceil the result (useful for integer thresholds)
 * @returns The effective threshold with buffer applied
 */
export const calculateEffectiveThreshold = (
  threshold: number,
  bufferPercent: number,
  ceil = false,
): number => {
  validateThresholdParams(threshold, bufferPercent);
  const effective = threshold * (1 + bufferPercent / 100);
  return ceil ? Math.ceil(effective) : effective;
};

/**
 * Calculates the effective minimum threshold with buffer tolerance.
 * For "higher is better" metrics (FPS, Lighthouse scores), buffer is subtracted.
 *
 * @param threshold - The base threshold value (minimum required)
 * @param bufferPercent - The buffer percentage to subtract (0-100)
 * @param floor - Whether to floor the result
 * @returns The effective minimum threshold with buffer applied
 */
export const calculateEffectiveMinThreshold = (
  threshold: number,
  bufferPercent: number,
  floor = false,
): number => {
  validateThresholdParams(threshold, bufferPercent);
  const effective = threshold * (1 - bufferPercent / 100);
  return floor ? Math.floor(effective) : effective;
};
```

---

### 12. Update `src/playwright/utils/thresholdCalculator.ts`

Re-export from shared location:

```typescript
// Re-export from shared location for backwards compatibility
export {
  calculateEffectiveThreshold,
  calculateEffectiveMinThreshold
} from '../../shared/thresholdCalculator';
```

---

### 13. Update `src/index.ts`

```typescript
// ... existing exports

// Lighthouse exports
export { createLighthouseTest } from './lighthouse';
export type {
  LighthouseTestConfig,
  LighthouseThresholds,
  LighthouseMetrics,
  LighthouseTest,
} from './lighthouse';
```

---

### 14. Update `package.json`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js",
      "require": "./dist/react/index.cjs"
    },
    "./playwright": {
      "types": "./dist/playwright/index.d.ts",
      "import": "./dist/playwright/index.js",
      "require": "./dist/playwright/index.cjs"
    },
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
  },
  "devDependencies": {
    "lighthouse": "^12.0.0"
  }
}
```

---

## Reusable Utilities Summary

| Utility | Location | Used By |
|---------|----------|---------|
| `calculateEffectiveMinThreshold` | `src/shared/thresholdCalculator.ts` | Both playwright & lighthouse |
| `calculateEffectiveThreshold` | `src/shared/thresholdCalculator.ts` | playwright |
| `createLogger` | `src/utils/logger.ts` | Both |
| `expect` | `@playwright/test` | Both |
| `isCI` | Defined in each module | Both (same pattern) |

---

## Testing Strategy

### Unit Tests

Create `tests/unit/lighthouse/`:

```
tests/unit/lighthouse/
├── configResolver.test.ts      # Config resolution tests
├── throttlingMapper.test.ts    # Throttling mapping tests
├── validators.test.ts          # Score assertion tests
└── types.test.ts               # Type validation tests
```

### Integration Tests

Create `tests/integration/lighthouse.spec.ts`:

```typescript
import { test as base, expect } from '@playwright/test';
import { createLighthouseTest } from '../../src/lighthouse';

const test = createLighthouseTest(base);

test.describe('Lighthouse Integration', () => {
  test.lighthouse({
    thresholds: {
      performance: 50,  // Low threshold for test reliability
      accessibility: 50,
    },
  })('basic audit', async ({ page }) => {
    await page.goto('/');
  });

  test.lighthouse({
    throttling: { cpu: 2, network: 'fast-4g' },
    thresholds: { performance: 40 },
    warmup: true,
  })('with throttling', async ({ page }) => {
    await page.goto('/');
  });
});
```

---

## Documentation Updates

### Files to Create

| File | Description |
|------|-------------|
| `site/pages/docs/guides/lighthouse.mdx` | Full Lighthouse guide |
| `site/pages/docs/api/lighthouse.mdx` | Lighthouse API reference |

### Files to Update

| File | Changes |
|------|---------|
| `site/pages/docs/index.mdx` | Add Lighthouse to features |
| `site/pages/docs/api/configuration.mdx` | Add Lighthouse config ref |
| `docs/CODING_STANDARDS.md` | Add Lighthouse conventions |
| `CLAUDE.md` | Add Lighthouse architecture |

---

## Implementation Phases

### Phase 1: Core Module
- [ ] Create `src/lighthouse/types.ts`
- [ ] Create `src/lighthouse/config/lighthouseConfig.ts`
- [ ] Create `src/lighthouse/config/configResolver.ts`
- [ ] Create `src/shared/thresholdCalculator.ts` (move from playwright)

### Phase 2: Throttling & Runner
- [ ] Create `src/lighthouse/throttling/throttlingMapper.ts`
- [ ] Create `src/lighthouse/runner/LighthouseTestRunner.ts`

### Phase 3: Assertions & Metrics
- [ ] Create `src/lighthouse/assertions/validators.ts`
- [ ] Create `src/lighthouse/assertions/lighthouseAssertions.ts`
- [ ] Create `src/lighthouse/metrics/metricsAttachment.ts`

### Phase 4: Factory & Exports
- [ ] Create `src/lighthouse/createLighthouseTest.ts`
- [ ] Create `src/lighthouse/index.ts`
- [ ] Update `src/index.ts`
- [ ] Update `package.json`

### Phase 5: Testing
- [ ] Create unit tests
- [ ] Create integration tests
- [ ] Verify with test app

### Phase 6: Documentation
- [ ] Create `site/pages/docs/guides/lighthouse.mdx`
- [ ] Create `site/pages/docs/api/lighthouse.mdx`
- [ ] Update existing docs
- [ ] Update `CLAUDE.md`

---

## Acceptance Criteria

1. **Separate Import Path**: `import { createLighthouseTest } from 'react-performance-tracking/lighthouse'`
2. **Self-Contained Config**: Throttling, thresholds, buffers all within lighthouse config
3. **Chromium-Only**: Clear error message on non-Chromium browsers
4. **Optional Dependency**: Works without lighthouse installed (graceful error)
5. **CI Support**: Environment-aware thresholds (`base` + `ci`)
6. **Buffer Support**: Subtractive buffers for score thresholds
7. **Test Artifacts**: Results attached to Playwright report
8. **Warmup Support**: Optional warmup audit (discarded from results)
