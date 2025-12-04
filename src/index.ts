/**
 * React Performance Tracking
 *
 * A library for React performance profiling with Playwright test integration.
 *
 * @example
 * ```tsx
 * // React side - wrap your app with PerformanceProvider
 * import { PerformanceProvider } from 'react-performance-tracking/react';
 *
 * function App() {
 *   return (
 *     <PerformanceProvider>
 *       <YourApp />
 *     </PerformanceProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Playwright side - create performance-enabled tests
 * import { test as base } from '@playwright/test';
 * import { createPerformanceTest } from 'react-performance-tracking/playwright';
 *
 * export const test = createPerformanceTest(base);
 *
 * test.performance({
 *   warmup: true,
 *   throttleRate: 4,
 *   thresholds: {
 *     base: { duration: 500, rerenders: 20 },
 *   },
 * })('My performance test', async ({ page, performance }) => {
 *   await page.goto('/');
 *   await performance.init();
 * });
 * ```
 *
 * @packageDocumentation
 */

export type { PerformanceSample, PerformanceStore } from './react/PerformanceProvider.types';

export type {
  CapturedProfilerState,
  ConfiguredTestInfo,
  PerformanceTestFixtures,
  PerformanceFixture,
  TestConfig,
  ThresholdConfig,
  ThresholdValues,
} from './playwright';

export {
  assertPerformanceThresholds,
  captureProfilerState,
  cpuThrottlingFeature,
  createPerformanceTest,
  featureRegistry,
  PERFORMANCE_CONFIG,
  performanceFixture,
  PerformanceTestRunner,
} from './playwright';

export { createLogger, getLogLevel, logger, LOG_PREFIX, setLogLevel } from './utils';
export type { Logger, LogLevel } from './utils';

export {
  PerformanceProvider,
  PerformanceContext,
  usePerformance,
  usePerformanceRequired,
  usePerformanceStore,
  createPerformanceStore,
  updatePerformanceStore,
} from './react';
