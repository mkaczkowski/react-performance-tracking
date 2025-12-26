React performance profiling library with Playwright integration for automated performance testing. Captures React Profiler metrics, applies CPU/network throttling, tracks FPS/memory/Web Vitals, and enforces performance budgets.

## Commands

```bash
# Development
npm run build              # Build library (ESM + CJS + types)
npm run dev                # Build in watch mode
npm run typecheck          # TypeScript type checking

# Testing
npm test                   # Unit tests (Vitest)
npm test -- path/to/test   # Run specific test file
npm run test:e2e           # E2E tests (auto-starts test app on :3000)
npm run test:coverage      # Coverage report (80% minimum)

# Linting
npm run lint:fix           # Fix linting issues
npm run format             # Format with Prettier
```

## Architecture

### Two-Layer Design

**React Layer** (`src/react/`): Browser-side profiling

- `PerformanceProvider` exposes `window.__REACT_PERFORMANCE__` store
- `usePerformance()` returns `onProfilerRender` callback for `<Profiler>` components
- Store aggregates metrics globally + per-component

**Playwright Layer** (`src/playwright/`): Node.js test orchestration

- `createPerformanceTest()` extends Playwright with `test.performance()` method
- `PerformanceTestRunner` orchestrates: setup → warmup (CI default) → test → assertions → cleanup
- Cross-boundary communication via `page.evaluate(() => window.__REACT_PERFORMANCE__)`

**Lighthouse Layer** (`src/lighthouse/`): Page-level audits

- `createLighthouseTest()` extends Playwright with `test.lighthouse()` method
- `LighthouseTestRunner` runs Lighthouse audits via CDP and enforces score thresholds
- Separate from performance tests - use for page-level audits, not React-specific profiling

### CDP Feature Plugin System

All Chrome DevTools Protocol features (CPU/network throttling, FPS, memory, trace export) use a unified plugin architecture with registry-based lifecycle management:

```typescript
// Features self-register and return handles for cleanup
const handle = await featureRegistry.startFeature('cpu-throttling', page, { rate: 4 });
await handle?.stop(); // Returns metrics and cleans up CDP session
```

**Key pattern:** Features are Chromium-only; non-Chromium browsers return `null` handle (graceful degradation)

### Key Concepts

**Threshold Configuration:**

- Per-component thresholds with `"*"` as default fallback
- Values can be simple (`duration: 500`) or detailed (`duration: { avg: 500, p50: 100, p95: 200 }`)
- CI environment: merges `thresholds.base` + `thresholds.ci` (detected via `process.env.CI`)
- Buffers provide tolerance: duration/rerenders/heapGrowth are additive (+20%), FPS is subtractive (-20%)
- Percentiles inherit parent buffer (duration percentiles use `duration` buffer, FPS percentiles use `avg` buffer)

**Package Exports:**

- `react-performance-tracking` - Main entry (re-exports both layers)
- `react-performance-tracking/react` - React provider/hooks only
- `react-performance-tracking/playwright` - Playwright test utilities only
- `react-performance-tracking/lighthouse` - Lighthouse audit utilities (requires `lighthouse` peer dep)

**Store Structure:**

```typescript
window.__REACT_PERFORMANCE__ = {
  samples: PerformanceSample[],           // All profiler commits
  components: { [id: string]: {...} },    // Per-component aggregation
  reset: () => void,
}
```

**Testing:**

- Unit: Vitest + jsdom (`tests/unit/`)
- E2E: Playwright + test app (`tests/integration/`)
- Mocks: `tests/mocks/playwrightMocks.ts`

## Important Details

### Critical Gotchas

**Profiler Initialization:**

- `profiler.init()` = `waitForInitialization()` + `waitUntilStable()`
- Stability: 1000ms with no new samples (uses temporary `__REACT_PERFORMANCE_STABILITY_TRACKER__`)

**CDP Features (Chromium-only):**

- CPU/network throttling, FPS, memory tracking, trace export require Chromium
- Non-Chromium browsers gracefully skip (return `null` handle, no errors)
- CDP sessions must be cleaned up in `finally` blocks to avoid test interference
- Use `safeCDPSend()` for non-critical cleanup (silent on failure)

**Custom Fixtures Limitation:**

- `test.performance()` only passes `page` and `performance` fixtures
- For custom fixtures, use standalone `performanceFixture` (see [Custom Fixtures Guide](site/pages/docs/advanced/custom-fixtures.mdx))

**Threshold Validation:**

- Throws if threshold is negative or buffer is outside 0-100%
- Component lookup: explicit ID → `"*"` default → error with helpful message

**Automatic Feature Enablement:**

- FPS tracking: Auto-enabled when `fps` thresholds configured (Chromium only)
- Memory tracking: Auto-enabled when `memory.heapGrowth` threshold configured (Chromium only)
- Web Vitals tracking: Auto-enabled when `webVitals` thresholds configured (all browsers)
- No explicit `trackFps`, `trackMemory`, or `trackWebVitals` flags needed - pure config-based enablement

## Code Style

**Comments:**

- Explain "why" not "what" - reasoning, constraints, edge cases
- JSDoc for shared utilities only (brief, skip obvious params)
- ESLint disables need reason: `// eslint-disable-next-line rule -- reason`
- Avoid inline TODOs; create GitHub issues instead

## References

**Contributor documentation** (`docs/`):

- [CODING_STANDARDS.md](docs/CODING_STANDARDS.md) - Naming conventions, code organization
- [TESTING_GUIDELINES.md](docs/TESTING_GUIDELINES.md) - Unit test patterns, mock factories

**User documentation** (`site/pages/docs/`):

```
site/pages/docs/
├── index.mdx              # Introduction
├── installation.mdx       # Setup guide
├── quick-start.mdx        # Getting started
├── guides/
│   ├── react-setup.mdx    # React provider setup
│   ├── playwright-setup.mdx # Playwright integration
│   ├── thresholds.mdx     # Performance budgets
│   ├── throttling.mdx     # CPU/network throttling
│   ├── custom-metrics.mdx # Custom marks/measures
│   ├── config-builder.mdx # Interactive config tool
│   └── lighthouse.mdx     # Lighthouse audits
├── api/
│   ├── react.mdx          # React hooks & provider
│   ├── playwright.mdx     # Playwright test API
│   └── configuration.mdx  # Full config reference
├── examples/
│   ├── basic.mdx          # Simple test patterns
│   ├── dashboard.mdx      # Data-heavy dashboards
│   ├── e-commerce.mdx     # Product pages & checkout
│   └── spa-navigation.mdx # Route transitions
└── advanced/
    ├── architecture.mdx   # System design & patterns
    ├── custom-fixtures.mdx # Custom test fixtures
    └── testing.mdx        # Testing guidelines
```

**Documentation maintenance:** When making changes to architecture, configuration, API, or adding new features, check if the relevant docs in `site/pages/docs/` need updating. Keep user-facing docs in sync with code changes.
