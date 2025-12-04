# react-performance-tracking

[![npm version](https://img.shields.io/npm/v/react-performance-tracking.svg)](https://www.npmjs.com/package/react-performance-tracking)
[![CI](https://github.com/mkaczkowski/react-performance-tracking/actions/workflows/ci.yml/badge.svg)](https://github.com/mkaczkowski/react-performance-tracking/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/mkaczkowski/react-performance-tracking/branch/main/graph/badge.svg)](https://codecov.io/gh/mkaczkowski/react-performance-tracking)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Automate React render performance checks in Playwright. Capture React Profiler metrics, apply CPU throttling, run warmups, enforce budgets (duration + rerenders, optional FPS), and ship JSON artifacts for debugging.

## Why Use This?

- **Catch performance regressions early** – Detect slow renders before they reach production
- **Real-world conditions** – Test with CPU throttling, network throttling, and device simulation
- **CI/CD integration** – Fail builds automatically when performance budgets are exceeded
- **Comprehensive metrics** – Track React renders, FPS, memory usage, and Core Web Vitals
- **Zero boilerplate** – Drop-in Playwright integration with minimal configuration

## Quick Links

- 📦 [Installation](#installation)
- 🚀 [Quick Start](#quick-start)
- 📖 [Documentation](site/pages/docs)
- 🐛 [Troubleshooting](#troubleshooting)
- 🤝 [Contributing](CONTRIBUTING.md)

## Features

- 📊 **React Profiler wiring** – Collect real render metrics via React's Profiler API
- 🎭 **Playwright integration** – `test.performance()` helper and `performance` fixture
- 🧩 **Component-level profiling** – Track per-component metrics with multiple profilers
- 🎞️ **FPS tracking (Chromium/CDP)** – Measure avg FPS via tracing; asserts and logs when enabled
- 🧠 **Memory tracking (Chromium/CDP)** – Track heap growth to detect memory leaks
- 📈 **Web Vitals tracking** – Capture LCP, INP, CLS via PerformanceObserver (all browsers)
- 🐢 **CPU throttling (Chromium/CDP)** – Simulate slower devices when supported
- 🌐 **Network throttling (Chromium/CDP)** – Simulate slow networks (3G/4G presets or custom)
- ⏱️ **Custom metrics** – Track custom performance marks and measures for fine-grained timing
- 🔥 **Warmup runs** – Default on CI to reduce cold-start noise
- 🔄 **Multiple iterations** – Run tests multiple times and aggregate results for statistical reliability
- 📊 **Percentile metrics** – P50/P95/P99 thresholds for tests with multiple iterations
- 🔥 **Trace export (Chromium/CDP)** – Export Chrome DevTools traces for flamegraph visualization
- ⚙️ **Configurable thresholds** – Separate local/CI budgets with optional buffers
- 📝 **Detailed logging** – Clear console output with thresholds, FPS, memory, component breakdown, and phase breakdown
- 📎 **Artifacts** – Attach performance JSON (metrics + config) to test reports

## Installation

```bash
npm install react-performance-tracking
```

### Peer Dependencies (optional)

```json
{
  "react": "^18.0.0 || ^19.0.0",
  "@playwright/test": "^1.40.0"
}
```

Install only what you use:

- `react` for the provider/hooks
- `@playwright/test` for the Playwright integration

## Quick Start

### 1) Wrap your app

```tsx
import { Profiler } from 'react';
import { PerformanceProvider, useProfilerRequired } from 'react-performance-tracking/react';

function App() {
  return (
    <PerformanceProvider>
      <Header />
      <MainContent />
    </PerformanceProvider>
  );
}

// Each component wrapped with Profiler gets its own metrics
function Header() {
  const { onProfilerRender } = usePerformanceRequired();
  return (
    <Profiler id="header" onRender={onProfilerRender}>
      <header>Navigation here</header>
    </Profiler>
  );
}

function MainContent() {
  const { onProfilerRender } = usePerformanceRequired();
  return (
    <Profiler id="main-content" onRender={onProfilerRender}>
      <main>Your component content</main>
    </Profiler>
  );
}

// Test output shows per-component tables when multiple components are profiled
```

### 2) Extend Playwright

```ts
// test/performance.setup.ts
import { test as base } from '@playwright/test';
import { createPerformanceTest } from 'react-performance-tracking/playwright';

export const test = createPerformanceTest(base);
export { expect } from '@playwright/test';
```

### 3) Write a performance test

```ts
// test/my-page.perf.spec.ts
import { test } from './performance.setup';

test.describe('My Page Performance', () => {
  // Simple test with basic thresholds
  test.performance({
    thresholds: {
      base: {
        profiler: {
          '*': { duration: 500, rerenders: 20 },
        },
      },
    },
  })('page load performance', async ({ page, performance }) => {
    await page.goto('/my-page');
    await performance.init();
    // Assertions run automatically
  });

  // Test user interactions
  test.performance({
    thresholds: { base: { profiler: { '*': { duration: 100, rerenders: 5 } } } },
  })('button click interaction', async ({ page, performance }) => {
    await page.goto('/my-page');
    await performance.init();

    await performance.reset(); // Isolate the interaction
    await page.click('button[data-testid="submit"]');
    await performance.waitUntilStable();
  });
});
```

<details>
<summary><strong>Advanced: Full configuration example</strong></summary>

```ts
test.performance({
  warmup: true, // Run warmup iteration (default: true on CI)
  throttleRate: 4, // Simulate 4x slower CPU
  iterations: 3, // Run 3 times for statistical reliability
  networkThrottling: 'fast-3g', // Simulate 3G network
  thresholds: {
    base: {
      profiler: {
        '*': { duration: 500, rerenders: 20 },
      },
      fps: 55, // Min 55 FPS (auto-enables FPS tracking)
      memory: { heapGrowth: 10 * 1024 * 1024 }, // Max 10MB heap growth (auto-enables memory tracking)
      webVitals: { lcp: 2500, inp: 200, cls: 0.1 }, // Auto-enables Web Vitals tracking
    },
    ci: {
      profiler: { '*': { duration: 600 } }, // More lenient in CI
    },
  },
})('comprehensive performance test', async ({ page, performance }) => {
  await page.goto('/my-page');
  await performance.init();
});
```

</details>

### More Examples

```ts
test.describe('Advanced Usage', () => {
  // Track custom timing metrics
  test.performance({
    thresholds: { base: { profiler: { '*': { duration: 500, rerenders: 20 } } } },
  })('data loading with custom metrics', async ({ page, performance }) => {
    await page.goto('/my-page');
    await performance.init();

    performance.mark('fetch-start');
    await page.click('button[data-testid="load-data"]');
    await page.waitForSelector('.data-loaded');
    performance.mark('fetch-end');

    performance.mark('render-start');
    await performance.waitUntilStable();
    performance.mark('render-end');

    // Create measures for each operation
    const fetchTime = performance.measure('data-fetch', 'fetch-start', 'fetch-end');
    const renderTime = performance.measure('data-render', 'render-start', 'render-end');

    console.log(`Fetch: ${fetchTime}ms, Render: ${renderTime}ms`);
    // Custom metrics are automatically included in test output and artifacts
  });
});
```

## Advanced Usage: Custom Fixtures

When using `createPerformanceTest()`, only `page` and `performance` fixtures are passed to your test function. If you need custom fixtures (like page objects, mocks, etc.), see the [Custom Fixtures Guide](site/pages/docs/advanced/custom-fixtures.mdx).

## API Overview

You can import from the root (`react-performance-tracking`) or subpaths (`/react`, `/playwright`).

### React Exports

```ts
import {
  PerformanceProvider,
  useProfiler,
  useProfilerRequired,
  usePerformanceStore,
} from 'react-performance-tracking/react';
```

### Playwright Exports

**Essential** - what most users need:

```ts
import {
  createPerformanceTest,
  PERFORMANCE_CONFIG,
  NETWORK_PRESETS,
  setLogLevel,
} from 'react-performance-tracking/playwright';
```

<details>
<summary><strong>Advanced exports</strong> - for custom wrappers and low-level control</summary>

```ts
import {
  // Building blocks for custom wrappers
  createPerformanceInstance,
  createConfiguredTestInfo,
  addConfigurationAnnotation,
  PerformanceTestRunner,

  // Assertions
  assertPerformanceThresholds,
  assertDurationThreshold,
  assertSampleCountThreshold,
  assertFPSThreshold,
  assertHeapGrowthThreshold,

  // CDP Feature system
  featureRegistry,
  cpuThrottlingFeature,
  networkThrottlingFeature,
  fpsTrackingFeature,
  memoryTrackingFeature,
  createFeatureCoordination,

  // Feature utilities
  createCDPSession,
  createFeatureHandle,
  createResettableFeatureHandle,

  // Network utilities
  resolveNetworkConditions,
  formatNetworkConditions,
  isNetworkPreset,

  // Profiler utilities
  captureProfilerState,
  logger,
} from 'react-performance-tracking/playwright';
```

</details>

## Configuration Options

### `test.performance()` config

```ts
test.performance({
  warmup?: boolean;        // default: true on CI, false locally
  throttleRate?: number;   // default: 1 (no throttling)
  iterations?: number;     // default: 1 (single run)
  networkThrottling?: NetworkThrottlingConfig; // preset or custom (Chromium only)
  exportTrace?: boolean | string; // export trace for flamegraph (Chromium only)
  thresholds: {
    base: {
      profiler: {
        '*': {           // Default for all components
          duration: number | { avg?: number; p50?: number; p95?: number; p99?: number };
          rerenders: number;
        };
        // Additional component IDs can be specified
        // 'header'?: { duration: 100, rerenders: 5 };
      };
      fps?: number | { avg?: number; p50?: number; p95?: number; p99?: number }; // Min FPS (auto-enables FPS tracking, Chromium only)
      memory?: {
        heapGrowth?: number; // max heap growth in bytes (auto-enables memory tracking, Chromium only)
      };
      webVitals?: {        // Web Vitals thresholds (auto-enables tracking, all browsers)
        lcp?: number;      // max LCP in ms (Google recommends ≤2500)
        inp?: number;      // max INP in ms (Google recommends ≤200)
        cls?: number;      // max CLS score (Google recommends ≤0.1)
      };
    };
    ci?: {               // Overrides for CI environment
      profiler?: {
        [componentId: string]: Partial<ComponentThresholds>;
      };
      fps?: number | { avg?: number; p50?: number; p95?: number; p99?: number };
      memory?: { heapGrowth?: number };
      webVitals?: { lcp?: number; inp?: number; cls?: number };
    };
  };
  buffers?: {
    duration?: number;     // % buffer (default: 20) - also used for duration percentiles (p50, p95, p99)
    rerenders?: number;    // % buffer (default: 20)
    fps?: number;          // % buffer (default: 20) - also used for fps percentiles (p50, p95, p99)
    heapGrowth?: number;   // % buffer (default: 20)
    webVitals?: { lcp?: number; inp?: number; cls?: number }; // % buffers (default: 20 each)
  };
  name?: string;           // artifact name
})('test title', async ({ page, performance }) => { ... });

// NetworkThrottlingConfig can be:
// - Preset: 'slow-3g' | 'fast-3g' | 'slow-4g' | 'fast-4g' | 'offline'
// - Custom: { latency: number, downloadThroughput: number, uploadThroughput: number, offline?: boolean }
```

### Performance fixture methods

- `init()` – Wait for profiler initialization and stability
- `reset()` – Clear collected samples and custom metrics (isolate measurements)
- `waitForInitialization(timeout?)` – Wait for profiler to be ready
- `waitUntilStable(options?)` – Wait for React to settle
- `mark(name)` – Record a custom performance mark (timestamp)
- `measure(name, startMark, endMark)` – Create a measure between two marks (returns duration in ms)
- `getCustomMetrics()` – Get all recorded marks and measures

### Default Configuration

```ts
const PERFORMANCE_CONFIG = {
  profiler: {
    stabilityPeriodMs: 1000,
    checkIntervalMs: 100,
    maxWaitMs: 5000,
    initializationTimeoutMs: 10000,
  },
  buffers: {
    duration: 20,
    rerenders: 20,
    avg: 20,
    heapGrowth: 20,
    webVitals: { lcp: 20, inp: 20, cls: 20 },
  },
  throttling: {
    defaultRate: 1,
  },
  fps: {
    defaultThreshold: 60,
  },
  memory: {
    defaultThreshold: 0, // 0 = no threshold, just track
  },
  webVitals: {
    enabled: false, // off by default to avoid overhead
  },
  iterations: {
    defaultCount: 1,
  },
  get isCI() {
    return Boolean(process.env.CI);
  },
};
```

### Controlling Log Output

```ts
import { setLogLevel } from 'react-performance-tracking/playwright';

// Available levels: 'silent' | 'error' | 'warn' | 'info' | 'debug'
setLogLevel('silent'); // Disable all console output
setLogLevel('error'); // Only show errors
setLogLevel('info'); // Default - show info, warnings, errors
```

### Environment Behavior

| Environment | Thresholds Used         | Warmup Default |
| ----------- | ----------------------- | -------------- |
| CI          | `base` merged with `ci` | `true`         |
| Local       | `base` only             | `false`        |

## Console Output

```
════════════════════════════════════════════════════════════════════════════════
 [Performance] PERFORMANCE TEST: page-load-performance
════════════════════════════════════════════════════════════════════════════════
 Environment: local | CPU: 4x | Iterations: 3
────────────────────────────────────────────────────────────────────────────────

 ITERATIONS
┌─────┬─────────────┬─────────┬───────┐
│ #   │ Duration    │ Renders │ FPS   │
├─────┼─────────────┼─────────┼───────┤
│ 1 ○ │     35.20ms │      26 │  29.6 │
│ 2   │     22.50ms │      26 │  47.4 │
│ 3   │     21.60ms │      26 │  50.5 │
├─────┼─────────────┼─────────┼───────┤
│ AVG │ 22.05ms ±0.5│  26 ±0.0│  49.0 │
└─────┴─────────────┴─────────┴───────┘
 ○ = warmup (excluded from average)

 RESULTS
┌──────────┬──────────┬───────────┬────────┐
│ Metric   │ Actual   │ Threshold │ Status │
├──────────┼──────────┼───────────┼────────┤
│ Duration │ 22.05ms  │  < 600ms  │ ✓ PASS │
│ Renders  │       26 │      ≤ 24 │ ✓ PASS │
│ FPS      │     49.0 │    ≥ 44.0 │ ✓ PASS │
│ LCP      │  1523ms  │  ≤ 3000ms │ ✓ PASS │
│ INP      │    85ms  │   ≤ 240ms │ ✓ PASS │
│ CLS      │    0.050 │    ≤ 0.12 │ ✓ PASS │
└──────────┴──────────┴───────────┴────────┘

════════════════════════════════════════════════════════════════════════════════
 ✓ ALL CHECKS PASSED
════════════════════════════════════════════════════════════════════════════════
```

## Troubleshooting

### Tests timing out?

- **Increase initialization timeout**: Adjust `initializationTimeoutMs` in your config
- **Check PerformanceProvider**: Ensure it wraps your app root component
- **Verify profiler IDs**: Make sure `<Profiler id="...">` IDs match your test expectations

```ts
// Extend timeout if needed
await performance.waitForInitialization(15000); // 15 seconds instead of default 10s
```

### FPS tracking not working?

- **Browser requirement**: FPS tracking requires Chromium (Chrome/Edge)
- **Enable in config**: Add `fps` thresholds to automatically enable FPS tracking
- **Check CDP availability**: Non-Chromium browsers will silently skip FPS tracking

### Thresholds failing unexpectedly?

- **Environment differences**: Check if you're running in CI vs local (different thresholds apply)
- **Review buffers**: Default buffer is 20% - adjust in config if needed
- **Component-specific thresholds**: Use per-component thresholds for fine-grained control

```ts
thresholds: {
  base: {
    profiler: {
      '*': { duration: 500, rerenders: 20 },
    },
  },
  ci: {
    profiler: {
      '*': { duration: 600 }, // More lenient in CI
    },
  },
},
buffers: {
  duration: 10, // Reduce buffer to 10%
},
```

### Memory or network throttling not applying?

- **Chromium only**: These features require Chromium browser
- **Check config**: Verify `memory.heapGrowth` threshold or `networkThrottling` config is set
- **Session conflicts**: Ensure no other tools are using CDP on the same page

### Need more help?

- 📖 Read the [Documentation](site/pages/docs)
- 💬 Open a [GitHub Discussion](https://github.com/mkaczkowski/react-performance-tracking/discussions)
- 🐛 Report a bug via [GitHub Issues](https://github.com/mkaczkowski/react-performance-tracking/issues)

## Limitations

- CPU throttling, FPS tracking, memory tracking, and network throttling require Chromium/CDP; other browsers skip them quietly.
- React Profiler must be enabled in production builds if you test prod bundles.
- When using `createPerformanceTest()`, only `page` and `performance` fixtures are exposed. Use the building blocks directly if you need custom fixtures (see Advanced Usage above).

## Requirements

- React 18+ or 19+
- Playwright 1.40+
- Node.js 18+

## License

MIT
