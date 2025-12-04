import { describe, expect, it } from 'vitest';

import {
  formatNetworkConditions,
  isNetworkPreset,
  NETWORK_PRESETS,
  type NetworkConditions,
  type NetworkPreset,
  type ResolvedNetworkConditions,
  resolveNetworkConditions,
} from '@/playwright/features/networkThrottling';

describe('networkThrottling', () => {
  const ALL_PRESETS: NetworkPreset[] = ['slow-3g', 'fast-3g', 'slow-4g', 'fast-4g', 'offline'];

  describe('isNetworkPreset', () => {
    it.each(ALL_PRESETS)('should return true for "%s" preset', (preset) => {
      expect(isNetworkPreset(preset)).toBe(true);
    });

    it.each(['invalid', '3g', 'fast', 'slow', ''])(
      'should return false for invalid preset "%s"',
      (invalid) => {
        expect(isNetworkPreset(invalid as NetworkPreset)).toBe(false);
      },
    );

    it('should return false for custom conditions object', () => {
      const customConditions: NetworkConditions = {
        latency: 100,
        downloadThroughput: 1000,
        uploadThroughput: 500,
      };
      expect(isNetworkPreset(customConditions)).toBe(false);
    });
  });

  describe('resolveNetworkConditions', () => {
    it.each(ALL_PRESETS)('should resolve "%s" preset with correct source', (preset) => {
      const result = resolveNetworkConditions(preset);

      expect(result.source).toBe(preset);
      expect(result.latency).toBe(NETWORK_PRESETS[preset].latency);
      expect(result.downloadThroughput).toBe(NETWORK_PRESETS[preset].downloadThroughput);
      expect(result.uploadThroughput).toBe(NETWORK_PRESETS[preset].uploadThroughput);
      expect(result.offline).toBe(NETWORK_PRESETS[preset].offline ?? false);
    });

    it('should resolve custom conditions and default offline to false', () => {
      const customConditions: NetworkConditions = {
        latency: 50,
        downloadThroughput: 2000,
        uploadThroughput: 1000,
      };

      const result = resolveNetworkConditions(customConditions);

      expect(result).toEqual({
        latency: 50,
        downloadThroughput: 2000,
        uploadThroughput: 1000,
        offline: false,
        source: customConditions,
      });
    });

    it('should preserve custom offline: true', () => {
      const customConditions: NetworkConditions = {
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
        offline: true,
      };

      const result = resolveNetworkConditions(customConditions);
      expect(result.offline).toBe(true);
    });
  });

  describe('formatNetworkConditions', () => {
    it('should format offline condition as "offline"', () => {
      const conditions: ResolvedNetworkConditions = {
        ...NETWORK_PRESETS['offline'],
        offline: true,
        source: 'offline',
      };

      expect(formatNetworkConditions(conditions)).toBe('offline');
    });

    it.each([
      ['slow-3g', 400, '500 Kbps'],
      ['fast-3g', 150, '1.6 Mbps'],
      ['slow-4g', 100, '3.0 Mbps'],
      ['fast-4g', 20, '10.0 Mbps'],
    ] as const)(
      'should format %s preset with %dms latency and ~%s download',
      (preset, expectedLatency, expectedSpeed) => {
        const conditions = resolveNetworkConditions(preset);
        const result = formatNetworkConditions(conditions);

        expect(result).toContain(`${preset}:`);
        expect(result).toContain(`${expectedLatency}ms latency`);
        expect(result).toContain(expectedSpeed);
      },
    );

    it('should format custom conditions without preset prefix', () => {
      const customConditions: NetworkConditions = {
        latency: 100,
        downloadThroughput: 1000,
        uploadThroughput: 500,
      };

      const conditions: ResolvedNetworkConditions = {
        ...customConditions,
        offline: false,
        source: customConditions,
      };

      const result = formatNetworkConditions(conditions);

      expect(result).not.toContain(':');
      expect(result).toContain('100ms latency');
    });
  });

  describe('NETWORK_PRESETS', () => {
    it('should have all expected presets', () => {
      expect(Object.keys(NETWORK_PRESETS)).toEqual(ALL_PRESETS);
    });

    it.each([
      ['slow-3g', 'fast-3g'],
      ['fast-3g', 'slow-4g'],
      ['slow-4g', 'fast-4g'],
    ] as const)('should have faster speed for %s -> %s', (slower, faster) => {
      expect(NETWORK_PRESETS[faster].downloadThroughput).toBeGreaterThan(
        NETWORK_PRESETS[slower].downloadThroughput,
      );
      expect(NETWORK_PRESETS[faster].latency).toBeLessThan(NETWORK_PRESETS[slower].latency);
    });
  });
});
