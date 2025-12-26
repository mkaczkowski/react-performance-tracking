import type { TestInfo } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredTestInfo,
  formatThrottling,
  mapToLighthouseThrottling,
  resolveBuffers,
  resolveConfig,
  resolveThresholds,
} from '@lib/lighthouse/lighthouseConfig';
import type { LighthouseTestConfig, LighthouseThresholds } from '@lib/lighthouse/types';

// Mock PERFORMANCE_CONFIG.isCI
vi.mock('@lib/playwright/config/performanceConfig', () => ({
  PERFORMANCE_CONFIG: {
    get isCI(): boolean {
      return false;
    },
  },
}));

describe('resolveThresholds', () => {
  describe('shorthand format', () => {
    it('should resolve shorthand thresholds with defaults', () => {
      const thresholds: LighthouseThresholds = {
        performance: 90,
        accessibility: 95,
      };

      const result = resolveThresholds(thresholds);

      expect(result.performance).toBe(90);
      expect(result.accessibility).toBe(95);
      expect(result.bestPractices).toBe(0);
      expect(result.seo).toBe(0);
      expect(result.pwa).toBe(0);
    });

    it('should handle all categories specified', () => {
      const thresholds: LighthouseThresholds = {
        performance: 90,
        accessibility: 95,
        bestPractices: 85,
        seo: 80,
        pwa: 70,
      };

      const result = resolveThresholds(thresholds);

      expect(result.performance).toBe(90);
      expect(result.accessibility).toBe(95);
      expect(result.bestPractices).toBe(85);
      expect(result.seo).toBe(80);
      expect(result.pwa).toBe(70);
    });

    it('should handle empty thresholds', () => {
      const result = resolveThresholds({});

      expect(result.performance).toBe(0);
      expect(result.accessibility).toBe(0);
      expect(result.bestPractices).toBe(0);
      expect(result.seo).toBe(0);
      expect(result.pwa).toBe(0);
    });
  });

  describe('base/ci format', () => {
    it('should use base thresholds in non-CI environment', () => {
      const result = resolveThresholds({
        base: { performance: 90, accessibility: 95 },
        ci: { performance: 80 },
      });

      expect(result.performance).toBe(90);
      expect(result.accessibility).toBe(95);
    });

    // NOTE: Testing CI environment merge is better done in integration tests
    // because mocking the module-level import is complex with ESM
    it('should handle ci config even when not in CI', () => {
      // Just verifying the structure is parsed correctly
      const result = resolveThresholds({
        base: { performance: 90, accessibility: 95 },
        ci: { performance: 80 },
      });

      // In non-CI (mocked), should use base values
      expect(result.performance).toBe(90);
      expect(result.accessibility).toBe(95);
    });
  });
});

describe('resolveBuffers', () => {
  it('should use default buffers when none provided', () => {
    const result = resolveBuffers();

    expect(result.performance).toBe(5);
    expect(result.accessibility).toBe(5);
    expect(result.bestPractices).toBe(5);
    expect(result.seo).toBe(5);
    expect(result.pwa).toBe(5);
  });

  it('should override specific buffers', () => {
    const result = resolveBuffers({
      performance: 10,
      accessibility: 3,
    });

    expect(result.performance).toBe(10);
    expect(result.accessibility).toBe(3);
    expect(result.bestPractices).toBe(5);
    expect(result.seo).toBe(5);
    expect(result.pwa).toBe(5);
  });

  it('should allow zero buffer', () => {
    const result = resolveBuffers({
      performance: 0,
    });

    expect(result.performance).toBe(0);
  });
});

describe('resolveConfig', () => {
  it('should resolve minimal config with defaults', () => {
    const config: LighthouseTestConfig = {
      thresholds: { performance: 90 },
    };

    const result = resolveConfig(config, 'my test');

    expect(result.throttling.cpu).toBe(4);
    expect(result.throttling.network).toBe('fast-4g');
    expect(result.thresholds.performance).toBe(90);
    expect(result.buffers.performance).toBe(5);
    expect(result.categories).toEqual(['performance', 'accessibility', 'best-practices', 'seo']);
    expect(result.formFactor).toBe('mobile');
    expect(result.warmup).toBe(false);
    expect(result.name).toBe('lighthouse-my-test');
    expect(result.skipAudits).toEqual([]);
  });

  it('should use custom throttling settings', () => {
    const config: LighthouseTestConfig = {
      throttling: { cpu: 6, network: 'slow-3g' },
      thresholds: { performance: 80 },
    };

    const result = resolveConfig(config, 'test');

    expect(result.throttling.cpu).toBe(6);
    expect(result.throttling.network).toBe('slow-3g');
  });

  it('should handle custom network conditions', () => {
    const config: LighthouseTestConfig = {
      throttling: {
        network: { latencyMs: 200, downloadKbps: 1000, uploadKbps: 500 },
      },
      thresholds: { performance: 80 },
    };

    const result = resolveConfig(config, 'test');

    expect(result.throttling.network).toEqual({
      latencyMs: 200,
      downloadKbps: 1000,
      uploadKbps: 500,
    });
  });

  it('should handle all categories', () => {
    const config: LighthouseTestConfig = {
      thresholds: { performance: 90 },
      categories: ['performance', 'accessibility', 'pwa'],
    };

    const result = resolveConfig(config, 'test');

    expect(result.categories).toEqual(['performance', 'accessibility', 'pwa']);
  });

  it('should handle desktop form factor', () => {
    const config: LighthouseTestConfig = {
      thresholds: { performance: 90 },
      formFactor: 'desktop',
    };

    const result = resolveConfig(config, 'test');

    expect(result.formFactor).toBe('desktop');
  });

  it('should handle skip audits', () => {
    const config: LighthouseTestConfig = {
      thresholds: { performance: 90 },
      skipAudits: ['robots-txt', 'canonical'],
    };

    const result = resolveConfig(config, 'test');

    expect(result.skipAudits).toEqual(['robots-txt', 'canonical']);
  });

  it('should generate artifact name from title', () => {
    const config: LighthouseTestConfig = {
      thresholds: { performance: 90 },
    };

    const result = resolveConfig(config, 'My Homepage Test');

    expect(result.name).toBe('lighthouse-my-homepage-test');
  });

  it('should use custom name if provided', () => {
    const config: LighthouseTestConfig = {
      thresholds: { performance: 90 },
      name: 'custom-audit-name',
    };

    const result = resolveConfig(config, 'test');

    expect(result.name).toBe('custom-audit-name');
  });
});

describe('mapToLighthouseThrottling', () => {
  it('should map network preset to Lighthouse settings', () => {
    const result = mapToLighthouseThrottling(4, 'fast-3g');

    expect(result.cpuSlowdownMultiplier).toBe(4);
    expect(result.requestLatencyMs).toBe(150);
    expect(result.rttMs).toBe(150);
    // NETWORK_PRESETS['fast-3g'].downloadThroughput = (1.6 * 1024 * 1024) / 8 bytes/s = 209715.2 bytes/s
    // Convert to Kbps: (bytes/s * 8) / 1024 = 1638.4 Kbps
    expect(result.downloadThroughputKbps).toBe(1638.4);
  });

  it('should handle slow-3g preset', () => {
    const result = mapToLighthouseThrottling(6, 'slow-3g');

    expect(result.cpuSlowdownMultiplier).toBe(6);
    expect(result.requestLatencyMs).toBe(400);
    expect(result.downloadThroughputKbps).toBe(500);
  });

  it('should handle custom network conditions', () => {
    const result = mapToLighthouseThrottling(4, {
      latencyMs: 100,
      downloadKbps: 2000,
      uploadKbps: 1000,
    });

    expect(result.cpuSlowdownMultiplier).toBe(4);
    expect(result.requestLatencyMs).toBe(100);
    expect(result.downloadThroughputKbps).toBe(2000);
    expect(result.uploadThroughputKbps).toBe(1000);
    expect(result.rttMs).toBe(100);
  });
});

describe('formatThrottling', () => {
  it('should format preset network', () => {
    const result = formatThrottling(4, 'fast-3g');
    expect(result).toBe('CPU 4x, Network: fast-3g');
  });

  it('should format custom network conditions', () => {
    const result = formatThrottling(6, {
      latencyMs: 100,
      downloadKbps: 2000,
      uploadKbps: 1000,
    });
    expect(result).toBe('CPU 6x, Network: 2000Kbps');
  });
});

describe('createConfiguredTestInfo', () => {
  it('should create configured test info with resolved config', () => {
    const mockTestInfo = {
      title: 'test title',
      annotations: [],
    } as unknown as TestInfo;

    const config: LighthouseTestConfig = {
      thresholds: { performance: 90, accessibility: 95 },
    };

    const result = createConfiguredTestInfo(mockTestInfo, config, 'my test');

    expect(result.title).toBe('test title');
    expect(result.thresholds.performance).toBe(90);
    expect(result.thresholds.accessibility).toBe(95);
    expect(result.throttling.cpu).toBe(4);
    expect(result.name).toBe('lighthouse-my-test');
  });
});
