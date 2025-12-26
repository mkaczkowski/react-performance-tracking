import { describe, expect, it, vi } from 'vitest';

import type { ConfiguredTestInfo } from '@lib/playwright/types';
import type { CapturedProfilerState } from '@/playwright/profiler/profilerState';
import { assertPerformanceThresholds } from '@lib/playwright/assertions/performanceAssertions';

// Use vi.hoisted to ensure mocks are available before vi.mock
const {
  mockLogTestHeader,
  mockLogTestFooter,
  mockLogResultsTable,
  mockLogIterationsTable,
  mockLogComponentResultsTables,
  mockLogGlobalMetricsTable,
  mockLogCustomMetrics,
  mockCreateDurationMetricRow,
  mockCreateSamplesMetricRow,
  mockCreateFPSMetricRow,
  mockCreateHeapGrowthMetricRow,
  mockCreateWebVitalsMetricRows,
  mockCreateLighthouseMetricRows,
  mockCreateComponentMetrics,
  mockAssertMinimumActivity,
  mockAssertDurationThreshold,
  mockAssertSampleCountThreshold,
  mockAssertMemoizationEffectiveness,
  mockAssertFPSThreshold,
} = vi.hoisted(() => ({
  mockLogTestHeader: vi.fn(),
  mockLogTestFooter: vi.fn(),
  mockLogResultsTable: vi.fn(),
  mockLogIterationsTable: vi.fn(),
  mockLogComponentResultsTables: vi.fn(),
  mockLogGlobalMetricsTable: vi.fn(),
  mockLogCustomMetrics: vi.fn(),
  mockCreateDurationMetricRow: vi.fn(() => ({
    name: 'Duration',
    actual: '100.00ms',
    threshold: '< 600ms',
    passed: true,
  })),
  mockCreateSamplesMetricRow: vi.fn(() => ({
    name: 'Renders',
    actual: '10',
    threshold: '≤ 24',
    passed: true,
  })),
  mockCreateFPSMetricRow: vi.fn(() => ({
    name: 'FPS',
    actual: '55.0',
    threshold: '≥ 48.0',
    passed: true,
  })),
  mockCreateHeapGrowthMetricRow: vi.fn(() => ({
    name: 'Heap Growth',
    actual: '5.00 MB',
    threshold: '≤ 12.00 MB',
    passed: true,
  })),
  mockCreateWebVitalsMetricRows: vi.fn(() => []),
  mockCreateLighthouseMetricRows: vi.fn(() => []),
  mockCreateComponentMetrics: vi.fn(() => [
    {
      id: 'counter',
      duration: { name: 'Duration', actual: '100.00ms', threshold: '< 600ms', passed: true },
      renders: { name: 'Renders', actual: '5', threshold: '≤ 24', passed: true },
      phaseBreakdown: { mount: 1, update: 4 },
    },
  ]),
  mockAssertMinimumActivity: vi.fn(),
  mockAssertDurationThreshold: vi.fn(),
  mockAssertSampleCountThreshold: vi.fn(),
  mockAssertMemoizationEffectiveness: vi.fn(),
  mockAssertFPSThreshold: vi.fn(),
}));

// Mock logging functions
vi.mock('@lib/playwright/assertions/logging', () => ({
  logTestHeader: mockLogTestHeader,
  logTestFooter: mockLogTestFooter,
  logResultsTable: mockLogResultsTable,
  logIterationsTable: mockLogIterationsTable,
  logComponentResultsTables: mockLogComponentResultsTables,
  logGlobalMetricsTable: mockLogGlobalMetricsTable,
  logCustomMetrics: mockLogCustomMetrics,
  createDurationMetricRow: mockCreateDurationMetricRow,
  createSamplesMetricRow: mockCreateSamplesMetricRow,
  createFPSMetricRow: mockCreateFPSMetricRow,
  createHeapGrowthMetricRow: mockCreateHeapGrowthMetricRow,
  createWebVitalsMetricRows: mockCreateWebVitalsMetricRows,
  createLighthouseMetricRows: mockCreateLighthouseMetricRows,
  createComponentMetrics: mockCreateComponentMetrics,
}));

// Mock validators
vi.mock('@lib/playwright/assertions/validators', () => ({
  assertMinimumActivity: mockAssertMinimumActivity,
  assertDurationThreshold: mockAssertDurationThreshold,
  assertSampleCountThreshold: mockAssertSampleCountThreshold,
  assertMemoizationEffectiveness: mockAssertMemoizationEffectiveness,
  assertFPSThreshold: mockAssertFPSThreshold,
  assertHeapGrowthThreshold: vi.fn(),
  assertLCPThreshold: vi.fn(),
  assertINPThreshold: vi.fn(),
  assertCLSThreshold: vi.fn(),
}));

// Default resolved threshold values for tests
const DEFAULT_DURATION_THRESHOLDS = { avg: 500, p50: 0, p95: 0, p99: 0 };
const DEFAULT_FPS_THRESHOLDS = { avg: 60, p50: 0, p95: 0, p99: 0 };
const DEFAULT_MEMORY_THRESHOLDS = { heapGrowth: 0 };
const DEFAULT_WEBVITALS_THRESHOLDS = { lcp: 0, inp: 0, cls: 0 };
const DEFAULT_LIGHTHOUSE_THRESHOLDS = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  pwa: 0,
};

const DEFAULT_THRESHOLDS = {
  profiler: { '*': { duration: DEFAULT_DURATION_THRESHOLDS, rerenders: 20 } },
  fps: DEFAULT_FPS_THRESHOLDS,
  memory: DEFAULT_MEMORY_THRESHOLDS,
  webVitals: DEFAULT_WEBVITALS_THRESHOLDS,
  lighthouse: DEFAULT_LIGHTHOUSE_THRESHOLDS,
};

const DEFAULT_BUFFERS = {
  duration: 20,
  rerenders: 20,
  fps: 20,
  heapGrowth: 20,
  webVitals: { lcp: 20, inp: 20, cls: 20 },
  lighthouse: 5,
};

const createMockTestInfo = (overrides: Partial<ConfiguredTestInfo> = {}): ConfiguredTestInfo => {
  return {
    throttleRate: 4,
    warmup: false,
    thresholds: DEFAULT_THRESHOLDS,
    buffers: DEFAULT_BUFFERS,
    name: 'test-performance-data',
    trackFps: false,
    trackMemory: false,
    trackWebVitals: false,
    iterations: 1,
    lighthouse: { enabled: false, formFactor: 'mobile', categories: [], skipAudits: [] },
    ...overrides,
  } as ConfiguredTestInfo;
};

const createMockMetrics = (
  overrides: Partial<CapturedProfilerState> = {},
): CapturedProfilerState => {
  return {
    sampleCount: 10,
    totalActualDuration: 100,
    totalBaseDuration: 150,
    phaseBreakdown: { mount: 1, update: 9 },
    components: {},
    ...overrides,
  };
};

describe('assertPerformanceThresholds', () => {
  it('should throw when metrics is null', () => {
    const testInfo = createMockTestInfo();

    expect(() =>
      assertPerformanceThresholds({
        metrics: null,
        testInfo,
      }),
    ).toThrow(/not.toBeNull|Received: null/);
  });

  it('should log test header with configuration', () => {
    const testInfo = createMockTestInfo({
      name: 'my-test',
      throttleRate: 4,
      warmup: true,
      iterations: 3,
    });
    const metrics = createMockMetrics();

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockLogTestHeader).toHaveBeenCalledWith({
      testName: 'my-test',
      throttleRate: 4,
      warmup: true,
      iterations: 3,
      networkThrottling: undefined,
    });
  });

  it('should create duration and samples metric rows', () => {
    const testInfo = createMockTestInfo();
    const metrics = createMockMetrics({
      sampleCount: 15,
      totalActualDuration: 200,
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockCreateDurationMetricRow).toHaveBeenCalledWith(200, 500, 20);
    expect(mockCreateSamplesMetricRow).toHaveBeenCalledWith(15, 20, 20);
  });

  it('should create FPS metric row when trackFps is true and fps metrics available', () => {
    const testInfo = createMockTestInfo({ trackFps: true });
    const metrics = createMockMetrics({
      fps: {
        avg: 55,
        frameCount: 100,
        trackingDurationMs: 2000,
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockCreateFPSMetricRow).toHaveBeenCalledWith(55, 60, 20);
  });

  it('should not create FPS metric row when trackFps is false', () => {
    const testInfo = createMockTestInfo({ trackFps: false });
    const metrics = createMockMetrics({
      fps: {
        avg: 55,
        frameCount: 100,
        trackingDurationMs: 2000,
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockCreateFPSMetricRow).not.toHaveBeenCalled();
  });

  it('should log results table for single component', () => {
    const testInfo = createMockTestInfo({
      thresholds: {
        profiler: { counter: { duration: DEFAULT_DURATION_THRESHOLDS, rerenders: 20 } },
        fps: DEFAULT_FPS_THRESHOLDS,
        memory: DEFAULT_MEMORY_THRESHOLDS,
        webVitals: DEFAULT_WEBVITALS_THRESHOLDS,
        lighthouse: DEFAULT_LIGHTHOUSE_THRESHOLDS,
      },
    });
    const metrics = createMockMetrics({
      components: {
        counter: {
          totalActualDuration: 100,
          totalBaseDuration: 150,
          renderCount: 5,
          phaseBreakdown: { mount: 1, update: 4 },
        },
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockLogResultsTable).toHaveBeenCalled();
    expect(mockLogComponentResultsTables).not.toHaveBeenCalled();
  });

  it('should log component tables for multiple components', () => {
    const testInfo = createMockTestInfo({
      thresholds: DEFAULT_THRESHOLDS,
    });
    const metrics = createMockMetrics({
      components: {
        counter: {
          totalActualDuration: 100,
          totalBaseDuration: 150,
          renderCount: 5,
          phaseBreakdown: { mount: 1, update: 4 },
        },
        header: {
          totalActualDuration: 50,
          totalBaseDuration: 75,
          renderCount: 2,
          phaseBreakdown: { mount: 1, update: 1 },
        },
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockLogComponentResultsTables).toHaveBeenCalled();
    expect(mockLogResultsTable).not.toHaveBeenCalled();
  });

  it('should log global metrics table for FPS when multiple components', () => {
    const testInfo = createMockTestInfo({
      trackFps: true,
      thresholds: DEFAULT_THRESHOLDS,
    });
    const metrics = createMockMetrics({
      fps: {
        avg: 55,
        frameCount: 100,
        trackingDurationMs: 2000,
      },
      components: {
        counter: {
          totalActualDuration: 100,
          totalBaseDuration: 150,
          renderCount: 5,
          phaseBreakdown: { mount: 1, update: 4 },
        },
        header: {
          totalActualDuration: 50,
          totalBaseDuration: 75,
          renderCount: 2,
          phaseBreakdown: { mount: 1, update: 1 },
        },
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockLogGlobalMetricsTable).toHaveBeenCalled();
  });

  it('should call all validators', () => {
    const testInfo = createMockTestInfo({
      thresholds: {
        profiler: { app: { duration: DEFAULT_DURATION_THRESHOLDS, rerenders: 20 } },
        fps: DEFAULT_FPS_THRESHOLDS,
        memory: DEFAULT_MEMORY_THRESHOLDS,
        webVitals: DEFAULT_WEBVITALS_THRESHOLDS,
        lighthouse: DEFAULT_LIGHTHOUSE_THRESHOLDS,
      },
    });
    const metrics = createMockMetrics({
      components: {
        app: {
          totalActualDuration: 100,
          totalBaseDuration: 150,
          renderCount: 10,
          phaseBreakdown: { mount: 1, update: 9 },
        },
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockAssertMinimumActivity).toHaveBeenCalledWith(10);
    // Per-component validation now uses component metrics
    expect(mockAssertDurationThreshold).toHaveBeenCalledWith({
      actual: 100,
      threshold: 500,
      bufferPercent: 20,
      throttleRate: 4,
    });
    expect(mockAssertSampleCountThreshold).toHaveBeenCalledWith({
      actual: 10,
      threshold: 20,
      bufferPercent: 20,
    });
    expect(mockAssertMemoizationEffectiveness).toHaveBeenCalledWith(100, 150);
  });

  it('should call FPS validator when trackFps is true and fps metrics available', () => {
    const testInfo = createMockTestInfo({ trackFps: true });
    const metrics = createMockMetrics({
      fps: {
        avg: 55,
        frameCount: 100,
        trackingDurationMs: 2000,
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockAssertFPSThreshold).toHaveBeenCalledWith({
      actual: 55,
      threshold: 60,
      bufferPercent: 20,
    });
  });

  it('should not call FPS validator when trackFps is false', () => {
    const testInfo = createMockTestInfo({ trackFps: false });
    const metrics = createMockMetrics();

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockAssertFPSThreshold).not.toHaveBeenCalled();
  });

  it('should log success footer when all assertions pass', () => {
    const testInfo = createMockTestInfo();
    const metrics = createMockMetrics();

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockLogTestFooter).toHaveBeenCalledWith(2, 2); // 2 metrics, all passed
  });

  it('should log failure footer and rethrow when assertion fails', () => {
    const testInfo = createMockTestInfo();
    const metrics = createMockMetrics();
    const error = new Error('Assertion failed');

    mockAssertMinimumActivity.mockImplementationOnce(() => {
      throw error;
    });

    expect(() => assertPerformanceThresholds({ metrics, testInfo })).toThrow('Assertion failed');
    expect(mockLogTestFooter).toHaveBeenCalledWith(2, 2); // Footer still logs before throw
  });

  it('should log custom metrics when present', () => {
    const testInfo = createMockTestInfo();
    const metrics = createMockMetrics({
      customMetrics: {
        marks: [{ name: 'test', timestamp: 100 }],
        measures: [],
      },
    });

    assertPerformanceThresholds({ metrics, testInfo });

    expect(mockLogCustomMetrics).toHaveBeenCalledWith({
      marks: [{ name: 'test', timestamp: 100 }],
      measures: [],
    });
  });
});
