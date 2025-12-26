import type { TestInfo } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import {
  addConfigurationAnnotation,
  createConfiguredTestInfo,
  generateArtifactName,
  resolveBuffers,
  resolveComponentThresholds,
  resolveDurationThresholds,
  resolveExportTrace,
  resolveFPSThresholds,
  resolveIterations,
  resolveNetworkThrottling,
  resolveProfilerThresholds,
  resolveThresholds,
  resolveThrottleRate,
  resolveTrackFps,
  resolveTrackMemory,
  resolveTrackWebVitals,
  resolveWebVitalsBuffers,
  resolveWebVitalsThresholds,
} from '@lib/playwright/config/configResolver';
import type { ConfiguredTestInfo, TestConfig } from '@lib/playwright/types';

describe('resolveTrackFps', () => {
  it('should enable when fps thresholds are present in base config', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, fps: { avg: 30 } } },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });

  it('should enable when fps thresholds are present in CI config', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} }, ci: { fps: { avg: 30 } } },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });

  it('should enable when fps thresholds in both base and CI', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, fps: { avg: 30 } },
        ci: { fps: { avg: 20 } },
      },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });

  it('should disable when no fps thresholds configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveTrackFps(config)).toBe(false);
  });

  it('should enable when fps threshold is 0', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, fps: { avg: 0 } } },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });

  it('should enable when fps threshold is simple number', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, fps: 30 } },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });

  it('should enable when fps threshold object has only percentiles', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, fps: { p50: 25, p95: 20 } } },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });

  it('should enable when empty fps object provided', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, fps: {} } },
    };
    expect(resolveTrackFps(config)).toBe(true);
  });
});

describe('resolveTrackMemory', () => {
  it('should enable when heapGrowth threshold in base config', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, memory: { heapGrowth: 1024 } },
      },
    };
    expect(resolveTrackMemory(config)).toBe(true);
  });

  it('should enable when heapGrowth threshold in CI config', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {} },
        ci: { memory: { heapGrowth: 512 } },
      },
    };
    expect(resolveTrackMemory(config)).toBe(true);
  });

  it('should enable when heapGrowth threshold in both base and CI', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, memory: { heapGrowth: 1024 } },
        ci: { memory: { heapGrowth: 512 } },
      },
    };
    expect(resolveTrackMemory(config)).toBe(true);
  });

  it('should disable when no memory thresholds configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveTrackMemory(config)).toBe(false);
  });

  it('should disable when memory object exists but heapGrowth is undefined', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, memory: {} } },
    };
    expect(resolveTrackMemory(config)).toBe(false);
  });

  it('should enable when heapGrowth threshold is 0', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, memory: { heapGrowth: 0 } },
      },
    };
    expect(resolveTrackMemory(config)).toBe(true);
  });
});

describe('resolveTrackWebVitals', () => {
  it('should enable when webVitals thresholds in base config', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, webVitals: { lcp: 2500 } },
      },
    };
    expect(resolveTrackWebVitals(config)).toBe(true);
  });

  it('should enable when webVitals thresholds in CI config', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {} },
        ci: { webVitals: { inp: 200 } },
      },
    };
    expect(resolveTrackWebVitals(config)).toBe(true);
  });

  it('should enable when webVitals thresholds in both base and CI', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, webVitals: { lcp: 2500 } },
        ci: { webVitals: { inp: 200 } },
      },
    };
    expect(resolveTrackWebVitals(config)).toBe(true);
  });

  it('should disable when no webVitals thresholds configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveTrackWebVitals(config)).toBe(false);
  });

  it('should enable when webVitals threshold is 0', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, webVitals: { lcp: 0 } },
      },
    };
    expect(resolveTrackWebVitals(config)).toBe(true);
  });

  it('should enable when multiple webVitals thresholds configured', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, webVitals: { lcp: 2500, inp: 200, cls: 0.1 } },
      },
    };
    expect(resolveTrackWebVitals(config)).toBe(true);
  });

  it('should enable when empty webVitals object provided', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {}, webVitals: {} } },
    };
    expect(resolveTrackWebVitals(config)).toBe(true);
  });
});

describe('generateArtifactName', () => {
  it('should convert spaces to hyphens', () => {
    expect(generateArtifactName('My Test Name')).toBe('my-test-name-performance-data');
  });

  it('should remove special characters', () => {
    expect(generateArtifactName('Test@#$%Name!')).toBe('testname-performance-data');
  });

  it('should handle multiple spaces', () => {
    expect(generateArtifactName('Test   Multiple   Spaces')).toBe(
      'test-multiple-spaces-performance-data',
    );
  });

  it('should lowercase the title', () => {
    expect(generateArtifactName('UPPERCASE')).toBe('uppercase-performance-data');
  });

  it('should handle empty string', () => {
    expect(generateArtifactName('')).toBe('-performance-data');
  });
});

describe('resolveThrottleRate', () => {
  it('should return configured throttleRate', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      throttleRate: 4,
    };
    expect(resolveThrottleRate(config)).toBe(4);
  });

  it('should return default (1) when not configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveThrottleRate(config)).toBe(1);
  });
});

describe('resolveWebVitalsThresholds', () => {
  it('should return defaults (0) when no webVitals configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveWebVitalsThresholds(config, false)).toEqual({
      lcp: 0,
      inp: 0,
      cls: 0,
    });
  });

  it('should return base values when not CI', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, webVitals: { lcp: 2500, inp: 200, cls: 0.1 } },
      },
    };
    expect(resolveWebVitalsThresholds(config, false)).toEqual({
      lcp: 2500,
      inp: 200,
      cls: 0.1,
    });
  });

  it('should merge CI overrides when isCI is true', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, webVitals: { lcp: 2500, inp: 200, cls: 0.1 } },
        ci: { webVitals: { lcp: 3000 } },
      },
    };
    expect(resolveWebVitalsThresholds(config, true)).toEqual({
      lcp: 3000,
      inp: 200,
      cls: 0.1,
    });
  });

  it('should use CI-only values when base not configured', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {} },
        ci: { webVitals: { lcp: 3000 } },
      },
    };
    expect(resolveWebVitalsThresholds(config, true)).toEqual({
      lcp: 3000,
      inp: 0,
      cls: 0,
    });
  });
});

describe('resolveDurationThresholds', () => {
  it('should handle number format (treated as avg)', () => {
    const result = resolveDurationThresholds(500, undefined, false);
    expect(result).toEqual({
      avg: 500,
      p50: 0,
      p95: 0,
      p99: 0,
    });
  });

  it('should handle object format with all percentiles', () => {
    const result = resolveDurationThresholds(
      { avg: 500, p50: 100, p95: 200, p99: 300 },
      undefined,
      false,
    );
    expect(result).toEqual({
      avg: 500,
      p50: 100,
      p95: 200,
      p99: 300,
    });
  });

  it('should merge CI overrides when isCI is true', () => {
    const result = resolveDurationThresholds({ avg: 500, p50: 100 }, { avg: 600, p95: 250 }, true);
    expect(result).toEqual({
      avg: 600,
      p50: 100,
      p95: 250,
      p99: 0,
    });
  });

  it('should ignore CI overrides when isCI is false', () => {
    const result = resolveDurationThresholds({ avg: 500 }, { avg: 600 }, false);
    expect(result).toEqual({
      avg: 500,
      p50: 0,
      p95: 0,
      p99: 0,
    });
  });

  it('should handle zero base with CI override', () => {
    const result = resolveDurationThresholds(0, { avg: 600 }, true);
    expect(result).toEqual({
      avg: 600,
      p50: 0,
      p95: 0,
      p99: 0,
    });
  });
});

describe('resolveFPSThresholds', () => {
  it('should return default (60) when no fps configured', () => {
    const result = resolveFPSThresholds(undefined, undefined, false);
    expect(result.avg).toBe(60);
  });

  it('should handle number format', () => {
    const result = resolveFPSThresholds(30, undefined, false);
    expect(result).toEqual({
      avg: 30,
      p50: 0,
      p95: 0,
      p99: 0,
    });
  });

  it('should handle object format', () => {
    const result = resolveFPSThresholds({ avg: 30, p50: 25, p95: 20 }, undefined, false);
    expect(result).toEqual({
      avg: 30,
      p50: 25,
      p95: 20,
      p99: 0,
    });
  });

  it('should merge CI overrides', () => {
    const result = resolveFPSThresholds({ avg: 30 }, { avg: 25, p95: 15 }, true);
    expect(result).toEqual({
      avg: 25,
      p50: 0,
      p95: 15,
      p99: 0,
    });
  });
});

describe('resolveComponentThresholds', () => {
  it('should resolve with base thresholds only', () => {
    const result = resolveComponentThresholds({ duration: 500, rerenders: 3 }, undefined, false);
    expect(result).toEqual({
      duration: { avg: 500, p50: 0, p95: 0, p99: 0 },
      rerenders: 3,
    });
  });

  it('should merge CI rerenders override', () => {
    const result = resolveComponentThresholds(
      { duration: 500, rerenders: 3 },
      { rerenders: 5 },
      true,
    );
    expect(result.rerenders).toBe(5);
  });

  it('should merge CI duration override', () => {
    const result = resolveComponentThresholds(
      { duration: 500, rerenders: 3 },
      { duration: 600 },
      true,
    );
    expect(result.duration.avg).toBe(600);
  });

  it('should not apply CI overrides when isCI is false', () => {
    const result = resolveComponentThresholds(
      { duration: 500, rerenders: 3 },
      { rerenders: 5 },
      false,
    );
    expect(result.rerenders).toBe(3);
  });
});

describe('resolveProfilerThresholds', () => {
  it('should resolve all component thresholds', () => {
    const config: TestConfig = {
      thresholds: {
        base: {
          profiler: {
            '*': { duration: 500, rerenders: 3 },
            App: { duration: 300, rerenders: 2 },
          },
        },
      },
    };
    const result = resolveProfilerThresholds(config, false);
    expect(result['*']).toBeDefined();
    expect(result['App']).toBeDefined();
    expect(result['*'].duration.avg).toBe(500);
    expect(result['App'].duration.avg).toBe(300);
  });

  it('should merge CI overrides per component', () => {
    const config: TestConfig = {
      thresholds: {
        base: {
          profiler: {
            '*': { duration: 500, rerenders: 3 },
          },
        },
        ci: {
          profiler: {
            '*': { duration: 600 },
          },
        },
      },
    };
    const result = resolveProfilerThresholds(config, true);
    expect(result['*'].duration.avg).toBe(600);
  });

  it('should ignore CI-only components without base', () => {
    const config: TestConfig = {
      thresholds: {
        base: {
          profiler: {
            '*': { duration: 500, rerenders: 3 },
          },
        },
        ci: {
          profiler: {
            NewComponent: { duration: 600, rerenders: 2 },
          },
        },
      },
    };
    const result = resolveProfilerThresholds(config, true);
    expect(result['NewComponent']).toBeUndefined();
  });
});

describe('resolveThresholds', () => {
  it('should resolve all threshold types', () => {
    const config: TestConfig = {
      thresholds: {
        base: {
          profiler: { '*': { duration: 500, rerenders: 3 } },
          fps: 30,
          memory: { heapGrowth: 1024 },
          webVitals: { lcp: 2500 },
        },
      },
    };
    const result = resolveThresholds(config, false);
    expect(result.profiler['*'].duration.avg).toBe(500);
    expect(result.fps.avg).toBe(30);
    expect(result.memory.heapGrowth).toBe(1024);
    expect(result.webVitals.lcp).toBe(2500);
  });

  it('should use default memory threshold (0) when not configured', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {} },
      },
    };
    const result = resolveThresholds(config, false);
    expect(result.memory.heapGrowth).toBe(0);
  });

  it('should apply CI memory override', () => {
    const config: TestConfig = {
      thresholds: {
        base: { profiler: {}, memory: { heapGrowth: 1024 } },
        ci: { memory: { heapGrowth: 512 } },
      },
    };
    const result = resolveThresholds(config, true);
    expect(result.memory.heapGrowth).toBe(512);
  });
});

describe('resolveWebVitalsBuffers', () => {
  it('should return defaults when no buffers configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    const result = resolveWebVitalsBuffers(config);
    expect(result).toEqual({ lcp: 20, inp: 20, cls: 20 });
  });

  it('should override specific buffers', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      buffers: { webVitals: { lcp: 10, inp: 15, cls: 25 } },
    };
    const result = resolveWebVitalsBuffers(config);
    expect(result).toEqual({ lcp: 10, inp: 15, cls: 25 });
  });
});

describe('resolveBuffers', () => {
  it('should return all defaults when no buffers configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    const result = resolveBuffers(config);
    expect(result).toEqual({
      duration: 20,
      rerenders: 20,
      fps: 20,
      heapGrowth: 20,
      webVitals: { lcp: 20, inp: 20, cls: 20 },
      lighthouse: 5,
    });
  });

  it('should override specific buffers', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      buffers: { duration: 10, fps: 15 },
    };
    const result = resolveBuffers(config);
    expect(result.duration).toBe(10);
    expect(result.fps).toBe(15);
    expect(result.rerenders).toBe(20);
  });
});

describe('resolveIterations', () => {
  it('should return configured iterations', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      iterations: 5,
    };
    expect(resolveIterations(config)).toBe(5);
  });

  it('should return default (1) when not configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveIterations(config)).toBe(1);
  });

  it('should throw when iterations < 1', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      iterations: 0,
    };
    expect(() => resolveIterations(config)).toThrow('iterations must be >= 1, got 0');
  });

  it('should throw for negative iterations', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      iterations: -1,
    };
    expect(() => resolveIterations(config)).toThrow('iterations must be >= 1, got -1');
  });
});

describe('resolveNetworkThrottling', () => {
  it('should return undefined when not configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    expect(resolveNetworkThrottling(config)).toBeUndefined();
  });

  it('should return preset string', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      networkThrottling: 'slow-3g',
    };
    expect(resolveNetworkThrottling(config)).toBe('slow-3g');
  });

  it('should return custom config object', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      networkThrottling: { downloadThroughput: 1000, uploadThroughput: 500, latency: 100 },
    };
    expect(resolveNetworkThrottling(config)).toEqual({
      downloadThroughput: 1000,
      uploadThroughput: 500,
      latency: 100,
    });
  });
});

describe('resolveExportTrace', () => {
  it('should return disabled when not configured', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    const result = resolveExportTrace(config);
    expect(result.enabled).toBe(false);
  });

  it('should return enabled when true', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      exportTrace: true,
    };
    const result = resolveExportTrace(config);
    expect(result.enabled).toBe(true);
  });

  it('should return enabled with outputPath when string provided', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      exportTrace: '/custom/path/trace.json',
    };
    const result = resolveExportTrace(config);
    expect(result.enabled).toBe(true);
    expect(result.outputPath).toBe('/custom/path/trace.json');
  });
});

describe('createConfiguredTestInfo', () => {
  const mockTestInfo = {
    title: 'Test Title',
    annotations: [],
    attach: vi.fn(),
  } as unknown as TestInfo;

  it('should preserve TestInfo prototype chain', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: { '*': { duration: 500, rerenders: 3 } } } },
    };
    const result = createConfiguredTestInfo(mockTestInfo, config, 'My Test');
    expect(result.attach).toBeDefined();
  });

  it('should add all performance configuration properties', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: { '*': { duration: 500, rerenders: 3 } } } },
    };
    const result = createConfiguredTestInfo(mockTestInfo, config, 'My Test');
    expect(result.thresholds).toBeDefined();
    expect(result.buffers).toBeDefined();
    expect(result.name).toBeDefined();
    expect(result.warmup).toBeDefined();
    expect(result.trackFps).toBeDefined();
    expect(result.trackMemory).toBeDefined();
    expect(result.trackWebVitals).toBeDefined();
    expect(result.throttleRate).toBeDefined();
    expect(result.iterations).toBeDefined();
  });

  it('should use custom name when provided', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
      name: 'custom-name',
    };
    const result = createConfiguredTestInfo(mockTestInfo, config, 'My Test');
    expect(result.name).toBe('custom-name');
  });

  it('should generate name from title when not provided', () => {
    const config: TestConfig = {
      thresholds: { base: { profiler: {} } },
    };
    const result = createConfiguredTestInfo(mockTestInfo, config, 'My Test');
    expect(result.name).toBe('my-test-performance-data');
  });
});

describe('addConfigurationAnnotation', () => {
  it('should add annotation with all settings', () => {
    const testInfo = { annotations: [] } as unknown as TestInfo;
    const configuredTestInfo = {
      throttleRate: 4,
      warmup: true,
      buffers: {
        duration: 20,
        rerenders: 20,
        fps: 20,
        heapGrowth: 20,
        webVitals: { lcp: 20, inp: 20, cls: 20 },
        lighthouse: 5,
      },
      trackFps: true,
      trackMemory: true,
      trackWebVitals: true,
      iterations: 3,
      networkThrottling: 'slow-3g',
      exportTrace: { enabled: true },
      lighthouse: { enabled: true, formFactor: 'mobile', categories: [], skipAudits: [] },
    } as unknown as ConfiguredTestInfo;

    addConfigurationAnnotation(testInfo, configuredTestInfo);

    expect(testInfo.annotations).toHaveLength(1);
    expect(testInfo.annotations[0].type).toBe('config');
    expect(testInfo.annotations[0].description).toContain('throttle=4x');
    expect(testInfo.annotations[0].description).toContain('warmup=enabled');
    expect(testInfo.annotations[0].description).toContain('fps=enabled');
    expect(testInfo.annotations[0].description).toContain('memory=enabled');
    expect(testInfo.annotations[0].description).toContain('network=slow-3g');
    expect(testInfo.annotations[0].description).toContain('iterations=3x');
    expect(testInfo.annotations[0].description).toContain('lighthouse=enabled');
  });

  it('should show disabled for disabled settings', () => {
    const testInfo = { annotations: [] } as unknown as TestInfo;
    const configuredTestInfo = {
      throttleRate: 1,
      warmup: false,
      buffers: {
        duration: 20,
        rerenders: 20,
        fps: 20,
        heapGrowth: 20,
        webVitals: { lcp: 20, inp: 20, cls: 20 },
        lighthouse: 5,
      },
      trackFps: false,
      trackMemory: false,
      trackWebVitals: false,
      iterations: 1,
      networkThrottling: undefined,
      exportTrace: { enabled: false },
      lighthouse: { enabled: false, formFactor: 'mobile', categories: [], skipAudits: [] },
    } as unknown as ConfiguredTestInfo;

    addConfigurationAnnotation(testInfo, configuredTestInfo);

    expect(testInfo.annotations[0].description).toContain('throttle=disabled');
    expect(testInfo.annotations[0].description).toContain('warmup=disabled');
    expect(testInfo.annotations[0].description).toContain('fps=disabled');
    expect(testInfo.annotations[0].description).toContain('network=disabled');
    expect(testInfo.annotations[0].description).toContain('iterations=single');
    expect(testInfo.annotations[0].description).toContain('lighthouse=disabled');
  });

  it('should show custom for custom network config', () => {
    const testInfo = { annotations: [] } as unknown as TestInfo;
    const configuredTestInfo = {
      throttleRate: 1,
      warmup: false,
      buffers: {
        duration: 20,
        rerenders: 20,
        fps: 20,
        heapGrowth: 20,
        webVitals: { lcp: 20, inp: 20, cls: 20 },
        lighthouse: 5,
      },
      trackFps: false,
      trackMemory: false,
      trackWebVitals: false,
      iterations: 1,
      networkThrottling: { downloadThroughput: 1000 },
      exportTrace: { enabled: false },
      lighthouse: { enabled: false, formFactor: 'mobile', categories: [], skipAudits: [] },
    } as unknown as ConfiguredTestInfo;

    addConfigurationAnnotation(testInfo, configuredTestInfo);

    expect(testInfo.annotations[0].description).toContain('network=custom');
  });
});
