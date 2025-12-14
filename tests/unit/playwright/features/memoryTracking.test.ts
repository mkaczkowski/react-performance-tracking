import { describe, expect, it, vi } from 'vitest';

import {
  calculateMemoryGrowth,
  captureMemorySnapshot,
  type CDPMetric,
  extractMemoryMetrics,
  type MemorySnapshot,
  memoryTrackingFeature,
} from '@/playwright/features/memoryTracking';
import { createMockCDPSession, createMockPage } from '../../../mocks/playwrightMocks';

describe('memoryTracking', () => {
  describe('extractMemoryMetrics', () => {
    it('should extract JSHeapUsedSize and JSHeapTotalSize', () => {
      const metrics: CDPMetric[] = [
        { name: 'JSHeapUsedSize', value: 10_000_000 },
        { name: 'JSHeapTotalSize', value: 20_000_000 },
        { name: 'SomeOtherMetric', value: 123 },
      ];

      const result = extractMemoryMetrics(metrics);

      expect(result.jsHeapUsedSize).toBe(10_000_000);
      expect(result.jsHeapTotalSize).toBe(20_000_000);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it.each([
      ['missing metrics', [{ name: 'SomeOtherMetric', value: 123 }]],
      ['empty array', []],
    ])('should return zeros for %s', (_, metrics) => {
      const result = extractMemoryMetrics(metrics as CDPMetric[]);

      expect(result.jsHeapUsedSize).toBe(0);
      expect(result.jsHeapTotalSize).toBe(0);
    });

    it('should handle partial metrics (only JSHeapUsedSize)', () => {
      const metrics: CDPMetric[] = [{ name: 'JSHeapUsedSize', value: 5_000_000 }];

      const result = extractMemoryMetrics(metrics);

      expect(result.jsHeapUsedSize).toBe(5_000_000);
      expect(result.jsHeapTotalSize).toBe(0);
    });
  });

  describe('calculateMemoryGrowth', () => {
    const createSnapshot = (jsHeapUsedSize: number): MemorySnapshot => ({
      jsHeapUsedSize,
      jsHeapTotalSize: jsHeapUsedSize * 2,
      timestamp: Date.now(),
    });

    it.each([
      // [description, beforeMB, afterMB, expectedGrowthMB, expectedPercent]
      ['positive growth (50%)', 10, 15, 5, 50],
      ['negative growth (-25%)', 20, 15, -5, -25],
      ['zero growth', 10, 10, 0, 0],
      ['large values (GB scale)', 1000, 1500, 500, 50],
    ])(
      'should calculate %s correctly',
      (_, beforeMB, afterMB, expectedGrowthMB, expectedPercent) => {
        const MB = 1_000_000;
        const before = createSnapshot(beforeMB * MB);
        const after = createSnapshot(afterMB * MB);

        const result = calculateMemoryGrowth(before, after);

        expect(result.heapGrowth).toBe(expectedGrowthMB * MB);
        expect(result.heapGrowthPercent).toBe(expectedPercent);
      },
    );

    it('should handle zero initial heap (avoid division by zero)', () => {
      const before = createSnapshot(0);
      const after = createSnapshot(5_000_000);

      const result = calculateMemoryGrowth(before, after);

      expect(result.heapGrowth).toBe(5_000_000);
      expect(result.heapGrowthPercent).toBe(0);
    });

    it('should round heapGrowthPercent to 2 decimal places', () => {
      const before = createSnapshot(3_000_000); // 3 MB
      const after = createSnapshot(4_000_000); // 4 MB

      const result = calculateMemoryGrowth(before, after);

      // 1MB / 3MB = 33.333...%
      expect(result.heapGrowthPercent).toBe(33.33);
    });

    it('should preserve snapshot references', () => {
      const before = createSnapshot(10_000_000);
      const after = createSnapshot(15_000_000);

      const result = calculateMemoryGrowth(before, after);

      expect(result.before).toBe(before);
      expect(result.after).toBe(after);
    });
  });

  describe('captureMemorySnapshot', () => {
    it('should call Performance.getMetrics and extract metrics', async () => {
      const mockCDPSession = createMockCDPSession();
      vi.mocked(mockCDPSession.send).mockResolvedValueOnce({
        metrics: [
          { name: 'JSHeapUsedSize', value: 10_000_000 },
          { name: 'JSHeapTotalSize', value: 20_000_000 },
        ],
      });

      const result = await captureMemorySnapshot(mockCDPSession);

      expect(mockCDPSession.send).toHaveBeenCalledWith('Performance.getMetrics');
      expect(result.jsHeapUsedSize).toBe(10_000_000);
      expect(result.jsHeapTotalSize).toBe(20_000_000);
    });
  });

  describe('memoryTrackingFeature', () => {
    describe('start', () => {
      it('should return handle when CDP session is available', async () => {
        const mockCDPSession = createMockCDPSession();
        vi.mocked(mockCDPSession.send).mockImplementation(async (method: string) => {
          if (method === 'Performance.getMetrics') {
            return {
              metrics: [
                { name: 'JSHeapUsedSize', value: 10_000_000 },
                { name: 'JSHeapTotalSize', value: 20_000_000 },
              ],
            };
          }
          return {};
        });
        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await memoryTrackingFeature.start(mockPage);

        expect(handle).not.toBeNull();
        expect(handle?.stop).toBeDefined();
        expect(handle?.reset).toBeDefined();
        expect(handle?.getInitialSnapshot).toBeDefined();
      });

      it('should call Performance.enable on start', async () => {
        const mockCDPSession = createMockCDPSession();
        vi.mocked(mockCDPSession.send).mockImplementation(async (method: string) => {
          if (method === 'Performance.getMetrics') {
            return { metrics: [] };
          }
          return {};
        });
        const mockPage = createMockPage(null, mockCDPSession);

        await memoryTrackingFeature.start(mockPage);

        expect(mockCDPSession.send).toHaveBeenCalledWith('Performance.enable');
      });

      it('should return null when CDP is not available', async () => {
        const mockCDPSession = createMockCDPSession();
        // isCdpUnsupportedError checks for specific patterns in the message
        const cdpError = new Error('CDP session not available');
        vi.mocked(mockCDPSession.send).mockRejectedValue(cdpError);

        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await memoryTrackingFeature.start(mockPage);

        expect(handle).toBeNull();
      });

      it('should return null on unexpected error', async () => {
        const mockCDPSession = createMockCDPSession();
        vi.mocked(mockCDPSession.send).mockRejectedValue(new Error('Unexpected error'));

        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await memoryTrackingFeature.start(mockPage);

        expect(handle).toBeNull();
      });

      it('getInitialSnapshot should return the initial memory snapshot', async () => {
        const mockCDPSession = createMockCDPSession();
        vi.mocked(mockCDPSession.send).mockImplementation(async (method: string) => {
          if (method === 'Performance.getMetrics') {
            return {
              metrics: [
                { name: 'JSHeapUsedSize', value: 15_000_000 },
                { name: 'JSHeapTotalSize', value: 30_000_000 },
              ],
            };
          }
          return {};
        });
        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await memoryTrackingFeature.start(mockPage);
        const initialSnapshot = handle?.getInitialSnapshot();

        expect(initialSnapshot?.jsHeapUsedSize).toBe(15_000_000);
        expect(initialSnapshot?.jsHeapTotalSize).toBe(30_000_000);
      });
    });
  });
});
