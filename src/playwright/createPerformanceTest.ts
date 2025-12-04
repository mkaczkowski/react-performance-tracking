import type { PlaywrightTestArgs, TestType } from '@playwright/test';

import { addConfigurationAnnotation, createConfiguredTestInfo } from './config/configResolver';
import { createPerformanceInstance } from './fixtures/performanceFixture';
import { PerformanceTestRunner } from './runner/PerformanceTestRunner';
import type {
  BasePerformanceFixtures,
  PerformanceFixture,
  PerformanceInstance,
  PerformanceTestFixtures,
  PerformanceTestFunction,
  TestConfig,
} from './types';

/**
 * Type for the extended test with performance method
 */
export type PerformanceTest<
  T extends BasePerformanceFixtures = BasePerformanceFixtures,
  W extends object = object,
> = TestType<PerformanceTestFixtures<T>, W> & {
  performance: (
    testConfig: TestConfig,
  ) => (
    title: string,
    testFn: PerformanceTestFunction<T>,
  ) => ReturnType<TestType<PerformanceTestFixtures<T>, W>>;
};

/**
 * Type for the performance fixture definition that satisfies Playwright's extend() method.
 * This type is necessary because Playwright's Fixtures type is very strict
 * and doesn't easily accommodate fixtures that depend on base fixtures (like 'page').
 */
type PerformanceFixtureDefinition = {
  performance: (
    context: Pick<PlaywrightTestArgs, 'page'>,
    use: (performance: PerformanceInstance) => Promise<void>,
  ) => Promise<void>;
};

/**
 * Extends a Playwright test with the performance fixture and a `performance` helper
 * that applies throttling, warmup, metrics collection, and assertions.
 * Only core fixtures (`page`, `performance`) are passed to performance tests.
 */
export function createPerformanceTest<T extends BasePerformanceFixtures, W extends object = object>(
  baseTest: TestType<T, W>,
): PerformanceTest<T, W> {
  // Define the performance fixture following Playwright's pattern
  const performanceFixtureDefinition: PerformanceFixtureDefinition = {
    performance: async ({ page }, use) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- 'use' is Playwright's fixture function, not a React hook
      await use(createPerformanceInstance(page));
    },
  };

  // Extend the base test with performance fixture
  // Type assertion needed due to Playwright's strict Fixtures type that doesn't
  // easily express fixtures depending on other fixtures from the base test
  const extendedTest = baseTest.extend<PerformanceFixture>(
    performanceFixtureDefinition as unknown as Parameters<
      typeof baseTest.extend<PerformanceFixture>
    >[0],
  );

  /**
   * Creates configured test with CPU throttling, warmup runs, and performance measurement
   */
  const performance = (testConfig: TestConfig) => {
    return (title: string, testFn: PerformanceTestFunction<T>) => {
      // Use the extended test which has the performance fixture
      // Playwright requires object destructuring pattern for fixtures (no rest properties allowed)
      // Only page and performance fixtures are available in performance tests
      return extendedTest(title, async ({ page, performance }, testInfo) => {
        // Create configured test info without mutating the original
        const configuredTestInfo = createConfiguredTestInfo(testInfo, testConfig, title);

        // Add configuration annotation for test reports
        addConfigurationAnnotation(testInfo, configuredTestInfo);

        // Create fixtures object with page and performance
        const fixtures = { page, performance } as unknown as PerformanceTestFixtures<T>;

        // Execute test with runner
        const runner = new PerformanceTestRunner<T>(page, fixtures, configuredTestInfo);
        await runner.execute(testFn);
      });
    };
  };

  // Return the extended test with the performance method attached
  return Object.assign(extendedTest, { performance }) as PerformanceTest<T, W>;
}
