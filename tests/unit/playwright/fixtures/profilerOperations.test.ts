import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetProfiler,
  waitForInitialization,
  waitUntilStable,
} from '@lib/playwright/fixtures/profilerOperations';
import { ProfilerStateError } from '@lib/playwright/profiler/profilerStateError';

import { createMockPage } from '../../../mocks/playwrightMocks';

describe('profilerOperations', () => {
  let mockPage: Page;

  beforeEach(() => {
    mockPage = createMockPage();
  });

  describe('waitForInitialization', () => {
    it('should resolve when store is available', async () => {
      vi.mocked(mockPage.waitForFunction).mockResolvedValueOnce(undefined as never);

      await expect(waitForInitialization(mockPage)).resolves.toBeUndefined();
      expect(mockPage.waitForFunction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: expect.any(Number),
      });
    });

    it('should throw ProfilerStateError on timeout', async () => {
      vi.mocked(mockPage.waitForFunction).mockRejectedValue(new Error('Timeout'));

      await expect(waitForInitialization(mockPage)).rejects.toThrow(ProfilerStateError);
    });

    it('should include helpful message when not initialized', async () => {
      vi.mocked(mockPage.waitForFunction).mockRejectedValue(new Error('Timeout'));

      await expect(waitForInitialization(mockPage)).rejects.toThrow('not initialized');
    });

    it('should use custom timeout when provided', async () => {
      vi.mocked(mockPage.waitForFunction).mockResolvedValueOnce(undefined as never);

      await waitForInitialization(mockPage, 5000);

      expect(mockPage.waitForFunction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 5000,
      });
    });
  });

  describe('waitUntilStable', () => {
    it('should resolve when store stabilizes', async () => {
      vi.mocked(mockPage.waitForFunction).mockResolvedValueOnce(undefined as never);
      vi.mocked(mockPage.evaluate).mockResolvedValueOnce(undefined);

      await expect(waitUntilStable(mockPage)).resolves.toBeUndefined();
      expect(mockPage.waitForFunction).toHaveBeenCalled();
    });

    it('should throw ProfilerStateError on timeout', async () => {
      vi.mocked(mockPage.waitForFunction).mockRejectedValue(new Error('Timeout'));

      await expect(waitUntilStable(mockPage)).rejects.toThrow(ProfilerStateError);
    });

    it('should include helpful message when not stabilized', async () => {
      vi.mocked(mockPage.waitForFunction).mockRejectedValue(new Error('Timeout'));

      await expect(waitUntilStable(mockPage)).rejects.toThrow('did not stabilize');
    });

    it('should use custom options when provided', async () => {
      vi.mocked(mockPage.waitForFunction).mockResolvedValueOnce(undefined as never);
      vi.mocked(mockPage.evaluate).mockResolvedValueOnce(undefined);

      await waitUntilStable(mockPage, {
        stabilityPeriodMs: 500,
        checkIntervalMs: 50,
        maxWaitMs: 3000,
      });

      expect(mockPage.waitForFunction).toHaveBeenCalledWith(
        expect.any(Function),
        { stabilityPeriod: 500 },
        { timeout: 3000, polling: 50 },
      );
    });

    it('should cleanup tracker even on error', async () => {
      vi.mocked(mockPage.waitForFunction).mockRejectedValueOnce(new Error('Timeout'));
      vi.mocked(mockPage.evaluate).mockResolvedValueOnce(undefined);

      await expect(waitUntilStable(mockPage)).rejects.toThrow();

      // Cleanup should still be called (in finally block)
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should ignore cleanup errors silently', async () => {
      vi.mocked(mockPage.waitForFunction).mockResolvedValueOnce(undefined as never);
      vi.mocked(mockPage.evaluate).mockRejectedValueOnce(new Error('Page closed'));

      // Should not throw despite cleanup error
      await expect(waitUntilStable(mockPage)).resolves.toBeUndefined();
    });
  });

  describe('resetProfiler', () => {
    it('should resolve when store resets successfully', async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValueOnce(true);

      await expect(resetProfiler(mockPage)).resolves.toBeUndefined();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should throw ProfilerStateError when store not available', async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValue(false);

      await expect(resetProfiler(mockPage)).rejects.toThrow(ProfilerStateError);
    });

    it('should include helpful message when store not available', async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValue(false);

      await expect(resetProfiler(mockPage)).rejects.toThrow('store not available');
    });
  });
});
