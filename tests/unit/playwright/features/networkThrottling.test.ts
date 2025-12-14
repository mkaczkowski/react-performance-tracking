import { describe, expect, it, vi } from 'vitest';

import {
  formatNetworkConditions,
  isNetworkPreset,
  NETWORK_PRESETS,
  type NetworkConditions,
  type NetworkPreset,
  networkThrottlingFeature,
  type ResolvedNetworkConditions,
  resolveNetworkConditions,
} from '@/playwright/features/networkThrottling';
import { createMockCDPSession, createMockPage } from '../../../mocks/playwrightMocks';

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

  describe('formatNetworkConditions throughput formatting', () => {
    it('should format unlimited throughput (-1)', () => {
      const conditions: ResolvedNetworkConditions = {
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        offline: false,
        source: { latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
      };

      const result = formatNetworkConditions(conditions);

      expect(result).toContain('down=unlimited');
      expect(result).toContain('up=unlimited');
    });

    it('should format low throughput in Kbps', () => {
      // 64000 bytes/s = 512 Kbps
      const conditions: ResolvedNetworkConditions = {
        latency: 100,
        downloadThroughput: 64000,
        uploadThroughput: 32000,
        offline: false,
        source: { latency: 100, downloadThroughput: 64000, uploadThroughput: 32000 },
      };

      const result = formatNetworkConditions(conditions);

      expect(result).toContain('down=500 Kbps');
      expect(result).toContain('up=250 Kbps');
    });

    it('should format high throughput in Mbps', () => {
      // 1310720 bytes/s = 10 Mbps
      const conditions: ResolvedNetworkConditions = {
        latency: 10,
        downloadThroughput: 1310720,
        uploadThroughput: 655360,
        offline: false,
        source: { latency: 10, downloadThroughput: 1310720, uploadThroughput: 655360 },
      };

      const result = formatNetworkConditions(conditions);

      expect(result).toContain('Mbps');
    });
  });

  describe('networkThrottlingFeature', () => {
    describe('start', () => {
      it('should return handle when CDP session is available', async () => {
        const mockCDPSession = createMockCDPSession();
        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await networkThrottlingFeature.start(mockPage, 'slow-3g');

        expect(handle).not.toBeNull();
        expect(handle?.stop).toBeDefined();
        expect(handle?.getConditions).toBeDefined();
      });

      it('should call Network.emulateNetworkConditions with preset values', async () => {
        const mockCDPSession = createMockCDPSession();
        const mockPage = createMockPage(null, mockCDPSession);

        await networkThrottlingFeature.start(mockPage, 'slow-3g');

        expect(mockCDPSession.send).toHaveBeenCalledWith('Network.emulateNetworkConditions', {
          offline: false,
          latency: NETWORK_PRESETS['slow-3g'].latency,
          downloadThroughput: NETWORK_PRESETS['slow-3g'].downloadThroughput,
          uploadThroughput: NETWORK_PRESETS['slow-3g'].uploadThroughput,
        });
      });

      it('should call Network.emulateNetworkConditions with custom values', async () => {
        const mockCDPSession = createMockCDPSession();
        const mockPage = createMockPage(null, mockCDPSession);
        const customConfig: NetworkConditions = {
          latency: 200,
          downloadThroughput: 50000,
          uploadThroughput: 25000,
        };

        await networkThrottlingFeature.start(mockPage, customConfig);

        expect(mockCDPSession.send).toHaveBeenCalledWith('Network.emulateNetworkConditions', {
          offline: false,
          latency: 200,
          downloadThroughput: 50000,
          uploadThroughput: 25000,
        });
      });

      it('should return null when CDP is not available', async () => {
        const mockCDPSession = createMockCDPSession();
        // isCdpUnsupportedError checks for specific patterns in the message
        const cdpError = new Error('CDP session not available');
        vi.mocked(mockCDPSession.send).mockRejectedValue(cdpError);

        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await networkThrottlingFeature.start(mockPage, 'slow-3g');

        expect(handle).toBeNull();
      });

      it('should rethrow unexpected errors', async () => {
        const mockCDPSession = createMockCDPSession();
        vi.mocked(mockCDPSession.send).mockRejectedValue(new Error('Unexpected error'));

        const mockPage = createMockPage(null, mockCDPSession);

        await expect(networkThrottlingFeature.start(mockPage, 'slow-3g')).rejects.toThrow(
          'Unexpected error',
        );
      });

      it('getConditions should return resolved network conditions', async () => {
        const mockCDPSession = createMockCDPSession();
        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await networkThrottlingFeature.start(mockPage, 'fast-4g');
        const conditions = handle?.getConditions();

        expect(conditions?.latency).toBe(NETWORK_PRESETS['fast-4g'].latency);
        expect(conditions?.downloadThroughput).toBe(NETWORK_PRESETS['fast-4g'].downloadThroughput);
        expect(conditions?.source).toBe('fast-4g');
      });
    });
  });
});
