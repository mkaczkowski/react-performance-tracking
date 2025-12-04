import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BasePerformanceFixtures, PerformanceTestFixtures } from '@lib/playwright/types';
import {
  createMockPage,
  createMockPerformance,
  createMockProfilerState,
  createMockTestInfo,
} from '../../../mocks/playwrightMocks';
import { PerformanceTestRunner } from '@lib/playwright/runner/PerformanceTestRunner';

// Use vi.hoisted to ensure mocks are available before vi.mock
const {
  mockCpuThrottlingStart,
  mockNetworkThrottlingStart,
  mockFpsTrackingStart,
  mockMemoryTrackingStart,
  mockStopAll,
  mockCaptureProfilerState,
  mockAssertPerformanceThresholds,
  mockAttachTestResults,
  mockStartTraceCapture,
  mockExportTrace,
} = vi.hoisted(() => ({
  mockCpuThrottlingStart: vi.fn(),
  mockNetworkThrottlingStart: vi.fn(),
  mockFpsTrackingStart: vi.fn(),
  mockMemoryTrackingStart: vi.fn(),
  // Mock stopAll to actually stop all handles (like the real implementation)
  mockStopAll: vi
    .fn()
    .mockImplementation(async (handles: Map<string, { stop: () => Promise<unknown> }>) => {
      const results = new Map();
      for (const [name, handle] of handles.entries()) {
        try {
          const result = await handle.stop();
          results.set(name, result);
        } catch {
          results.set(name, null);
        }
      }
      handles.clear();
      return results;
    }),
  mockCaptureProfilerState: vi.fn().mockResolvedValue({
    sampleCount: 10,
    totalActualDuration: 100,
    totalBaseDuration: 150,
    phaseBreakdown: { mount: 1, update: 9 },
  }),
  mockAssertPerformanceThresholds: vi.fn(),
  mockAttachTestResults: vi.fn().mockResolvedValue(undefined),
  mockStartTraceCapture: vi.fn().mockResolvedValue(null),
  mockExportTrace: vi.fn().mockResolvedValue(null),
}));

// Mock the features module
vi.mock('@lib/playwright/features', () => ({
  cpuThrottlingFeature: {
    name: 'cpu-throttling',
    requiresChromium: true,
    start: mockCpuThrottlingStart,
  },
  networkThrottlingFeature: {
    name: 'network-throttling',
    requiresChromium: true,
    start: mockNetworkThrottlingStart,
  },
  fpsTrackingFeature: {
    name: 'fps-tracking',
    requiresChromium: true,
    start: mockFpsTrackingStart,
  },
  memoryTrackingFeature: {
    name: 'memory-tracking',
    requiresChromium: true,
    start: mockMemoryTrackingStart,
  },
  featureRegistry: {
    stopAll: mockStopAll,
  },
  formatBytes: vi.fn((bytes: number) => `${bytes} B`),
}));

vi.mock('@lib/playwright/profiler/profilerState', () => ({
  captureProfilerState: mockCaptureProfilerState,
}));

vi.mock('@lib/playwright/assertions/performanceAssertions', () => ({
  assertPerformanceThresholds: mockAssertPerformanceThresholds,
}));

vi.mock('@lib/playwright/metrics/metricsAttachment', () => ({
  attachTestResults: mockAttachTestResults,
}));

vi.mock('@lib/playwright/trace', () => ({
  startTraceCapture: mockStartTraceCapture,
  exportTrace: mockExportTrace,
}));

describe('PerformanceTestRunner', () => {
  beforeEach(() => {
    // Re-setup stopAll implementation (it actually stops handles like the real impl)
    mockStopAll.mockImplementation(
      async (handles: Map<string, { stop: () => Promise<unknown> }>) => {
        const results = new Map();
        for (const [name, handle] of handles.entries()) {
          try {
            const result = await handle.stop();
            results.set(name, result);
          } catch {
            results.set(name, null);
          }
        }
        handles.clear();
        return results;
      },
    );

    // Default: CPU throttling returns a mock handle
    const mockCpuHandle = {
      stop: vi.fn().mockResolvedValue(null),
      isActive: vi.fn().mockReturnValue(true),
      getRate: vi.fn().mockReturnValue(4),
      reapply: vi.fn().mockResolvedValue(true),
    };
    mockCpuThrottlingStart.mockResolvedValue(mockCpuHandle);

    // Default: network throttling returns null (not configured)
    mockNetworkThrottlingStart.mockResolvedValue(null);

    // Default: FPS tracking returns null (not enabled)
    mockFpsTrackingStart.mockResolvedValue(null);

    // Default: Memory tracking returns null (not enabled)
    mockMemoryTrackingStart.mockResolvedValue(null);

    mockCaptureProfilerState.mockResolvedValue({
      sampleCount: 10,
      totalActualDuration: 100,
      totalBaseDuration: 150,
      phaseBreakdown: { mount: 1, update: 9 },
    });
    mockAssertPerformanceThresholds.mockImplementation(() => {});
    mockAttachTestResults.mockResolvedValue(undefined);
  });

  const createFixtures = (): PerformanceTestFixtures<BasePerformanceFixtures> => {
    const mockPage = createMockPage(createMockProfilerState());
    return {
      page: mockPage,
      performance: createMockPerformance(),
    };
  };

  describe('execute', () => {
    it('should apply CPU throttling during setup', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ throttleRate: 4 });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockCpuThrottlingStart).toHaveBeenCalledWith(mockPage, { rate: 4 });
    });

    it('should not apply CPU throttling when rate is 1', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ throttleRate: 1 });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockCpuThrottlingStart).not.toHaveBeenCalled();
    });

    it('should run warmup when enabled', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ warmup: true });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      // Test function called twice (warmup + actual)
      expect(testFn).toHaveBeenCalledTimes(2);
    });

    it('should skip warmup when disabled', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ warmup: false });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      // Test function called once (no warmup)
      expect(testFn).toHaveBeenCalledTimes(1);
    });

    it('should capture profiler state after test', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo();
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockCaptureProfilerState).toHaveBeenCalledWith(mockPage);
    });

    it('should assert performance thresholds', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo();
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockAssertPerformanceThresholds).toHaveBeenCalled();
    });

    it('should attach test results', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo();
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockAttachTestResults).toHaveBeenCalled();
    });

    it('should cleanup handles after test', async () => {
      const mockHandle = {
        stop: vi.fn().mockResolvedValue(null),
        isActive: vi.fn().mockReturnValue(true),
        getRate: vi.fn().mockReturnValue(4),
      };
      mockCpuThrottlingStart.mockResolvedValue(mockHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ throttleRate: 4 });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockHandle.stop).toHaveBeenCalled();
    });

    it('should cleanup even if test fails', async () => {
      const mockHandle = {
        stop: vi.fn().mockResolvedValue(null),
        isActive: vi.fn().mockReturnValue(true),
        getRate: vi.fn().mockReturnValue(4),
      };
      mockCpuThrottlingStart.mockResolvedValue(mockHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ throttleRate: 4 });
      const testFn = vi.fn().mockRejectedValue(new Error('Test failed'));

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);

      await expect(runner.execute(testFn)).rejects.toThrow('Test failed');
      expect(mockHandle.stop).toHaveBeenCalled();
    });
  });

  describe('FPS tracking', () => {
    it('should start FPS tracking when trackFps is true and handle is returned', async () => {
      const mockFpsHandle = {
        stop: vi.fn().mockResolvedValue({
          avg: 60,
          frameCount: 120,
          trackingDurationMs: 2000,
        }),
        reset: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockReturnValue(true),
      };
      mockFpsTrackingStart.mockResolvedValue(mockFpsHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ trackFps: true });
      const testFn = vi.fn().mockResolvedValue(undefined);
      const performanceFixture = fixtures.performance;

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockFpsTrackingStart).toHaveBeenCalledWith(mockPage);
      expect(mockFpsHandle.stop).toHaveBeenCalled();
      expect(performanceFixture.setTrackingHandle).toHaveBeenCalledWith(
        'fps-tracking',
        mockFpsHandle,
      );
      expect(performanceFixture.setTrackingHandle).toHaveBeenCalledWith('fps-tracking', null);
    });

    it('should not start FPS tracking when trackFps is false', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ trackFps: false });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockFpsTrackingStart).not.toHaveBeenCalled();
    });

    it('should include FPS metrics in assertions when tracking is enabled', async () => {
      const mockFpsHandle = {
        stop: vi.fn().mockResolvedValue({
          avg: 60,
          frameCount: 120,
          trackingDurationMs: 2000,
        }),
        reset: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockReturnValue(true),
      };
      mockFpsTrackingStart.mockResolvedValue(mockFpsHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ trackFps: true });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockAssertPerformanceThresholds).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            fps: expect.objectContaining({
              avg: 60,
              frameCount: 120,
            }),
          }),
        }),
      );
    });

    it('should handle null FPS metrics gracefully', async () => {
      const mockFpsHandle = {
        stop: vi.fn().mockResolvedValue(null),
        reset: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockReturnValue(true),
      };
      mockFpsTrackingStart.mockResolvedValue(mockFpsHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ trackFps: true });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockAssertPerformanceThresholds).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.not.objectContaining({
            fps: expect.anything(),
          }),
        }),
      );
    });

    it('should handle FPS tracking start returning null (non-Chromium)', async () => {
      mockFpsTrackingStart.mockResolvedValue(null);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ trackFps: true });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockAssertPerformanceThresholds).toHaveBeenCalled();
      expect(mockAttachTestResults).toHaveBeenCalled();
    });
  });

  describe('Network throttling', () => {
    it('should apply network throttling when configured', async () => {
      const mockNetworkHandle = {
        stop: vi.fn().mockResolvedValue(null),
        isActive: vi.fn().mockReturnValue(true),
        getConditions: vi.fn().mockReturnValue({ latency: 150 }),
      };
      mockNetworkThrottlingStart.mockResolvedValue(mockNetworkHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ networkThrottling: 'fast-3g' });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockNetworkThrottlingStart).toHaveBeenCalledWith(mockPage, 'fast-3g');
      expect(mockNetworkHandle.stop).toHaveBeenCalled();
    });

    it('should not apply network throttling when not configured', async () => {
      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({ networkThrottling: undefined });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      expect(mockNetworkThrottlingStart).not.toHaveBeenCalled();
    });
  });

  describe('CPU throttling persistence across iterations', () => {
    it('should re-apply CPU throttling after navigation between iterations', async () => {
      const mockCpuHandle = {
        stop: vi.fn().mockResolvedValue(null),
        isActive: vi.fn().mockReturnValue(true),
        getRate: vi.fn().mockReturnValue(4),
        reapply: vi.fn().mockResolvedValue(true),
      };
      mockCpuThrottlingStart.mockResolvedValue(mockCpuHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({
        throttleRate: 4,
        iterations: 3,
        warmup: false,
      });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      // reapply should be called once per navigation between iterations (2 navigations for 3 iterations)
      expect(mockCpuHandle.reapply).toHaveBeenCalledTimes(2);
    });

    it('should re-apply CPU throttling after warmup navigation', async () => {
      const mockCpuHandle = {
        stop: vi.fn().mockResolvedValue(null),
        isActive: vi.fn().mockReturnValue(true),
        getRate: vi.fn().mockReturnValue(4),
        reapply: vi.fn().mockResolvedValue(true),
      };
      mockCpuThrottlingStart.mockResolvedValue(mockCpuHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({
        throttleRate: 4,
        warmup: true,
        iterations: 1,
      });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      // reapply should be called once after warmup navigation
      expect(mockCpuHandle.reapply).toHaveBeenCalledTimes(1);
    });

    it('should not re-apply CPU throttling when throttleRate is 1 (no throttling)', async () => {
      mockCpuThrottlingStart.mockResolvedValue(null);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({
        throttleRate: 1,
        iterations: 3,
        warmup: false,
      });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      // Should not have started CPU throttling
      expect(mockCpuThrottlingStart).not.toHaveBeenCalled();
    });

    it('should re-apply CPU throttling with FPS tracking enabled', async () => {
      const mockCpuHandle = {
        stop: vi.fn().mockResolvedValue(null),
        isActive: vi.fn().mockReturnValue(true),
        getRate: vi.fn().mockReturnValue(4),
        reapply: vi.fn().mockResolvedValue(true),
      };
      mockCpuThrottlingStart.mockResolvedValue(mockCpuHandle);

      const mockFpsHandle = {
        stop: vi.fn().mockResolvedValue({
          avg: 30,
          frameCount: 60,
          trackingDurationMs: 2000,
        }),
        reset: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockReturnValue(true),
      };
      mockFpsTrackingStart.mockResolvedValue(mockFpsHandle);

      const mockPage = createMockPage(createMockProfilerState());
      const fixtures = createFixtures();
      const testInfo = createMockTestInfo({
        throttleRate: 4,
        trackFps: true,
        iterations: 3,
        warmup: false,
      });
      const testFn = vi.fn().mockResolvedValue(undefined);

      const runner = new PerformanceTestRunner(mockPage, fixtures, testInfo);
      await runner.execute(testFn);

      // CPU throttling should be re-applied after each navigation
      expect(mockCpuHandle.reapply).toHaveBeenCalledTimes(2);
      // FPS tracking should start for each iteration
      expect(mockFpsTrackingStart).toHaveBeenCalledTimes(3);
    });
  });
});
