# Testing Guidelines

This document provides comprehensive guidelines for writing unit tests in this project. Following these patterns ensures consistency, maintainability, and meaningful test coverage.

## Table of Contents

- [Test Organization](#test-organization)
- [Mock Patterns](#mock-patterns)
- [Test Patterns](#test-patterns)
- [Setup & Teardown](#setup--teardown)
- [Assertion Guidelines](#assertion-guidelines)
- [Debugging Tests](#debugging-tests)
- [Coverage Requirements](#coverage-requirements)
- [Quick Reference](#quick-reference)
- [Boilerplate Templates](#boilerplate-templates)
- [Available Mock Factories](#available-mock-factories)
- [Patterns by Test Type](#patterns-by-test-type)
- [Unit vs E2E Tests](#unit-vs-e2e-tests)

---

## Test Organization

### Directory Structure

```
tests/
├── setup.ts                    # Global test setup
├── mocks/
│   └── playwrightMocks.ts     # Centralized mock factories
├── unit/                       # Mirror source structure
│   ├── utils/
│   ├── react/
│   │   └── hooks/
│   └── playwright/
│       ├── assertions/
│       ├── config/
│       ├── customMetrics/
│       ├── features/
│       ├── iterations/
│       ├── metrics/
│       ├── runner/
│       ├── trace/
│       ├── utils/
│       └── webVitals/
└── integration/                # E2E Playwright tests
```

### Naming Conventions

| Type         | Convention                                  | Example                               |
| ------------ | ------------------------------------------- | ------------------------------------- |
| Test files   | `{module}.test.ts` or `{module}.test.tsx`   | `formatters.test.ts`                  |
| Helper tests | `{module}.helpers.test.ts`                  | `PerformanceProvider.helpers.test.ts` |
| Location     | Mirror `src/` structure under `tests/unit/` | `src/utils/` → `tests/unit/utils/`    |

### Describe Block Organization

Use **nested `describe()` blocks** organized hierarchically by module → function/method:

```typescript
describe('moduleName', () => {
  describe('functionOrMethod', () => {
    it('should do X when Y', () => { ... });
    it('should handle Z edge case', () => { ... });
  });

  describe('anotherFunction', () => {
    it('should return expected result', () => { ... });
  });
});
```

---

## Mock Patterns

### Factory Functions

The project provides centralized mock factories in `tests/mocks/playwrightMocks.ts`. Always use these instead of creating inline mocks.

| Factory                     | Purpose                      | Usage                    |
| --------------------------- | ---------------------------- | ------------------------ |
| `createMockPage()`          | Mock Playwright Page         | CDP feature tests        |
| `createMockCDPSession()`    | Mock CDP with event handling | FPS, trace, memory tests |
| `createFailingCDPSession()` | Simulate CDP failures        | Error path tests         |
| `createMockTestInfo()`      | Mock test configuration      | Runner tests             |
| `createMockProfilerState()` | Mock profiler data           | Assertion tests          |
| `createMockPerformance()`   | Mock performance fixture     | Integration tests        |
| `createMockTraceEvents()`   | Generate trace event data    | FPS calculation tests    |

### Factory Pattern with Overrides

All factories support partial overrides for flexibility:

```typescript
// Use defaults
const state = createMockProfilerState();

// Override specific fields
const customState = createMockProfilerState({
  totalActualDuration: 200,
  sampleCount: 5,
});
```

### Module Mocking with `vi.hoisted()`

When mocking modules, use `vi.hoisted()` to define mocks before `vi.mock()`:

```typescript
// Define mocks first (hoisted to top)
const { mockFeatureStart, mockFeatureStop } = vi.hoisted(() => ({
  mockFeatureStart: vi.fn(),
  mockFeatureStop: vi.fn(),
}));

// Then mock the module
vi.mock('@lib/playwright/features', () => ({
  feature: {
    start: mockFeatureStart,
    stop: mockFeatureStop,
  },
}));
```

### CDP Event Handling

For testing CDP event-based features (FPS, tracing), event handling is already built into `createMockCDPSession()`. It automatically handles `Tracing.dataCollected` and `Tracing.tracingComplete` events:

```typescript
// The factory handles event simulation internally
const cdpSession = createMockCDPSession(traceEvents);
const mockPage = createMockPage(null, cdpSession);

// Events are automatically emitted when Tracing.end is called
```

For custom event scenarios, use `createMockCDPSession()` with overrides.

### Combining Factories with Local Helpers

When you need to track specific mock calls (like `newCDPSession`), use factories for complex mocks and local helpers for simple tracking:

```typescript
// Use factory for complex CDP session
let cdpSession: CDPSession;
let newCDPSessionMock: ReturnType<typeof vi.fn>;

const createTestPage = (): Page =>
  ({
    context: vi.fn().mockReturnValue({
      newCDPSession: newCDPSessionMock,
    }),
  }) as unknown as Page;

beforeEach(() => {
  // Create fresh mocks each test
  cdpSession = createMockCDPSession();
  newCDPSessionMock = vi.fn().mockResolvedValue(cdpSession);
});

// Now you can:
// - Track newCDPSession calls via newCDPSessionMock
// - Access CDP methods via cdpSession.send, cdpSession.detach
// - Use vi.mocked() for type-safe mock manipulation
```

---

## Test Patterns

### Parameterized Tests with `it.each()`

Use `it.each()` for testing multiple input/output combinations:

```typescript
it.each([
  [0, '0 B'],
  [1024, '1.00 KB'],
  [1048576, '1.00 MB'],
  [-1024, '-1.00 KB'],
])('formatBytes(%d) → %s', (input, expected) => {
  expect(formatBytes(input)).toBe(expected);
});
```

### React Hook Testing

Use `renderHook()` with a wrapper for context-dependent hooks:

```typescript
const wrapper = ({ children }: PropsWithChildren) => (
  <PerformanceProvider>{children}</PerformanceProvider>
);

const { result, unmount } = renderHook(() => usePerformance(), { wrapper });

// Access hook return value - use objectContaining for cleaner assertions
expect(result.current).toEqual(
  expect.objectContaining({ onProfilerRender: expect.any(Function) }),
);

// Test cleanup
unmount();
expect(window.__REACT_PERFORMANCE__).toBeUndefined();
```

### Dynamic Module Import

For testing module-level code with mocks, use dynamic imports with `vi.resetModules()`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockSend.mockResolvedValue(undefined);
});

const importModule = async () => import('@/playwright/features/cpuThrottling');

it('should create session with valid config', async () => {
  const { cpuThrottlingFeature } = await importModule();
  // Test with fresh module instance
});
```

### State Transition Testing

For handles and stateful objects, test state transitions explicitly:

```typescript
it('should mark handle as inactive after stop', async () => {
  const handle = await feature.start(mockPage, { rate: 4 });

  expect(handle).not.toBeNull();
  expect(handle!.isActive()).toBe(true);

  await handle!.stop();

  expect(handle!.isActive()).toBe(false);
});
```

### Error Path Testing

Always test error scenarios with specific error messages:

```typescript
it('should throw when used outside provider', () => {
  expect(() => renderHook(() => usePerformanceRequired())).toThrow(
    'useProfilerRequired must be used within a PerformanceProvider',
  );
});

it('should return false when CDP send fails', async () => {
  mockSend.mockRejectedValueOnce(new Error('CDP error'));

  const success = await handle!.reapply();

  expect(success).toBe(false);
});
```

---

## Setup & Teardown

### Global Setup (`tests/setup.ts`)

The global setup handles common cleanup for all tests:

```typescript
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  if (typeof window !== 'undefined') {
    delete (window as Window & { __REACT_PERFORMANCE__?: unknown }).__REACT_PERFORMANCE__;
    delete (window as Window & { __REACT_PROFILER_STABILITY_TRACKER__?: unknown })
      .__REACT_PROFILER_STABILITY_TRACKER__;
  }
});
```

### Test-Level Setup

Use `beforeEach` to reset mocks and set default behaviors:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue(undefined);
  mockDetach.mockResolvedValue(undefined);
});
```

### Selective Mock Clearing

Clear specific mocks between operations within a test:

```typescript
const handle = await feature.start(mockPage, { rate: 4 });
mockSend.mockClear(); // Clear call history only

await handle!.stop();
expect(mockSend).toHaveBeenCalledWith('Emulation.setCPUThrottlingRate', { rate: 1 });
```

### Type-Safe Mock Access with `vi.mocked()`

When accessing mocks from factory-created objects, use `vi.mocked()` for type safety:

```typescript
// Create CDP session from factory
const cdpSession = createMockCDPSession();

// Access mock methods with type safety
vi.mocked(cdpSession.send).mockClear();
vi.mocked(cdpSession.send).mockRejectedValueOnce(new Error('CDP error'));

// Assertions work normally
expect(cdpSession.send).toHaveBeenCalledWith('Method', { param: 1 });
```

### Vitest Configuration Reference

Key settings from `vitest.config.ts`:

```typescript
{
  environment: 'jsdom',      // For React component tests
  globals: true,             // Enable describe, it, expect globally
  clearMocks: true,          // Clear mock calls between tests
  restoreMocks: true,        // Restore spies between tests
  setupFiles: ['./tests/setup.ts'],
}
```

### Import Aliases

The project uses path aliases configured in `vitest.config.ts`:

| Alias             | Path              | Usage                    |
| ----------------- | ----------------- | ------------------------ |
| `@/`              | `src/`            | General source imports   |
| `@lib/react`      | `src/react/`      | React layer imports      |
| `@lib/playwright` | `src/playwright/` | Playwright layer imports |

```typescript
// Examples
import { formatBytes } from '@/utils/formatters';
import { useProfiler } from '@lib/react/hooks/useProfiler';
import { cpuThrottlingFeature } from '@lib/playwright/features';
```

### Async Testing Patterns

For React components with async behavior:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// Wait for element to disappear
await waitFor(() => {
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

// Wrap state updates in act()
await act(async () => {
  await userEvent.click(button);
});

// Wait with custom timeout
await waitFor(() => expect(result).toBe(expected), { timeout: 5000 });
```

---

## Assertion Guidelines

### Test Naming Convention

Use the pattern: **"should [action] when [condition]"**

```typescript
// Good
it('should return null when rate is 1', () => { ... });
it('should throw when used outside provider', () => { ... });
it('should mark handle as inactive after stop', () => { ... });

// Avoid
it('test rate 1', () => { ... });
it('works correctly', () => { ... });
```

### What to Test

Every function/feature should have tests for:

| Category     | Description                         | Example                                     |
| ------------ | ----------------------------------- | ------------------------------------------- |
| Happy path   | Success scenarios with valid input  | `expect(formatBytes(1024)).toBe('1.00 KB')` |
| Edge cases   | Boundary values, empty inputs       | `expect(formatBytes(0)).toBe('0 B')`        |
| Error paths  | Failures, exceptions, invalid input | `expect(() => fn()).toThrow('error')`       |
| Side effects | Verify what should NOT happen       | `expect(mockFn).not.toHaveBeenCalled()`     |

### Verification Patterns

```typescript
// Specific call arguments
expect(mockSend).toHaveBeenCalledWith('Method', { rate: 4 });

// Call count
expect(mockSend).toHaveBeenCalledTimes(1);

// Absence of side effects
expect(mockNewCDPSession).not.toHaveBeenCalled();

// Mathematical precision (for FPS calculations)
expect(fps).toBeCloseTo(60, -1);

// Object shape (prefer objectContaining for cleaner assertions)
expect(result.current).toEqual(expect.objectContaining({ onProfilerRender: expect.any(Function) }));

// Error messages (partial match)
expect(() => fn()).toThrow('specific message');
```

---

## Debugging Tests

### Focus on Specific Tests

```typescript
// Run only this test
it.only('focused test', () => { ... });

// Run only this describe block
describe.only('focused suite', () => { ... });

// Skip a test temporarily
it.skip('skipped test', () => { ... });

// Skip a describe block
describe.skip('skipped suite', () => { ... });
```

### Running Tests from CLI

```bash
# Run specific test file
npm test -- formatters.test.ts

# Run tests matching pattern
npm test -- --grep "should format"

# Run with verbose output
npm test -- --reporter=verbose

# Watch mode for development
npm run test:watch
```

---

## Coverage Requirements

The project enforces **80% minimum coverage** across all metrics:

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 80%       |
| Functions  | 80%       |
| Branches   | 80%       |
| Statements | 80%       |

Run coverage report: `npm run test:coverage`

### Excluding Code from Coverage

For legitimately uncoverable code (e.g., defensive checks, environment-specific code):

```typescript
/* v8 ignore next */
if (process.env.NODE_ENV === 'development') { ... }

/* v8 ignore next 3 */
if (typeof window === 'undefined') {
  return null;
}

/* v8 ignore start */
// Multiple lines to ignore
/* v8 ignore stop */
```

Use sparingly and only for code that genuinely cannot be tested in the unit test environment.

---

## Quick Reference

### Do's

- Use factory functions from `tests/mocks/playwrightMocks.ts`
- Use `vi.mocked()` for type-safe mock assertions
- Use `it.each()` for multiple similar test cases
- Test both success and error paths
- Clear mocks in `beforeEach`
- Use descriptive test names following "should X when Y" pattern
- Test state transitions explicitly
- Verify absence of side effects

### Don'ts

- Don't duplicate global cleanup in test files (it's in `setup.ts`)
- Don't skip error scenario tests
- Don't hardcode large test data inline (use factories)
- Don't test implementation details (test behavior)
- Don't use `beforeEach` + `afterEach` for the same cleanup
- Don't use `toBe()` for objects — use `toEqual()` instead
- Don't forget to `await` async assertions
- Don't nest describes more than 3 levels deep
- Don't share mutable state between tests (`let` is fine if reassigned fresh in `beforeEach`)
- Don't leave `it.only()` or `describe.only()` in committed code

### Object vs Primitive Comparison

```typescript
// Primitives - use toBe (strict equality)
expect(count).toBe(5);
expect(name).toBe('test');

// Objects/Arrays - use toEqual (deep equality)
expect(result).toEqual({ count: 5, name: 'test' });
expect(items).toEqual([1, 2, 3]);

// Partial object match - use toMatchObject
expect(result).toMatchObject({ count: 5 });
// Passes even if result has more properties

// Array contains - use toContain
expect(items).toContain(2);

// Array length
expect(items).toHaveLength(3);
```

---

## Boilerplate Templates

### Basic Unit Test

```typescript
import { describe, expect, it } from 'vitest';

import { formatBytes } from '@/utils/formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    it('should format bytes to KB', () => {
      const result = formatBytes(1024);
      expect(result).toBe('1.00 KB');
    });

    it('should handle zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should handle negative values', () => {
      expect(formatBytes(-1024)).toBe('-1.00 KB');
    });
  });
});
```

### React Hook Test

```typescript
import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { useHook } from '@lib/react/hooks/useHook';
import { Provider } from '@lib/react/Provider';

describe('useHook', () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider>{children}</Provider>
  );

  it('should return null when used outside provider', () => {
    const { result } = renderHook(() => useHook());
    expect(result.current).toBeNull();
  });

  it('should return context value inside provider', () => {
    const { result } = renderHook(() => useHook(), { wrapper });
    expect(result.current).toEqual(
      expect.objectContaining({ expectedProperty: expect.any(Function) }),
    );
  });

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() => useHook(), { wrapper });
    unmount();
    expect(window.__GLOBAL_STATE__).toBeUndefined();
  });
});
```

### CDP Feature Test

```typescript
import type { CDPSession, Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockCDPSession } from '../../../mocks/playwrightMocks';

describe('featureName', () => {
  // Shared mocks - recreated fresh in beforeEach
  let cdpSession: CDPSession;
  let newCDPSessionMock: ReturnType<typeof vi.fn>;

  const createTestPage = (): Page =>
    ({
      context: vi.fn().mockReturnValue({
        newCDPSession: newCDPSessionMock,
      }),
    }) as unknown as Page;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create fresh CDP session mock using factory
    cdpSession = createMockCDPSession();
    newCDPSessionMock = vi.fn().mockResolvedValue(cdpSession);
  });

  const importModule = async () => import('@/playwright/features/feature');

  describe('feature.start', () => {
    it('should return null when disabled', async () => {
      const { feature } = await importModule();
      const mockPage = createTestPage();
      const handle = await feature.start(mockPage, { enabled: false });

      expect(handle).toBeNull();
      expect(newCDPSessionMock).not.toHaveBeenCalled();
    });

    it('should create CDP session with valid config', async () => {
      const { feature } = await importModule();
      const mockPage = createTestPage();
      const handle = await feature.start(mockPage, { enabled: true });

      expect(handle).not.toBeNull();
      expect(newCDPSessionMock).toHaveBeenCalledWith(mockPage);
      expect(cdpSession.send).toHaveBeenCalledWith('SomeMethod', expect.any(Object));
    });
  });

  describe('handle.stop', () => {
    it('should detach session and mark inactive', async () => {
      const { feature } = await importModule();
      const mockPage = createTestPage();
      const handle = await feature.start(mockPage, { enabled: true });

      expect(handle!.isActive()).toBe(true);

      vi.mocked(cdpSession.send).mockClear();
      await handle!.stop();

      expect(handle!.isActive()).toBe(false);
      expect(cdpSession.detach).toHaveBeenCalled();
    });
  });
});
```

### Parameterized Test

```typescript
import { describe, expect, it } from 'vitest';

import { formatValue } from '@/utils/formatters';

describe('formatValue', () => {
  it.each([
    // [input, expected, description]
    [0, '0 units', 'zero'],
    [100, '100 units', 'small value'],
    [1000, '1K units', 'thousand'],
    [-50, '-50 units', 'negative'],
  ])('should format %d as "%s" (%s)', (input, expected) => {
    expect(formatValue(input)).toBe(expected);
  });
});
```

---

## Available Mock Factories

All factories are located in `tests/mocks/playwrightMocks.ts`.

| Factory                                                 | Parameters                                       | Returns                                                                                  | When to Use                                         |
| ------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `createMockPage(profilerState?, cdpSession?)`           | Optional profiler state and CDP session          | Mock `Page` (includes `evaluate`, `waitForFunction`, `goto`, `addInitScript`, `context`) | CDP feature tests, profiler tests, web vitals tests |
| `createMockCDPSession(traceEvents?, overrides?)`        | Trace events array, method overrides             | Mock `CDPSession`                                                                        | FPS, memory, trace tests                            |
| `createFailingCDPSession(failOn, error?)`               | `'start'` \| `'end'` \| `'detach'`, custom error | Failing `CDPSession`                                                                     | Error path tests                                    |
| `createMockTestInfo(overrides?)`                        | Partial config overrides                         | Mock `ConfiguredTestInfo`                                                                | Runner, assertion tests                             |
| `createMockProfilerState(overrides?)`                   | Partial state overrides                          | Mock `CapturedProfilerState`                                                             | Assertion, metrics tests                            |
| `createMockPerformance()`                               | None                                             | Mock `PerformanceInstance`                                                               | Integration tests                                   |
| `createMockTraceEvents(count, eventType?, intervalUs?)` | Count, event type, interval                      | Trace events array                                                                       | FPS calculation tests                               |

---

## Patterns by Test Type

| Test Type         | Key Patterns                              | Example File                                                     |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Utility functions | `it.each()`, simple assertions            | `tests/unit/utils/formatters.test.ts`                            |
| React hooks       | `renderHook()` + wrapper pattern          | `tests/unit/react/hooks/useProfiler.test.tsx`                    |
| React components  | `render()` + screen queries               | `tests/unit/react/PerformanceProvider.test.tsx`                  |
| CDP features      | Dynamic import, state transitions         | `tests/unit/playwright/features/cpuThrottling.test.ts`           |
| Configuration     | Immutability tests with `Object.freeze()` | `tests/unit/playwright/config/performanceConfig.test.ts`         |
| Assertions        | Mock injection, branch coverage           | `tests/unit/playwright/assertions/performanceAssertions.test.ts` |
| FPS/Memory        | Trace event parsing, math precision       | `tests/unit/playwright/features/fpsTracking.test.ts`             |

---

## Unit vs E2E Tests

### When to Write Unit Tests

| Scenario            | Example                                     |
| ------------------- | ------------------------------------------- |
| Pure functions      | `formatBytes()`, `calculatePercentile()`    |
| Isolated hooks      | `usePerformance()`, `usePerformanceStore()` |
| Utility functions   | Threshold calculators, validators           |
| Individual features | CDP feature start/stop logic                |
| Error handling      | Edge cases, invalid inputs                  |

### When to Write E2E Tests

| Scenario                  | Example                              |
| ------------------------- | ------------------------------------ |
| Full user journeys        | Complete performance test flow       |
| Browser-specific behavior | Real CDP tracing, FPS measurement    |
| Integration across layers | React profiling → Playwright capture |
| Visual/layout validation  | Component rendering in real browser  |
| Network conditions        | Actual throttling behavior           |

### Decision Guide

```
Is it a pure function with no side effects?
  → Unit test

Does it require a real browser environment?
  → E2E test

Does it test component integration?
  → E2E test (or integration test)

Is it testing business logic?
  → Unit test

Does it need real CDP/DevTools?
  → E2E test
```

E2E tests live in `tests/integration/` and use Playwright's test runner. Unit tests live in `tests/unit/` and use Vitest.
