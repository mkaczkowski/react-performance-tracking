# Future Improvements Analysis

This document outlines potential improvements and new features for the react-performance-tracking library, organized by priority and complexity.

---

## 1. Extended Web Vitals Tracking

**Current state:** The library tracks LCP, INP, and CLS via PerformanceObserver.

### Proposed Additions

#### 1.1 Time to First Byte (TTFB)
- Measure server response time using `performance.getEntriesByType('navigation')`
- Critical for identifying server-side bottlenecks
- Works across all browsers

```typescript
// Proposed threshold config extension
webVitals: {
  lcp: 2500,
  inp: 200,
  cls: 0.1,
  ttfb: 800,    // New: Time to First Byte (ms)
  fcp: 1800,    // New: First Contentful Paint (ms)
}
```

#### 1.2 First Contentful Paint (FCP)
- Captures when first content is rendered
- Complements LCP for full loading timeline
- Uses `paint` entry type from PerformanceObserver

#### 1.3 Total Blocking Time (TBT)
- Sum of blocking portions of long tasks (>50ms)
- Correlates with INP for responsiveness
- Requires Long Task Observer integration

**Implementation complexity:** Low-Medium
**Value:** High - provides complete Core Web Vitals coverage

---

## 2. Enhanced Memory Profiling

**Current state:** Tracks heap size snapshots and growth percentage.

### Proposed Additions

#### 2.1 Heap Snapshot Intervals
- Capture heap snapshots at configurable intervals during test
- Visualize memory growth over time
- Detect memory leak patterns

```typescript
memory: {
  heapGrowth: 10_000_000,
  snapshotInterval: 1000,        // New: ms between snapshots
  maxSnapshots: 10,               // New: limit snapshot count
  trackAllocationSites: true,     // New: track where allocations occur
}
```

#### 2.2 Object Allocation Tracking
- Use `Memory.getAllocationProfile` CDP method
- Identify which components allocate most memory
- Correlate with React component renders

#### 2.3 Garbage Collection Metrics
- Track GC frequency and duration
- Identify GC pressure from excessive allocations
- Alert on long GC pauses affecting FPS

**Implementation complexity:** Medium
**Value:** High - memory leaks are common React performance issues

---

## 3. Advanced FPS & Rendering Metrics

**Current state:** Tracks average FPS via CDP Tracing.

### Proposed Additions

#### 3.1 Frame Drop Detection
- Count frames exceeding target duration (16.67ms for 60fps)
- Configure acceptable drop percentage
- Distinguish between minor and major drops

```typescript
fps: {
  avg: 55,
  p95: 50,
  maxDroppedFrames: 5,           // New: max consecutive dropped frames
  dropThreshold: 0.05,           // New: 5% of frames can be dropped
  jankThreshold: 100,            // New: frames >100ms flagged as jank
}
```

#### 3.2 Long Task Detection
- Track tasks blocking main thread >50ms
- Correlate with specific React renders
- Provide attribution to component hierarchy

#### 3.3 Animation Smoothness Score
- Calculate smoothness percentage (frames on time / total frames)
- Industry-standard metric for animation quality
- Easier to understand than raw FPS

**Implementation complexity:** Medium
**Value:** High - animation performance is user-visible

---

## 4. Reporting & Visualization

**Current state:** Console table output and JSON test attachments.

### Proposed Additions

#### 4.1 HTML Report Generation
- Generate visual HTML reports after test runs
- Charts for multi-iteration data
- Component breakdown visualizations
- Export as standalone or CI-integrated

```typescript
test.performance({
  reporting: {
    format: ['html', 'json'],    // New: multiple output formats
    outputDir: './reports',
    includeTraceViewer: true,    // New: embed trace in HTML
  }
})
```

#### 4.2 Historical Trend Analysis
- Store results in local database (SQLite)
- Compare current run with historical baselines
- Detect performance regressions over time

```typescript
baseline: {
  enabled: true,
  source: './performance-baseline.json',
  updateOnPass: false,           // Auto-update baseline when tests pass
  regressionThreshold: 10,       // % worse than baseline = failure
}
```

#### 4.3 Dashboard Integration
- REST API endpoint for metrics ingestion
- Grafana/DataDog/Sentry integration plugins
- Real-time monitoring for continuous testing

**Implementation complexity:** Medium-High
**Value:** Very High - visibility drives performance culture

---

## 5. CI/CD Integration Enhancements

**Current state:** CI detection via `process.env.CI` with threshold overrides.

### Proposed Additions

#### 5.1 GitHub Actions Integration
- Automatic PR comments with performance summary
- Comparison with base branch
- Performance status checks

```typescript
ci: {
  github: {
    enabled: true,
    commentOnPR: true,
    failOnRegression: true,
    compareWithBase: 'main',
  }
}
```

#### 5.2 Performance Budgets in CI
- Define budgets per route/component
- Block merges if budgets exceeded
- Gradual budget tightening over time

#### 5.3 Flakiness Detection
- Track variance across runs
- Flag tests with high standard deviation
- Auto-increase iterations for flaky tests

**Implementation complexity:** Medium
**Value:** Very High - prevents regressions from shipping

---

## 6. Network Simulation Enhancements

**Current state:** 5 presets (slow-3g, fast-3g, slow-4g, fast-4g, offline) + custom config.

### Proposed Additions

#### 6.1 Device Profiles
- Pre-configured profiles matching real devices
- iPhone on cellular, Android mid-range, desktop WiFi
- Realistic bandwidth + latency combinations

```typescript
networkThrottling: 'iphone-lte' | 'android-3g' | 'desktop-cable' | ...
// or
networkThrottling: {
  device: 'Moto G Power',        // New: device preset
  connectionType: 'lte',
}
```

#### 6.2 Latency Jitter Simulation
- Add random variance to latency (more realistic)
- Configure jitter percentage
- Test resilience to unstable connections

#### 6.3 Packet Loss Simulation
- Simulate dropped packets for stress testing
- Configure loss percentage
- Test retry logic and error handling

**Implementation complexity:** Low
**Value:** Medium - more realistic network testing

---

## 7. React-Specific Enhancements

**Current state:** React Profiler integration with mount/update/nested-update phases.

### Proposed Additions

#### 7.1 Suspense Boundary Tracking
- Track Suspense fallback display duration
- Measure time from suspend to resolve
- Identify slow async boundaries

```typescript
react: {
  trackSuspense: true,           // New: track Suspense boundaries
  suspenseThreshold: 500,        // New: max acceptable suspend time
}
```

#### 7.2 Hydration Timing
- Measure SSR hydration duration
- Compare server vs client render times
- Detect hydration mismatches

#### 7.3 Server Component Detection
- Distinguish client/server component renders
- Track RSC streaming timing
- Measure client component hydration within RSC

#### 7.4 Concurrent Rendering Metrics
- Track concurrent feature usage (useTransition, useDeferredValue)
- Measure deferred update delays
- Identify blocking vs non-blocking updates

**Implementation complexity:** Medium-High
**Value:** High - deep React 18/19 insights

---

## 8. Custom CDP Feature Plugin API

**Current state:** Internal registry with 4 built-in features.

### Proposed Public API

#### 8.1 User-Extensible Features
Allow users to create custom CDP-based metrics:

```typescript
import { defineCDPFeature, featureRegistry } from 'react-performance-tracking/playwright';

const batteryFeature = defineCDPFeature({
  name: 'battery-status',
  chromiumOnly: true,

  async start(page, config) {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setBatteryStatus', {
      charging: config.charging,
      level: config.level,
    });

    return {
      stop: async () => ({ configured: true }),
      isActive: () => true,
    };
  },
});

featureRegistry.register(batteryFeature);
```

#### 8.2 Metric Collector Plugins
- Define custom metrics from page context
- Aggregate across iterations
- Include in reports and assertions

```typescript
const customMetric = defineMetricCollector({
  name: 'api-calls',

  inject: () => {
    window.__API_CALLS__ = [];
    // Intercept fetch...
  },

  collect: (page) => page.evaluate(() => window.__API_CALLS__.length),

  assert: (value, threshold) => value <= threshold,
});
```

**Implementation complexity:** Medium
**Value:** High - extensibility for specialized use cases

---

## 9. Developer Experience Improvements

### 9.1 Watch Mode for Development
- Run performance tests on file changes
- Quick feedback loop during optimization
- Compare before/after in real-time

```bash
npm run test:e2e -- --watch --compare-last
```

### 9.2 Interactive Debugging
- Pause test at performance checkpoints
- Inspect React component tree state
- Step through iterations manually

### 9.3 VSCode Extension
- Inline threshold indicators
- Run tests from editor
- Performance lens on components

### 9.4 CLI Tool
- Quick performance checks without full test setup
- Benchmark specific pages
- Generate configuration from analysis

```bash
npx react-perf-check https://myapp.com/dashboard --throttle=slow-3g
```

**Implementation complexity:** Medium-High
**Value:** High - improves adoption and daily usage

---

## 10. Advanced Assertions

### 10.1 Statistical Significance Testing
- Ensure measured differences are statistically significant
- Reduce false positives from variance
- Require minimum sample size for percentile claims

```typescript
assertions: {
  minIterations: 5,              // New: minimum for percentile assertions
  confidenceLevel: 0.95,         // New: statistical confidence required
  ignoreOutliers: true,          // New: remove statistical outliers
}
```

### 10.2 Regression Detection with Baselines
- Compare against stored baseline metrics
- Configurable regression percentage
- Auto-update baselines on approval

### 10.3 Component-Relative Assertions
- Assert component B renders faster than component A
- Useful for A/B testing implementations
- Comparative rather than absolute thresholds

```typescript
thresholds: {
  comparisons: [
    { slower: 'NewImplementation', fasterThan: 'OldImplementation', by: 10 }
  ]
}
```

**Implementation complexity:** Medium
**Value:** High - more meaningful assertions

---

## Priority Matrix

| Feature | Complexity | Value | Priority |
|---------|-----------|-------|----------|
| Extended Web Vitals (TTFB, FCP) | Low | High | **P0** |
| HTML Report Generation | Medium | Very High | **P0** |
| GitHub Actions Integration | Medium | Very High | **P0** |
| Frame Drop Detection | Medium | High | **P1** |
| Baseline Comparison | Medium | High | **P1** |
| Heap Snapshot Intervals | Medium | High | **P1** |
| Device Network Profiles | Low | Medium | **P2** |
| Suspense Boundary Tracking | Medium | High | **P2** |
| Custom CDP Feature API | Medium | High | **P2** |
| Watch Mode | Medium | High | **P2** |
| Statistical Assertions | Medium | High | **P3** |
| VSCode Extension | High | Medium | **P3** |
| Dashboard Integration | High | High | **P3** |

---

## Implementation Roadmap

### Phase 1: Core Metrics Expansion
1. Add TTFB and FCP to Web Vitals tracking
2. Implement frame drop detection for FPS
3. Add heap snapshot intervals for memory

### Phase 2: Reporting & CI
1. Build HTML report generator
2. Create GitHub Actions integration
3. Implement baseline comparison system

### Phase 3: React Deep Integration
1. Add Suspense boundary tracking
2. Implement hydration timing
3. Track concurrent rendering metrics

### Phase 4: Extensibility
1. Public CDP feature plugin API
2. Custom metric collectors
3. Third-party integrations

### Phase 5: Developer Experience
1. Watch mode implementation
2. CLI tool for quick checks
3. VSCode extension (stretch goal)

---

## Backward Compatibility

All proposed changes should maintain backward compatibility:
- New threshold options are optional with sensible defaults
- New features are opt-in via configuration
- Existing test configurations continue working unchanged
- Major version bump only if breaking changes unavoidable

---

## Contributing

When implementing these improvements:
1. Follow patterns in existing codebase (see `docs/CODING_STANDARDS.md`)
2. Add unit and integration tests (see `docs/TESTING_GUIDELINES.md`)
3. Update user documentation in `site/pages/docs/`
4. Consider Chromium-only graceful degradation for CDP features
