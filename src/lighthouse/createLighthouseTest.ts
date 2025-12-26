import type { TestType } from '@playwright/test';

import { createConfiguredTestInfo } from './lighthouseConfig';
import { LighthouseTestRunner } from './LighthouseTestRunner';
import type { LighthouseTestConfig, LighthouseTestFixtures, LighthouseTestFunction } from './types';

/**
 * Type for the extended test with lighthouse method
 */
export type LighthouseTest<T extends LighthouseTestFixtures, W extends object = object> = TestType<
  T,
  W
> & {
  lighthouse: (
    config: LighthouseTestConfig,
  ) => (title: string, testFn: LighthouseTestFunction) => ReturnType<TestType<T, W>>;
};

/**
 * Extends a Playwright test with the `lighthouse` method.
 * Unlike performance tests, lighthouse tests don't need custom fixtures.
 */
export function createLighthouseTest<T extends LighthouseTestFixtures, W extends object = object>(
  baseTest: TestType<T, W>,
): LighthouseTest<T, W> {
  const lighthouse = (config: LighthouseTestConfig) => {
    return (title: string, testFn: LighthouseTestFunction) => {
      return baseTest(title, async ({ page }, testInfo) => {
        const configured = createConfiguredTestInfo(testInfo, config, title);
        const fixtures: LighthouseTestFixtures = { page };
        const runner = new LighthouseTestRunner(page, fixtures, configured);
        await runner.execute(testFn);
      });
    };
  };

  return Object.assign(baseTest, { lighthouse }) as LighthouseTest<T, W>;
}
