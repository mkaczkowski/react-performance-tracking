import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LongTaskMetrics } from '@lib/playwright/longTasks/types';
import {
  captureLongTasks,
  hasLongTaskData,
  injectLongTaskObserver,
  isLongTasksInitialized,
  resetLongTasks,
} from '@lib/playwright/longTasks/longTaskTracking';

// Mock the logger
vi.mock('@lib/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock page
const createMockPage = () => ({
  addInitScript: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue(null),
});

describe('longTaskTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('injectLongTaskObserver', () => {
    it('should call addInitScript with a function', async () => {
      const mockPage = createMockPage();

      await injectLongTaskObserver(mockPage as never);

      expect(mockPage.addInitScript).toHaveBeenCalledTimes(1);
      expect(mockPage.addInitScript).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('isLongTasksInitialized', () => {
    it('should return true when store is initialized', async () => {
      const mockPage = createMockPage();
      mockPage.evaluate.mockResolvedValueOnce(true);

      const result = await isLongTasksInitialized(mockPage as never);

      expect(result).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should return false when store is not initialized', async () => {
      const mockPage = createMockPage();
      mockPage.evaluate.mockResolvedValueOnce(false);

      const result = await isLongTasksInitialized(mockPage as never);

      expect(result).toBe(false);
    });
  });

  describe('captureLongTasks', () => {
    it('should return null when store is not initialized', async () => {
      const mockPage = createMockPage();
      // First call: isLongTasksInitialized check
      mockPage.evaluate.mockResolvedValueOnce(false);
      // Second call: ensureLongTasksInitialized eval (setup)
      mockPage.evaluate.mockResolvedValueOnce(undefined);
      // Third call: captureLongTasks
      mockPage.evaluate.mockResolvedValueOnce(null);

      const result = await captureLongTasks(mockPage as never);

      expect(result).toBeNull();
    });

    it('should return metrics when store has data', async () => {
      const mockPage = createMockPage();
      const mockMetrics: LongTaskMetrics = {
        tbt: 100,
        maxDuration: 150,
        count: 2,
        entries: [
          { duration: 100, startTime: 0, containerType: 'window' },
          { duration: 150, startTime: 100, containerType: 'window' },
        ],
      };
      // First call: isLongTasksInitialized check
      mockPage.evaluate.mockResolvedValueOnce(true);
      // Second call: captureLongTasks
      mockPage.evaluate.mockResolvedValueOnce(mockMetrics);

      const result = await captureLongTasks(mockPage as never);

      expect(result).toEqual(mockMetrics);
    });

    it('should return empty metrics when no long tasks occurred', async () => {
      const mockPage = createMockPage();
      const emptyMetrics: LongTaskMetrics = {
        tbt: 0,
        maxDuration: 0,
        count: 0,
        entries: [],
      };
      mockPage.evaluate.mockResolvedValueOnce(true);
      mockPage.evaluate.mockResolvedValueOnce(emptyMetrics);

      const result = await captureLongTasks(mockPage as never);

      expect(result).toEqual(emptyMetrics);
      expect(result?.tbt).toBe(0);
      expect(result?.count).toBe(0);
    });

    it('should include attribution data in entries', async () => {
      const mockPage = createMockPage();
      const metricsWithAttribution: LongTaskMetrics = {
        tbt: 50,
        maxDuration: 100,
        count: 1,
        entries: [
          {
            duration: 100,
            startTime: 0,
            containerType: 'iframe',
            containerId: 'ad-frame',
            containerName: 'ad-container',
            containerSrc: 'https://ads.example.com',
          },
        ],
      };
      mockPage.evaluate.mockResolvedValueOnce(true);
      mockPage.evaluate.mockResolvedValueOnce(metricsWithAttribution);

      const result = await captureLongTasks(mockPage as never);

      expect(result?.entries[0].containerType).toBe('iframe');
      expect(result?.entries[0].containerId).toBe('ad-frame');
      expect(result?.entries[0].containerSrc).toBe('https://ads.example.com');
    });
  });

  describe('resetLongTasks', () => {
    it('should call page.evaluate to reset the store', async () => {
      const mockPage = createMockPage();

      await resetLongTasks(mockPage as never);

      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('hasLongTaskData', () => {
    it('should return true for non-null metrics', () => {
      const metrics: LongTaskMetrics = {
        tbt: 0,
        maxDuration: 0,
        count: 0,
        entries: [],
      };

      expect(hasLongTaskData(metrics)).toBe(true);
    });

    it('should return false for null metrics', () => {
      expect(hasLongTaskData(null)).toBe(false);
    });

    it('should work as type guard for non-null metrics with data', () => {
      const metrics: LongTaskMetrics | null = {
        tbt: 100,
        maxDuration: 150,
        count: 2,
        entries: [
          { duration: 100, startTime: 0, containerType: 'window' },
          { duration: 150, startTime: 100, containerType: 'window' },
        ],
      };

      if (hasLongTaskData(metrics)) {
        // TypeScript should know metrics is LongTaskMetrics here
        expect(metrics.tbt).toBe(100);
        expect(metrics.entries.length).toBe(2);
      }
    });
  });
});

describe('longTaskTracking TBT calculation', () => {
  it('should calculate TBT correctly (sum of blocking time above 50ms)', async () => {
    const mockPage = createMockPage();
    // Task 1: 80ms = 30ms blocking time (80 - 50)
    // Task 2: 120ms = 70ms blocking time (120 - 50)
    // Total TBT = 100ms
    const metrics: LongTaskMetrics = {
      tbt: 100,
      maxDuration: 120,
      count: 2,
      entries: [
        { duration: 80, startTime: 0, containerType: 'window' },
        { duration: 120, startTime: 100, containerType: 'window' },
      ],
    };
    mockPage.evaluate.mockResolvedValueOnce(true);
    mockPage.evaluate.mockResolvedValueOnce(metrics);

    const result = await captureLongTasks(mockPage as never);

    expect(result?.tbt).toBe(100);
  });

  it('should track maxDuration correctly', async () => {
    const mockPage = createMockPage();
    const metrics: LongTaskMetrics = {
      tbt: 250,
      maxDuration: 200,
      count: 3,
      entries: [
        { duration: 100, startTime: 0, containerType: 'window' },
        { duration: 200, startTime: 100, containerType: 'window' },
        { duration: 150, startTime: 300, containerType: 'window' },
      ],
    };
    mockPage.evaluate.mockResolvedValueOnce(true);
    mockPage.evaluate.mockResolvedValueOnce(metrics);

    const result = await captureLongTasks(mockPage as never);

    expect(result?.maxDuration).toBe(200);
  });
});

describe('longTaskTracking container types', () => {
  it('should handle all container types', async () => {
    const mockPage = createMockPage();
    const metrics: LongTaskMetrics = {
      tbt: 200,
      maxDuration: 100,
      count: 4,
      entries: [
        { duration: 100, startTime: 0, containerType: 'window' },
        { duration: 100, startTime: 100, containerType: 'iframe' },
        { duration: 100, startTime: 200, containerType: 'embed' },
        { duration: 100, startTime: 300, containerType: 'object' },
      ],
    };
    mockPage.evaluate.mockResolvedValueOnce(true);
    mockPage.evaluate.mockResolvedValueOnce(metrics);

    const result = await captureLongTasks(mockPage as never);

    expect(result?.entries).toHaveLength(4);
    expect(result?.entries[0].containerType).toBe('window');
    expect(result?.entries[1].containerType).toBe('iframe');
    expect(result?.entries[2].containerType).toBe('embed');
    expect(result?.entries[3].containerType).toBe('object');
  });
});
