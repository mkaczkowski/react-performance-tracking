# Future Improvements Analysis

This document outlines potential improvements and new features for the react-performance-tracking library, organized by priority and complexity.

> **Review Notes:**
> - Items marked with ✅ are validated as technically feasible
> - Items marked with ⚠️ have caveats or limitations
> - Items marked with ❌ are not feasible and excluded
> - Items marked with 🔄 overlap with existing functionality

---

## 1. Extended Web Vitals Tracking ✅

**Current state:** The library tracks LCP, INP, and CLS via PerformanceObserver.

### Proposed Additions

#### 1.1 Time to First Byte (TTFB) ✅
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

#### 1.2 First Contentful Paint (FCP) ✅
- Captures when first content is rendered
- Complements LCP for full loading timeline
- Uses `paint` entry type from PerformanceObserver

#### 1.3 Total Blocking Time (TBT) ✅
- Sum of blocking portions of long tasks (>50ms)
- Correlates with INP for responsiveness
- Requires Long Task Observer integration

**Implementation complexity:** Low-Medium
**Value:** High - provides complete Core Web Vitals coverage

---

## 2. Enhanced Memory Profiling ✅

**Current state:** Tracks heap size snapshots and growth percentage.

### Proposed Additions

#### 2.1 Heap Snapshot Intervals ✅
- Capture heap snapshots at configurable intervals during test
- Visualize memory growth over time
- Detect memory leak patterns

```typescript
memory: {
  heapGrowth: 10_000_000,
  snapshotInterval: 1000,        // New: ms between snapshots
  maxSnapshots: 10,               // New: limit snapshot count
}
```

#### 2.2 Object Allocation Tracking ⚠️
- Use `Memory.getAllocationProfile` CDP method
- Identify which components allocate most memory
- **Caveat:** High performance overhead, should be opt-in for debugging only

#### 2.3 Garbage Collection Metrics ✅
- Track GC frequency and duration via CDP `HeapProfiler.collectGarbage`
- Identify GC pressure from excessive allocations
- Alert on long GC pauses affecting FPS

**Implementation complexity:** Medium
**Value:** High - memory leaks are common React performance issues

---

## 3. Advanced FPS & Rendering Metrics ✅

**Current state:** Tracks average FPS and frame count via CDP Tracing (`fpsTracking.ts`).

### Proposed Additions

#### 3.1 Frame Drop Detection ✅
- Analyze frame timestamps to detect drops (>16.67ms gaps for 60fps target)
- Current implementation has frame events but doesn't analyze inter-frame timing
- Calculate jank score (frames >50ms)

```typescript
fps: {
  avg: 55,
  p95: 50,
  maxConsecutiveDrops: 3,        // New: max consecutive dropped frames
  jankThreshold: 50,             // New: frames >50ms flagged as jank
  smoothnessScore: 0.95,         // New: % of frames on time
}
```

#### 3.2 Long Task Detection ✅
- Track tasks blocking main thread >50ms via `PerformanceObserver`
- Attribute to script URLs and function names
- Cross-browser support (not CDP-dependent)

#### 3.3 Animation Smoothness Score ✅
- Calculate: `(frames on time) / (total frames) * 100`
- More intuitive than raw FPS for non-technical stakeholders
- Align with Chrome's Frame Rendering Stats

**Implementation complexity:** Medium
**Value:** High - animation performance is user-visible

---

## 4. Reporting & Visualization ✅

**Current state:** Console table output and JSON test attachments.

### Proposed Additions

#### 4.1 HTML Report Generation ✅
- Generate visual HTML reports after test runs
- Charts for multi-iteration data (leverage existing percentile calculations)
- Component breakdown visualizations
- Can use lightweight charting (no heavy dependencies)

```typescript
test.performance({
  reporting: {
    format: ['html', 'json'],    // New: multiple output formats
    outputDir: './reports',
    includeTraceViewer: true,    // New: embed trace link in HTML
  }
})
```

#### 4.2 Baseline Comparison ✅
- Store baseline metrics in JSON file (simple, no database needed)
- Compare current run with baseline
- Configurable regression threshold

```typescript
baseline: {
  path: './performance-baseline.json',
  updateOnPass: false,           // Auto-update baseline when tests pass
  regressionThreshold: 10,       // % worse than baseline = failure
}
```

#### 4.3 Notification Webhooks ✅ (New)
- Send results to Slack/Discord/Teams on failure
- Simple webhook integration (no complex plugins)
- Include summary and link to full report

```typescript
notifications: {
  webhook: 'https://hooks.slack.com/...',
  onFailure: true,
  onRegression: true,
}
```

**Implementation complexity:** Medium
**Value:** Very High - visibility drives performance culture

---

## 5. CI/CD Integration Enhancements ✅

**Current state:** CI detection via `process.env.CI` with threshold overrides.

### Proposed Additions

#### 5.1 GitHub Actions Integration ✅
- Automatic PR comments with performance summary
- Comparison with base branch
- Uses GitHub Actions API (no external dependencies)

```typescript
ci: {
  github: {
    commentOnPR: true,
    failOnRegression: true,
    compareWithBase: 'main',
  }
}
```

#### 5.2 Performance Budgets in CI ✅
- Already partially implemented via thresholds
- Enhancement: per-route budget configuration
- Track budget changes over time

#### 5.3 Flakiness Detection 🔄
- **Note:** Standard deviation already tracked in `iterations/utils.ts`
- Enhancement: Add configurable flakiness threshold
- Auto-suggest increasing iterations when variance is high

```typescript
iterations: 5,
flakinessThreshold: 0.15,        // New: warn if stdDev/avg > 15%
```

**Implementation complexity:** Medium
**Value:** Very High - prevents regressions from shipping

---

## 6. Network Simulation Enhancements

**Current state:** 5 presets (slow-3g, fast-3g, slow-4g, fast-4g, offline) + custom config.

### Proposed Additions

#### 6.1 Device Profiles ✅
- Pre-configured profiles matching real devices
- Based on WebPageTest/Lighthouse device data
- Realistic bandwidth + latency combinations

```typescript
networkThrottling: 'moto-g4-3g' | 'iphone-12-lte' | 'desktop-cable'
```

#### 6.2 Latency Jitter Simulation ❌
- **Not feasible:** CDP `Network.emulateNetworkConditions` does not support jitter
- Would require custom proxy implementation (out of scope)

#### 6.3 Packet Loss Simulation ❌
- **Not feasible:** CDP does not support packet loss simulation
- Would require custom proxy implementation (out of scope)

**Implementation complexity:** Low (device profiles only)
**Value:** Medium - more realistic network testing

---

## 7. React-Specific Enhancements ✅

**Current state:** React Profiler integration with mount/update/nested-update phases.

### Proposed Additions

#### 7.1 Suspense Boundary Tracking ✅
- Track Suspense fallback display duration
- Use React DevTools global hook if available
- Fallback to DOM mutation observation

```typescript
react: {
  trackSuspense: true,
  suspenseThreshold: 500,        // Max acceptable suspend time (ms)
}
```

#### 7.2 Hydration Timing ✅
- Measure SSR hydration duration
- Use `performance.mark()` injected before hydrate call
- Compare with full client render baseline

#### 7.3 Server Component Detection ⚠️
- Distinguish client/server component renders
- **Caveat:** Requires React 19+ with RSC support
- Track RSC streaming timing where available

#### 7.4 Error Boundary Tracking ✅ (New)
- Track when error boundaries catch errors
- Include in test failure output
- Correlate with performance degradation

**Implementation complexity:** Medium-High
**Value:** High - deep React 18/19 insights

---

## 8. Resource Timing Tracking ✅ (New Section)

**Current state:** Not currently tracked.

### Proposed Additions

#### 8.1 Resource Loading Metrics ✅
- Track loading time for images, fonts, scripts, CSS
- Use `PerformanceObserver` for `resource` entries
- Identify slow resources affecting LCP

```typescript
resources: {
  trackImages: true,
  trackScripts: true,
  slowResourceThreshold: 500,    // Flag resources >500ms
}
```

#### 8.2 Bundle Size Tracking ✅
- Record JavaScript bundle sizes during test
- Track size changes between runs
- Alert on bundle size regressions

```typescript
bundles: {
  trackSize: true,
  maxMainBundle: 250_000,        // bytes
  regressionThreshold: 5,        // % increase = warning
}
```

**Implementation complexity:** Low
**Value:** High - bundle size directly impacts load time

---

## 9. Custom CDP Feature Plugin API ✅

**Current state:** Internal registry with 4 built-in features (`registry.ts`).

### Proposed Public API

#### 9.1 User-Extensible Features ✅
Allow users to create custom CDP-based metrics:

```typescript
import { defineCDPFeature } from 'react-performance-tracking/playwright';

const batteryFeature = defineCDPFeature({
  name: 'battery-status',
  chromiumOnly: true,

  async start(page, config) {
    const client = await page.context().newCDPSession(page);
    // ... implementation
    return {
      stop: async () => ({ level: 0.8 }),
      isActive: () => true,
    };
  },
});
```

#### 9.2 Metric Collector Plugins ✅
- Define custom metrics from page context
- Aggregate across iterations
- Include in reports and assertions

**Implementation complexity:** Medium
**Value:** High - extensibility for specialized use cases

---

## 10. Developer Experience Improvements

### 10.1 Watch Mode for Development ✅
- Run performance tests on file changes
- Quick feedback loop during optimization
- Leverage Playwright's existing watch infrastructure

```bash
npm run test:e2e -- --watch
```

### 10.2 Interactive Debugging ❌
- **Redundant:** Playwright already provides `--debug` flag and Trace Viewer
- Existing tools are comprehensive for debugging needs

### 10.3 VSCode Extension ⚠️
- Inline threshold indicators
- Run tests from editor
- **Caveat:** High effort, limited audience (only VSCode users)
- Consider: Recommend existing Playwright VSCode extension instead

### 10.4 CLI Tool ⚠️
- Quick performance checks without full test setup
- **Caveat:** Conflicts with library's Playwright-first design philosophy
- Alternative: Provide example scripts in documentation

**Implementation complexity:** Medium (watch mode) to High (VSCode extension)
**Value:** Medium - nice-to-have improvements

---

## 11. Advanced Assertions

### 11.1 Statistical Significance Testing 🔄
- **Note:** Percentile calculations (p50, p95, p99) already exist in `iterations/utils.ts`
- **Note:** Standard deviation already tracked
- Enhancement: Add confidence interval calculation
- Warn when sample size too small for reliable percentiles

```typescript
assertions: {
  minIterationsForPercentiles: 5,  // Warn if fewer iterations
  outlierRemoval: 'iqr',           // Remove outliers using IQR method
}
```

### 11.2 Component-Relative Assertions ✅
- Assert component B renders faster than component A
- Useful for A/B testing implementations
- Comparative rather than absolute thresholds

```typescript
comparisons: [
  { component: 'NewList', fasterThan: 'OldList', byPercent: 10 }
]
```

### 11.3 Trend Assertions ✅ (New)
- Assert performance hasn't degraded over N runs
- Track moving average
- Integrate with baseline comparison

**Implementation complexity:** Medium
**Value:** High - more meaningful assertions

---

## Priority Matrix (Revised)

| Feature | Complexity | Value | Priority | Notes |
|---------|-----------|-------|----------|-------|
| Extended Web Vitals (TTFB, FCP) | Low | High | **P0** | Quick win |
| Baseline Comparison | Medium | Very High | **P0** | Critical for CI |
| HTML Report Generation | Medium | Very High | **P0** | High visibility |
| Frame Drop Detection | Medium | High | **P1** | Extends existing FPS |
| Long Task Detection | Low | High | **P1** | Cross-browser |
| Resource Timing | Low | High | **P1** | New capability |
| Notification Webhooks | Low | High | **P1** | CI integration |
| GitHub Actions Integration | Medium | High | **P2** | Requires API work |
| Heap Snapshot Intervals | Medium | High | **P2** | Memory debugging |
| Device Network Profiles | Low | Medium | **P2** | Data collection |
| Suspense Boundary Tracking | Medium | High | **P2** | React-specific |
| Custom CDP Feature API | Medium | High | **P3** | Extensibility |
| Bundle Size Tracking | Low | Medium | **P3** | Simple addition |
| Watch Mode | Low | Medium | **P3** | DX improvement |
| Component-Relative Assertions | Medium | Medium | **P3** | Niche use case |
| VSCode Extension | High | Low | **P4** | High effort, limited scope |

---

## Implementation Roadmap (Revised)

### Phase 1: Core Metrics & Baselines (High Impact, Lower Effort)
1. Add TTFB and FCP to Web Vitals tracking
2. Implement baseline comparison system
3. Add Long Task detection via PerformanceObserver
4. Implement frame drop detection in existing FPS feature

### Phase 2: Reporting & CI
1. Build HTML report generator
2. Add notification webhooks (Slack/Discord)
3. Create GitHub Actions integration
4. Add resource timing tracking

### Phase 3: React Deep Integration
1. Add Suspense boundary tracking
2. Implement hydration timing
3. Add error boundary tracking
4. Track concurrent rendering metrics (React 19+)

### Phase 4: Extensibility & Polish
1. Public CDP feature plugin API
2. Device network profiles
3. Bundle size tracking
4. Enhanced statistical assertions

### Phase 5: Developer Experience (Lower Priority)
1. Watch mode implementation
2. Comprehensive documentation examples
3. Consider VSCode extension based on demand

---

## Excluded Items

The following items were considered but excluded:

| Item | Reason |
|------|--------|
| Latency Jitter Simulation | CDP doesn't support; requires external proxy |
| Packet Loss Simulation | CDP doesn't support; requires external proxy |
| Interactive Debugging | Redundant with Playwright's built-in debugging |
| SQLite Historical Storage | Overkill; JSON baseline files are simpler |
| Object Allocation Tracking | High overhead; better suited for dedicated profilers |
| Standalone CLI Tool | Conflicts with Playwright-first design |

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
5. Prefer PerformanceObserver APIs for cross-browser support where possible
