import { describe, expect, it } from 'vitest';

import {
  resolveTrackFps,
  resolveTrackMemory,
  resolveTrackWebVitals,
} from '@lib/playwright/config/configResolver';
import type { TestConfig } from '@lib/playwright/types';

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
