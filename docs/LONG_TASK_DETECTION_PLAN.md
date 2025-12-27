# Long Task Detection - Implementation Plan

This document provides a comprehensive implementation plan for Long Task Detection and related features.

---

## Feature Overview

Long Tasks are JavaScript operations that block the main thread for >50ms, causing UI freezes and poor responsiveness. This feature captures long tasks via the PerformanceObserver API and provides actionable metrics.

### Related Features to Include

| Feature                       | Description                                           | Value     | Complexity |
| ----------------------------- | ----------------------------------------------------- | --------- | ---------- |
| **Long Task Detection**       | Track tasks >50ms via PerformanceObserver             | High      | Low        |
| **Total Blocking Time (TBT)** | Sum of blocking portions (time beyond 50ms threshold) | Very High | Low        |
| **Max Task Duration**         | Track the longest single task                         | High      | Low        |
| **Task Count**                | Number of long tasks during test                      | High      | Low        |
| **Script Attribution**        | Source URL of long task (when available)              | Medium    | Medium     |

> **Note:** Frame drop detection and jank scoring are better suited for the FPS feature enhancement (separate implementation).

---

## Technical Design

### 1. Types (`src/playwright/longTasks/types.ts`)

```typescript
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
```

### 2. Browser-Side Tracking (`src/playwright/longTasks/longTaskTracking.ts`)

```typescript
import type { Page } from '@playwright/test';
import { logger } from '../../utils';
import type { LongTaskMetrics } from './types';

const LONG_TASK_STORE_KEY = '__LONG_TASKS__';
const LONG_TASK_THRESHOLD = 50; // ms - tasks longer than this are "long"

interface LongTaskStoreEntry {
  duration: number;
  startTime: number;
  containerType: 'window' | 'iframe' | 'embed' | 'object';
  containerId?: string;
  containerName?: string;
  containerSrc?: string;
}

interface LongTaskStore {
  entries: LongTaskStoreEntry[];
  initialized: boolean;
}

declare global {
  interface Window {
    [LONG_TASK_STORE_KEY]?: LongTaskStore;
  }
}

/**
 * Browser-side script that initializes long task tracking.
 * Captures full attribution data for debugging.
 */
const createLongTaskSetupScript = (): (() => void) => {
  return function setupLongTasks(): void {
    const STORE_KEY = '__LONG_TASKS__';
    const THRESHOLD = 50;

    type ContainerType = 'window' | 'iframe' | 'embed' | 'object';

    interface BrowserLongTaskEntry {
      duration: number;
      startTime: number;
      containerType: ContainerType;
      containerId?: string;
      containerName?: string;
      containerSrc?: string;
    }

    interface BrowserLongTaskStore {
      entries: BrowserLongTaskEntry[];
      initialized: boolean;
    }

    type WindowWithStore = Window & { [STORE_KEY]?: BrowserLongTaskStore };

    // Check if already initialized
    const existingStore = (window as WindowWithStore)[STORE_KEY];
    if (existingStore?.initialized) {
      return;
    }

    // Initialize the store
    const store: BrowserLongTaskStore = {
      entries: [],
      initialized: true,
    };
    (window as WindowWithStore)[STORE_KEY] = store;

    // Check PerformanceObserver support
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('[LongTasks] PerformanceObserver not supported');
      return;
    }

    // Long Task Observer
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > THRESHOLD) {
            // Extract full attribution data
            const taskEntry = entry as PerformanceEntry & {
              attribution?: Array<{
                containerType?: string;
                containerId?: string;
                containerName?: string;
                containerSrc?: string;
              }>;
            };

            let containerType: ContainerType = 'window';
            let containerId: string | undefined;
            let containerName: string | undefined;
            let containerSrc: string | undefined;

            if (taskEntry.attribution && taskEntry.attribution.length > 0) {
              const attr = taskEntry.attribution[0];
              containerType = (attr.containerType as ContainerType) || 'window';
              containerId = attr.containerId || undefined;
              containerName = attr.containerName || undefined;
              containerSrc = attr.containerSrc || undefined;
            }

            store.entries.push({
              duration: entry.duration,
              startTime: entry.startTime,
              containerType,
              containerId,
              containerName,
              containerSrc,
            });
          }
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Task Observer not supported (Firefox, Safari)
      // Silently ignore - feature will report null metrics
    }
  };
};

/**
 * Injects the long task observer script into the page.
 * Must be called before page navigation for best results.
 */
export const injectLongTaskObserver = async (page: Page): Promise<void> => {
  await page.addInitScript(createLongTaskSetupScript());
  logger.debug('Long task observer injected');
};

/**
 * Captures long task metrics from the page.
 * Returns full attribution data for each task for debugging.
 */
export const captureLongTasks = async (page: Page): Promise<LongTaskMetrics | null> => {
  return page.evaluate((): LongTaskMetrics | null => {
    const STORE_KEY = '__LONG_TASKS__';
    const THRESHOLD = 50;

    type ContainerType = 'window' | 'iframe' | 'embed' | 'object';

    interface StoredEntry {
      duration: number;
      startTime: number;
      containerType: ContainerType;
      containerId?: string;
      containerName?: string;
      containerSrc?: string;
    }

    type WindowWithStore = Window & {
      [STORE_KEY]?: {
        entries: StoredEntry[];
        initialized: boolean;
      };
    };

    const store = (window as WindowWithStore)[STORE_KEY];

    if (!store?.initialized) {
      return null;
    }

    // Calculate TBT: sum of (duration - 50ms) for all long tasks
    let tbt = 0;
    let maxDuration = 0;

    for (const entry of store.entries) {
      const blockingTime = entry.duration - THRESHOLD;
      if (blockingTime > 0) {
        tbt += blockingTime;
      }
      if (entry.duration > maxDuration) {
        maxDuration = entry.duration;
      }
    }

    return {
      tbt,
      maxDuration,
      count: store.entries.length,
      entries: store.entries,
    };
  });
};

/**
 * Resets long task metrics for multi-iteration support.
 */
export const resetLongTasks = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const store = window.__LONG_TASKS__;
    if (store) {
      store.entries = [];
    }
  });
  logger.debug('Long task metrics reset');
};

/**
 * Checks if long task tracking is initialized.
 */
export const isLongTasksInitialized = async (page: Page): Promise<boolean> => {
  return page.evaluate((): boolean => {
    const store = window.__LONG_TASKS__;
    return store?.initialized === true;
  });
};

/**
 * Type guard to check if long task metrics have any data.
 */
export const hasLongTaskData = (metrics: LongTaskMetrics | null): metrics is LongTaskMetrics => {
  return metrics !== null;
};
```

### 3. Config Integration

#### 3.1 Update `src/playwright/types.ts`

Add to `TestConfig`:

```typescript
export interface TestConfig {
  // ... existing fields ...
  thresholds: {
    base: {
      profiler: {
        /* ... */
      };
      fps?: FPSThresholds;
      memory?: { heapGrowth?: number };
      webVitals?: WebVitalsThresholds;
      lighthouse?: LighthouseThresholds;
      longTasks?: LongTaskThresholds; // NEW
    };
    ci?: {
      // Same structure as base
      longTasks?: LongTaskThresholds; // NEW
    };
  };
  buffers?: {
    // ... existing fields ...
    longTasks?: Partial<LongTaskBufferConfig>; // NEW
  };
}
```

#### 3.2 Update `src/playwright/config/performanceConfig.ts`

```typescript
export const PERFORMANCE_CONFIG = {
  // ... existing config ...
  longTasks: {
    threshold: 50, // ms - long task definition
  },
  buffers: {
    // ... existing buffers ...
    longTasks: {
      tbt: 20, // 20% buffer
      maxDuration: 20, // 20% buffer
      maxCount: 20, // 20% buffer
    },
  },
};
```

#### 3.3 Update `src/playwright/config/configResolver.ts`

```typescript
/**
 * Check if long task thresholds are configured
 */
const hasLongTaskThresholds = (config: TestConfig): boolean => {
  const base = config.thresholds.base.longTasks;
  const ci = config.thresholds.ci?.longTasks;
  return !!(
    base?.tbt ||
    base?.maxDuration ||
    base?.maxCount ||
    ci?.tbt ||
    ci?.maxDuration ||
    ci?.maxCount
  );
};

/**
 * Resolves trackLongTasks setting from config.
 * Auto-enables when longTasks thresholds are configured.
 */
export const resolveTrackLongTasks = (config: TestConfig): boolean => {
  return hasLongTaskThresholds(config);
};

/**
 * Resolves long task thresholds with CI overrides.
 * 0 means no validation for that metric.
 */
export const resolveLongTaskThresholds = (
  config: TestConfig,
  isCI: boolean,
): ResolvedLongTaskThresholds => {
  const base = config.thresholds.base.longTasks ?? {};
  const ci = config.thresholds.ci?.longTasks ?? {};
  const merged = isCI ? { ...base, ...ci } : base;

  return {
    tbt: merged.tbt ?? 0,
    maxDuration: merged.maxDuration ?? 0,
    maxCount: merged.maxCount ?? 0,
  };
};

/**
 * Resolves long task buffer configuration.
 */
export const resolveLongTaskBuffers = (config: TestConfig): LongTaskBufferConfig => {
  const userBuffers = config.buffers?.longTasks;
  return {
    tbt: userBuffers?.tbt ?? PERFORMANCE_CONFIG.buffers.longTasks.tbt,
    maxDuration: userBuffers?.maxDuration ?? PERFORMANCE_CONFIG.buffers.longTasks.maxDuration,
    maxCount: userBuffers?.maxCount ?? PERFORMANCE_CONFIG.buffers.longTasks.maxCount,
  };
};
```

### 4. Assertions (`src/playwright/assertions/validators.ts`)

```typescript
/**
 * Parameters for TBT threshold assertion.
 */
type TBTThresholdParams = BaseThresholdParams<Milliseconds>;

/**
 * Validates Total Blocking Time is within threshold.
 * Buffer is additive (threshold + buffer% = max allowed).
 */
export const assertTBTThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: TBTThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `TBT should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for max task duration threshold assertion.
 */
type MaxTaskDurationThresholdParams = BaseThresholdParams<Milliseconds>;

/**
 * Validates maximum single task duration is within threshold.
 */
export const assertMaxTaskDurationThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: MaxTaskDurationThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent);

  expect(
    actual,
    `Max task duration should be ≤${effective.toFixed(1)}ms ` +
      `(actual: ${actual.toFixed(2)}ms, ` +
      `threshold: ${threshold}ms + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};

/**
 * Parameters for task count threshold assertion.
 */
type TaskCountThresholdParams = BaseThresholdParams;

/**
 * Validates long task count is within threshold.
 */
export const assertTaskCountThreshold = ({
  actual,
  threshold,
  bufferPercent,
}: TaskCountThresholdParams): void => {
  const effective = calculateEffectiveThreshold(threshold, bufferPercent, true);

  expect(
    actual,
    `Long task count should be ≤${effective} ` +
      `(actual: ${actual}, ` +
      `threshold: ${threshold} + ${bufferPercent}% buffer)`,
  ).toBeLessThanOrEqual(effective);
};
```

### 5. Logging (`src/playwright/assertions/logging.ts`)

Add to the metrics table display:

```typescript
// Long Tasks metrics rows (if tracked)
if (longTaskMetrics) {
  rows.push(['Long Tasks', '', '']);
  rows.push([
    '  TBT',
    `${longTaskMetrics.tbt.toFixed(2)}ms`,
    thresholds.longTasks.tbt > 0 ? `≤${thresholds.longTasks.tbt}ms` : '-',
  ]);
  rows.push([
    '  Max Duration',
    `${longTaskMetrics.maxDuration.toFixed(2)}ms`,
    thresholds.longTasks.maxDuration > 0 ? `≤${thresholds.longTasks.maxDuration}ms` : '-',
  ]);
  rows.push([
    '  Count',
    `${longTaskMetrics.count}`,
    thresholds.longTasks.maxCount > 0 ? `≤${thresholds.longTasks.maxCount}` : '-',
  ]);
}
```

### 6. Performance Assertions (`src/playwright/assertions/performanceAssertions.ts`)

```typescript
/**
 * Runs long task threshold assertions.
 */
export const runLongTaskAssertions = (
  metrics: LongTaskMetrics | null,
  thresholds: ResolvedLongTaskThresholds,
  buffers: LongTaskBufferConfig,
): void => {
  if (!metrics) {
    logger.debug('Long task metrics not available (browser may not support)');
    return;
  }

  if (thresholds.tbt > 0) {
    assertTBTThreshold({
      actual: metrics.tbt,
      threshold: thresholds.tbt,
      bufferPercent: buffers.tbt,
    });
  }

  if (thresholds.maxDuration > 0) {
    assertMaxTaskDurationThreshold({
      actual: metrics.maxDuration,
      threshold: thresholds.maxDuration,
      bufferPercent: buffers.maxDuration,
    });
  }

  if (thresholds.maxCount > 0) {
    assertTaskCountThreshold({
      actual: metrics.count,
      threshold: thresholds.maxCount,
      bufferPercent: buffers.maxCount,
    });
  }
};
```

### 7. Test Runner Integration (`src/playwright/runner/PerformanceTestRunner.ts`)

Update the runner to:

1. Check `trackLongTasks` config flag (auto-enabled when thresholds configured)
2. Inject long task observer before navigation (in setup phase)
3. Capture long task metrics after test (in cleanup phase)
4. Run long task assertions
5. Include metrics in report attachment

```typescript
// In setup phase, after web vitals injection
if (configuredTestInfo.trackLongTasks) {
  await injectLongTaskObserver(page);
}

// In metrics capture phase
const longTaskMetrics = configuredTestInfo.trackLongTasks ? await captureLongTasks(page) : null;

// In assertion phase
if (configuredTestInfo.trackLongTasks) {
  runLongTaskAssertions(
    longTaskMetrics,
    configuredTestInfo.thresholds.longTasks,
    configuredTestInfo.buffers.longTasks,
  );
}
```

---

## Browser Support

| Browser         | Long Task Observer | Fallback                        |
| --------------- | ------------------ | ------------------------------- |
| Chrome/Chromium | ✅ Full support    | N/A                             |
| Edge            | ✅ Full support    | N/A                             |
| Firefox         | ❌ Not supported   | Returns null metrics (graceful) |
| Safari          | ❌ Not supported   | Returns null metrics (graceful) |
| WebKit          | ❌ Not supported   | Returns null metrics (graceful) |

> **Note:** Non-Chromium browsers gracefully skip assertions when metrics are null.

---

## Example Usage

### Basic Configuration

```typescript
test.performance({
  thresholds: {
    base: {
      profiler: { '*': { duration: 500, rerenders: 20 } },
      longTasks: {
        tbt: 300, // Max 300ms Total Blocking Time
        maxDuration: 100, // No single task >100ms
        maxCount: 5, // Max 5 long tasks
      },
    },
  },
})('should have minimal blocking', async ({ page, performance }) => {
  await page.goto('/');
  await performance.init();
  // ... interactions
});
```

### CI-Specific Thresholds

```typescript
test.performance({
  thresholds: {
    base: {
      profiler: { '*': { duration: 500, rerenders: 20 } },
      longTasks: {
        tbt: 200,
        maxDuration: 80,
      },
    },
    ci: {
      longTasks: {
        tbt: 400, // More lenient in CI due to slower machines
      },
    },
  },
});
```

### With Custom Buffers

```typescript
test.performance({
  thresholds: {
    base: {
      profiler: { '*': { duration: 500, rerenders: 20 } },
      longTasks: { tbt: 300 },
    },
  },
  buffers: {
    longTasks: {
      tbt: 25, // 25% buffer instead of default 20%
    },
  },
});
```

---

## Files to Create/Modify

### New Files

| File                                                       | Purpose               |
| ---------------------------------------------------------- | --------------------- |
| `src/playwright/longTasks/types.ts`                        | Type definitions      |
| `src/playwright/longTasks/longTaskTracking.ts`             | Browser-side tracking |
| `src/playwright/longTasks/index.ts`                        | Module exports        |
| `tests/unit/playwright/longTasks/longTaskTracking.test.ts` | Unit tests            |
| `tests/integration/e2e-long-tasks.spec.ts`                 | E2E tests             |

### Files to Modify

| File                                                 | Changes                                   |
| ---------------------------------------------------- | ----------------------------------------- |
| `src/playwright/types.ts`                            | Add LongTaskThresholds to TestConfig      |
| `src/playwright/config/performanceConfig.ts`         | Add default long task config              |
| `src/playwright/config/configResolver.ts`            | Add long task resolution functions        |
| `src/playwright/assertions/validators.ts`            | Add TBT, maxDuration, maxCount validators |
| `src/playwright/assertions/logging.ts`               | Add long task metrics display             |
| `src/playwright/assertions/performanceAssertions.ts` | Add runLongTaskAssertions                 |
| `src/playwright/runner/PerformanceTestRunner.ts`     | Integrate long task tracking              |
| `src/playwright/index.ts`                            | Export long task module                   |

### Documentation to Update

| File                                    | Changes                                        |
| --------------------------------------- | ---------------------------------------------- |
| `site/pages/docs/guides/thresholds.mdx` | Add Long Tasks section                         |
| `site/pages/docs/api/configuration.mdx` | Add LongTaskThreshold interface                |
| `docs/FUTURE_IMPROVEMENTS.md`           | Mark Long Task Detection as implemented        |
| `CLAUDE.md`                             | Add Long Tasks to threshold configuration docs |

---

## Test Scenarios

### Unit Tests

1. **Type tests**: Verify type definitions compile correctly
2. **Tracking initialization**: Verify store is created correctly
3. **TBT calculation**: Verify blocking time is calculated as (duration - 50ms)
4. **Metrics capture**: Verify all metrics are captured correctly
5. **Reset functionality**: Verify reset clears entries but keeps initialized
6. **Config resolution**: Verify threshold merging with CI overrides
7. **Buffer application**: Verify buffers are applied correctly
8. **Assertions**: Verify each assertion validator works correctly

### Integration Tests

1. **Long task detection**: Create synthetic long task and verify capture
2. **Threshold passing**: Verify test passes when under thresholds
3. **Threshold failing**: Verify test fails when over thresholds
4. **Non-Chromium graceful skip**: Verify null metrics don't cause failures
5. **Multi-iteration**: Verify reset works between iterations

### Test App Scenario

Add a `long-tasks` scenario to the test app:

```tsx
// test-app/src/scenarios/LongTasksScenario.tsx
export const LongTasksScenario = () => {
  const handleClick = () => {
    // Simulate long task
    const start = Date.now();
    while (Date.now() - start < 100) {
      // Blocking operation
    }
  };

  return (
    <div>
      <h1>Long Tasks Test</h1>
      <button id="trigger-long-task" onClick={handleClick}>
        Trigger Long Task
      </button>
    </div>
  );
};
```

---

## Implementation Order

1. **Phase 1: Types & Tracking** (Low risk)
   - Create types file
   - Implement browser-side tracking
   - Add unit tests for tracking

2. **Phase 2: Config Integration** (Medium risk)
   - Update TestConfig types
   - Add config resolution functions
   - Add default buffer config
   - Update ConfiguredTestInfo

3. **Phase 3: Assertions** (Low risk)
   - Add validator functions
   - Add assertion runner
   - Add logging output
   - Add unit tests for assertions

4. **Phase 4: Runner Integration** (Medium risk)
   - Integrate with PerformanceTestRunner
   - Add to metrics attachment
   - Handle graceful degradation

5. **Phase 5: Testing** (Low risk)
   - Add test app scenario
   - Add E2E tests
   - Verify all browsers

6. **Phase 6: Documentation** (Low risk)
   - Update threshold docs
   - Update configuration docs
   - Add examples

---

## Relationship to TBT (Total Blocking Time)

TBT is a key Lighthouse metric that correlates strongly with INP. Our implementation:

- **Matches Lighthouse definition**: Sum of (duration - 50ms) for all tasks >50ms
- **Provides test-time measurement**: Unlike Lighthouse which runs post-facto
- **Enables regression testing**: Set TBT budgets and catch regressions
- **Complements INP**: INP measures actual user interaction delay; TBT measures blocking potential

---

## Debugging Details

When long tasks are detected, the following information is captured and available for debugging:

### Per-Task Entry Data

| Field           | Description                                | Use Case                          |
| --------------- | ------------------------------------------ | --------------------------------- |
| `duration`      | Task duration in milliseconds              | Identify the longest tasks        |
| `startTime`     | When task started (relative to navigation) | Correlate with other events       |
| `containerType` | "window", "iframe", "embed", "object"      | Identify if task is from iframe   |
| `containerSrc`  | URL of iframe/embed (if applicable)        | Identify 3rd-party iframe sources |

### Enhanced Console Output

When thresholds are exceeded, display individual task details:

```
Long Tasks (5 detected, TBT: 320ms)
┌─────────────┬────────────┬────────────────────────────────────────┐
│ Start Time  │ Duration   │ Container                              │
├─────────────┼────────────┼────────────────────────────────────────┤
│ 1234ms      │ 120ms      │ window                                 │
│ 2456ms      │ 85ms       │ window                                 │
│ 3789ms      │ 65ms       │ iframe: https://ads.example.com/sdk.js │
│ 4012ms      │ 95ms       │ window                                 │
│ 5234ms      │ 55ms       │ window                                 │
└─────────────┴────────────┴────────────────────────────────────────┘
```

### JSON Attachment

Full task entries are included in the JSON metrics attachment for post-analysis:

```json
{
  "longTasks": {
    "tbt": 320,
    "maxDuration": 120,
    "count": 5,
    "entries": [
      { "startTime": 1234, "duration": 120, "containerType": "window" },
      { "startTime": 2456, "duration": 85, "containerType": "window" },
      {
        "startTime": 3789,
        "duration": 65,
        "containerType": "iframe",
        "containerSrc": "https://ads.example.com/sdk.js"
      }
    ]
  }
}
```

---

## Features Considered but Not Included

### Task Whitelisting/Filtering ❌

**Why not included:**

The Long Task API's attribution is limited to **container information only** (which iframe/window the task ran in). It does **not** provide:

- Script name or URL that caused the task
- Function name or stack trace
- Task category (script vs layout vs style)

This means you cannot reliably filter by "ignore tasks from library X" because the API doesn't expose that information. The `containerSrc` only helps for iframe-based tasks.

**Recommended alternative:** Use generous `maxCount` thresholds and investigate individual tasks via the debugging output.

### Per-Task Thresholds ❌

**Why not included:**

Tasks have no meaningful identity in the Long Task API:

- `name` is always `"unknown"` or `"self"` (the spec reserves future names like "script", "layout")
- No script/function attribution is available
- Each task is anonymous

This means you cannot say "script A can take 100ms but script B only 50ms" because you can't identify scripts.

**What you can do instead:**

- `tbt`: Total blocking time budget (aggregate limit)
- `maxDuration`: No single task can exceed this (applies to ALL tasks equally)
- `maxCount`: Maximum number of long tasks allowed

These aggregate thresholds are the appropriate abstraction given the API's limitations.

### Script-Level Attribution ❌

**Why not included:**

The Long Task API spec explicitly does **not** include script-level attribution for security/privacy reasons. Getting script-level details would require:

- Chrome DevTools Protocol tracing (Chromium-only)
- Significant additional complexity
- Cross-origin security concerns

**For deep script analysis:** Use the existing `exportTrace: true` option to generate a Chrome DevTools trace, then analyze in Chrome's Performance panel.

---

## Updated LongTaskEntry Type

Based on the debugging requirements, the entry type includes all available attribution:

```typescript
/**
 * Individual long task entry with full attribution data.
 */
export interface LongTaskEntry {
  /** Task duration in milliseconds */
  duration: Milliseconds;
  /** Start time relative to navigation start */
  startTime: Milliseconds;
  /** Container type: "window", "iframe", "embed", "object" */
  containerType: 'window' | 'iframe' | 'embed' | 'object';
  /** Container element ID (if available) */
  containerId?: string;
  /** Container element name (if available) */
  containerName?: string;
  /** Container src URL (for iframes/embeds) */
  containerSrc?: string;
}
```

---

## Success Criteria

- [ ] Long tasks >50ms are detected via PerformanceObserver
- [ ] TBT is calculated correctly as sum of blocking portions
- [ ] Max duration and count are tracked
- [ ] Full attribution data captured (containerType, containerSrc, etc.)
- [ ] Detailed task list shown in console output for debugging
- [ ] Full entries included in JSON attachment
- [ ] Thresholds auto-enable tracking when configured
- [ ] CI overrides work correctly
- [ ] Buffers are applied correctly
- [ ] Non-Chromium browsers gracefully skip
- [ ] Multi-iteration tests work with proper reset
- [ ] Documentation is complete with examples
- [ ] All unit and E2E tests pass
