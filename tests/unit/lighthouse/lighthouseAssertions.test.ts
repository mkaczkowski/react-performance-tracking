import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfiguredLighthouseTestInfo, LighthouseMetrics } from '@lib/lighthouse/types';

// Mock dependencies before importing
vi.mock('@lib/playwright/assertions/logging', () => ({
  logTestHeader: vi.fn(),
  logTestFooter: vi.fn(),
  logGlobalMetricsTable: vi.fn(),
}));

vi.mock('@lib/playwright/config/performanceConfig', () => ({
  PERFORMANCE_CONFIG: {
    isCI: false,
  },
}));

// Import after mocks are set up
import {
  assertLighthouseThresholds,
  attachLighthouseResults,
} from '@lib/lighthouse/lighthouseAssertions';

describe('assertLighthouseThresholds', () => {
  const mockTestInfo = {
    title: 'test',
    attach: vi.fn().mockResolvedValue(undefined),
    thresholds: {
      performance: 90,
      accessibility: 95,
      bestPractices: 0,
      seo: 0,
      pwa: 0,
    },
    buffers: {
      performance: 5,
      accessibility: 5,
      bestPractices: 5,
      seo: 5,
      pwa: 5,
    },
    throttling: {
      cpu: 4,
      network: 'fast-4g' as const,
    },
    warmup: false,
    name: 'lighthouse-test',
    categories: ['performance', 'accessibility'] as const,
    formFactor: 'mobile' as const,
    skipAudits: [],
  } as unknown as ConfiguredLighthouseTestInfo;

  const mockMetrics: LighthouseMetrics = {
    performance: 95,
    accessibility: 98,
    bestPractices: 90,
    seo: 85,
    pwa: null,
    auditDurationMs: 15000,
    url: 'http://localhost:3000',
    timestamp: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass when scores meet thresholds', () => {
    expect(() =>
      assertLighthouseThresholds({
        metrics: mockMetrics,
        testInfo: mockTestInfo,
      }),
    ).not.toThrow();
  });

  it('should fail when performance score is below threshold', () => {
    const lowScoreMetrics: LighthouseMetrics = {
      ...mockMetrics,
      performance: 80, // Below 90 - 5% buffer = 85.5
    };

    expect(() =>
      assertLighthouseThresholds({
        metrics: lowScoreMetrics,
        testInfo: mockTestInfo,
      }),
    ).toThrow(/Expected: >= 85\.5/);
  });

  it('should pass when score is at buffer boundary', () => {
    const boundaryMetrics: LighthouseMetrics = {
      ...mockMetrics,
      performance: 86, // Exactly at 90 - 5% = 85.5, rounded up to 86
    };

    expect(() =>
      assertLighthouseThresholds({
        metrics: boundaryMetrics,
        testInfo: mockTestInfo,
      }),
    ).not.toThrow();
  });

  it('should skip categories with threshold of 0', () => {
    const metricsWithLowSeo: LighthouseMetrics = {
      ...mockMetrics,
      seo: 20, // Very low, but threshold is 0 so should be skipped
    };

    expect(() =>
      assertLighthouseThresholds({
        metrics: metricsWithLowSeo,
        testInfo: mockTestInfo,
      }),
    ).not.toThrow();
  });

  it('should skip categories with null score', () => {
    const testInfoWithPwa = {
      ...mockTestInfo,
      thresholds: {
        ...mockTestInfo.thresholds,
        pwa: 80, // Set threshold but score is null
      },
    } as unknown as ConfiguredLighthouseTestInfo;

    // pwa is null in mockMetrics, should be skipped
    expect(() =>
      assertLighthouseThresholds({
        metrics: mockMetrics,
        testInfo: testInfoWithPwa,
      }),
    ).not.toThrow();
  });
});

describe('attachLighthouseResults', () => {
  const mockTestInfo = {
    attach: vi.fn().mockResolvedValue(undefined),
    thresholds: {
      performance: 90,
      accessibility: 95,
      bestPractices: 0,
      seo: 0,
      pwa: 0,
    },
    buffers: {
      performance: 5,
      accessibility: 5,
      bestPractices: 5,
      seo: 5,
      pwa: 5,
    },
    throttling: {
      cpu: 4,
      network: 'fast-4g',
    },
    warmup: false,
    name: 'lighthouse-test',
    categories: ['performance', 'accessibility'],
    formFactor: 'mobile',
    skipAudits: [],
  } as unknown as ConfiguredLighthouseTestInfo;

  const mockMetrics: LighthouseMetrics = {
    performance: 95,
    accessibility: 98,
    bestPractices: 90,
    seo: 85,
    pwa: null,
    auditDurationMs: 15000,
    url: 'http://localhost:3000',
    timestamp: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attach results as JSON', async () => {
    await attachLighthouseResults(mockTestInfo, mockMetrics);

    expect(mockTestInfo.attach).toHaveBeenCalledWith(
      'lighthouse-test',
      expect.objectContaining({
        contentType: 'application/json',
      }),
    );
  });

  it('should include metrics in attachment', async () => {
    await attachLighthouseResults(mockTestInfo, mockMetrics);

    const attachCall = mockTestInfo.attach.mock.calls[0];
    const body = JSON.parse(attachCall[1].body);

    expect(body.metrics).toEqual(mockMetrics);
    expect(body.throttling).toEqual(mockTestInfo.throttling);
    expect(body.thresholds).toEqual(mockTestInfo.thresholds);
    expect(body.environment).toBe('local');
  });
});
