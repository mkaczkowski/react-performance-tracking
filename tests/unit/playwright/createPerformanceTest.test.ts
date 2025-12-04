import type { TestType } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import { PERFORMANCE_CONFIG } from '@lib/playwright/config/performanceConfig';
import { createPerformanceTest } from '@lib/playwright/createPerformanceTest';
import type { BasePerformanceFixtures } from '@lib/playwright/types';

// Mock the test type - returns a mock that satisfies TestType interface for testing
type TestFnType = (...args: unknown[]) => unknown;

const createMockBaseTest = () => {
  const testFn = vi.fn((title: string, fn: TestFnType) => {
    // Return a mock test result
    return { title, fn };
  });

  const extend = vi.fn(() => {
    const extendedTest = vi.fn((title: string, fn: TestFnType) => {
      return { title, fn };
    });
    (extendedTest as unknown as { extend: typeof extend }).extend = extend;
    return extendedTest;
  });

  (testFn as unknown as { extend: typeof extend }).extend = extend;

  // Cast to TestType for use with createPerformanceTest
  return testFn as unknown as TestType<BasePerformanceFixtures, object>;
};

describe('createPerformanceTest', () => {
  it('should return an extended test with performance method', () => {
    const baseTest = createMockBaseTest();
    const perfTest = createPerformanceTest(baseTest);

    expect(perfTest).toBeDefined();
    expect(typeof perfTest.performance).toBe('function');
  });

  it('should extend base test with performance fixture', () => {
    const baseTest = createMockBaseTest();
    createPerformanceTest(baseTest);

    expect(baseTest.extend).toHaveBeenCalled();
  });

  describe('performance method', () => {
    it('should return a function that creates tests', () => {
      const baseTest = createMockBaseTest();
      const perfTest = createPerformanceTest(baseTest);

      const testCreator = perfTest.performance({
        throttleRate: 4,
        thresholds: {
          base: {
            profiler: { '*': { duration: { avg: 500 }, rerenders: 20 } },
          },
        },
      });

      expect(typeof testCreator).toBe('function');
    });

    it('should create test with title', () => {
      const baseTest = createMockBaseTest();
      const perfTest = createPerformanceTest(baseTest);

      const testCreator = perfTest.performance({
        throttleRate: 4,
        thresholds: {
          base: {
            profiler: { '*': { duration: { avg: 500 }, rerenders: 20 } },
          },
        },
      });

      const testFn = vi.fn();
      testCreator('My test', testFn);

      // The extended test should have been called
      expect(baseTest.extend).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use default buffers from PERFORMANCE_CONFIG', () => {
      expect(PERFORMANCE_CONFIG.buffers.duration).toBe(20);
      expect(PERFORMANCE_CONFIG.buffers.rerenders).toBe(20);
    });

    it('should use default throttling rate from PERFORMANCE_CONFIG', () => {
      expect(PERFORMANCE_CONFIG.throttling.defaultRate).toBe(1);
    });

    it('should use profiler config defaults', () => {
      expect(PERFORMANCE_CONFIG.profiler.stabilityPeriodMs).toBe(1000);
      expect(PERFORMANCE_CONFIG.profiler.checkIntervalMs).toBe(100);
      expect(PERFORMANCE_CONFIG.profiler.maxWaitMs).toBe(5000);
      expect(PERFORMANCE_CONFIG.profiler.initializationTimeoutMs).toBe(10000);
    });
  });
});
