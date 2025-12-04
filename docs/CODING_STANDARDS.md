# React Performance Tracking - Coding Standards

This document establishes coding standards and best practices for the react-performance-tracking library.

## Table of Contents

- [Naming Conventions](#naming-conventions)
- [Code Organization](#code-organization)
- [Code Style](#code-style)
- [Best Practices](#best-practices)
- [Documentation Requirements](#documentation-requirements)
- [Code Review Checklist](#code-review-checklist)

**Related:** See [TESTING_GUIDELINES.md](./TESTING_GUIDELINES.md) for comprehensive unit testing patterns and templates.

## Naming Conventions

| Element            | Convention                 | Example                              |
| ------------------ | -------------------------- | ------------------------------------ |
| Files (general)    | camelCase                  | `performanceFixture.ts`              |
| Files (features)   | camelCase                  | `cpuThrottling.ts`, `fpsTracking.ts` |
| Type files         | `*.types.ts` or `types.ts` | `PerformanceProvider.types.ts`       |
| Helper files       | `*.helpers.ts`             | `PerformanceProvider.helpers.ts`     |
| Test files         | `*.test.ts` / `*.test.tsx` | `performanceAssertions.test.ts`      |
| Interfaces         | PascalCase                 | `CDPFeature`, `PerformanceStore`     |
| Type aliases       | PascalCase                 | `Percentage`, `Milliseconds`         |
| Factory functions  | `create*`                  | `createPerformanceTest()`            |
| Resolver functions | `resolve*`                 | `resolveThrottleRate()`              |
| Feature instances  | camelCase + `Feature`      | `cpuThrottlingFeature`               |
| Hooks              | `use*`                     | `useProfiler`, `useProfilerRequired` |
| Constants          | SCREAMING_SNAKE_CASE       | `NETWORK_PRESETS`, `LOG_PREFIX`      |
| Private methods    | No underscore prefix       | Use TypeScript `private`             |

## Code Organization

### Directory Structure

```
src/
├── index.ts              # Main entry (re-exports from react + playwright)
├── react/                # React layer
│   ├── index.ts         # React exports
│   ├── [Component].tsx
│   ├── [Component].types.ts
│   ├── [Component].helpers.ts
│   ├── hooks/
│   │   ├── use[Name].tsx
│   │   └── use[Name].ts
│   └── types/
│       └── globals.ts   # Window augmentation
├── playwright/           # Playwright layer
│   ├── index.ts         # All Playwright exports
│   ├── types.ts         # Core types
│   ├── config/          # Configuration management
│   ├── features/        # CDP feature implementations
│   ├── fixtures/        # Test fixtures
│   ├── runner/          # Test orchestration
│   ├── assertions/      # Validation and logging
│   └── [subsystem]/     # Other modules (webVitals, iterations, etc.)
└── utils/               # Shared utilities
    ├── logger.ts
    ├── formatters.ts
    └── index.ts
```

### Test Directory Structure

```
tests/
├── unit/
│   ├── react/
│   │   ├── PerformanceProvider.test.tsx
│   │   └── hooks/
│   ├── playwright/
│   │   ├── features/
│   │   ├── assertions/
│   │   └── config/
│   └── utils/
├── integration/
│   └── e2e-*.spec.ts
├── fixtures/
│   └── test-app/
└── mocks/
    └── playwrightMocks.ts
```

## Code Style

### Formatting

- Use Prettier for automatic formatting
- Line length: 100 characters max
- Indent: 2 spaces
- Semicolons: Required
- Quotes: Single quotes for code, double for JSX attributes

### Import Organization

```typescript
// 1. External dependencies
import { expect } from '@playwright/test';
import { useCallback } from 'react';

// 2. Internal absolute imports
import { logger } from '../../utils';
import type { ConfiguredTestInfo } from '../types';

// 3. Relative imports
import { createFeatureHandle } from './utils';
```

### Type Declarations

- Prefer `type` over `interface` for object shapes
- Use `interface` only for extendable contracts (like `CDPFeature`)
- Export types separately from implementations
- Use branded types for domain values

```typescript
// Branded types for domain values
type Milliseconds = number;
type Percentage = number;
type Bytes = number;
type FPS = number;

// Interface for extendable contracts
interface CDPFeature<TConfig = void, TMetrics = void> {
  readonly name: string;
  start(page: Page, config: TConfig): Promise<CDPFeatureHandle<TMetrics> | null>;
}
```

## Best Practices

### Error Handling

```typescript
// Cleanup operations - silent failure
await safeCDPSend(session, 'Method', params);

// Feature initialization - log and return null
if (isCdpUnsupportedError(error)) {
  logger.warn('Feature not supported');
  return null;
}

// Unexpected errors - log and throw
logger.error('Unexpected error:', error);
throw error;
```

### Type Safety

```typescript
// Use branded types
type Milliseconds = number;
type Percentage = number;

// Use type guards for conditional types
if (hasAvgFps(metrics)) {
  console.log(metrics.fps.avg); // Type-safe access
}

// Use discriminated unions
type Result = { success: true; data: Data } | { success: false; error: Error };
```

### Testing

> For comprehensive testing patterns, templates, and mock factories, see [TESTING_GUIDELINES.md](./TESTING_GUIDELINES.md).

```typescript
// Use vi.hoisted() for mocks needed before vi.mock()
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock('./module', () => ({ fn: mockFn }));

// Clear mocks in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
});

// Factory functions for test data
const createMockMetrics = (overrides = {}) => ({
  sampleCount: 10,
  totalActualDuration: 100,
  ...overrides,
});
```

### Configuration

```typescript
// Use Object.freeze for immutable config
export const CONFIG = Object.freeze({
  nested: Object.freeze({
    value: 100,
  }),
});

// Provide resolver functions
export const resolveValue = (userConfig?: Partial<Config>): ResolvedConfig => ({
  ...DEFAULTS,
  ...userConfig,
});
```

### CDP Features

All CDP features should follow the unified plugin pattern:

```typescript
class MyFeature implements CDPFeature<MyConfig, MyMetrics> {
  readonly name = 'my-feature' as const;
  readonly requiresChromium = true as const;

  async start(page: Page, config: MyConfig): Promise<MyHandle | null> {
    try {
      const cdpSession = await page.context().newCDPSession(page);
      // ... feature setup
      return this.createHandle(state);
    } catch (error) {
      if (isCdpUnsupportedError(error)) {
        logger.warn('Feature not supported');
        return null;
      }
      throw error;
    }
  }

  private createHandle(state: MyState): MyHandle {
    return createFeatureHandle(state, {
      onStop: async (s) => {
        // ... cleanup
        return metrics;
      },
    });
  }
}

// Self-register with registry
featureRegistry.register(myFeature);
```

## Documentation Requirements

### When to Add JSDoc

- Public API exports
- Complex utility functions
- Non-obvious behavior
- Factory functions

### JSDoc Format

```typescript
/**
 * Creates a performance test runner.
 *
 * @param page - Playwright page instance
 * @param config - Test configuration
 * @returns Configured test runner
 *
 * @example
 * const runner = createRunner(page, { throttleRate: 4 });
 */
export function createRunner(page: Page, config: RunnerConfig): Runner {
  // ...
}
```

### When to Skip JSDoc

- Self-explanatory function names
- Internal/private functions
- Type aliases with obvious meaning
- Simple getters/setters

## Code Review Checklist

Before submitting a PR, verify:

- [ ] New exports added to appropriate index file
- [ ] Public types have JSDoc documentation
- [ ] Error paths have test coverage
- [ ] No direct `console.log` usage (use logger)
- [ ] Factory functions follow `create*` naming
- [ ] Type guards created for discriminated unions
- [ ] Configuration changes use resolver pattern
- [ ] CDP features follow unified handle pattern
- [ ] Tests use mock factory functions
- [ ] No `any` types without explanation comment
- [ ] Branded types used for domain values
- [ ] Imports organized correctly (external, internal, relative)
