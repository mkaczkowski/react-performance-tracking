import type { CDPSession, Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockCDPSession } from '../../../mocks/playwrightMocks';

describe('cpuThrottling', () => {
  // Shared mocks - recreated fresh in beforeEach
  let cdpSession: CDPSession;
  let newCDPSessionMock: ReturnType<typeof vi.fn>;

  const createTestPage = (): Page =>
    ({
      context: vi.fn().mockReturnValue({
        newCDPSession: newCDPSessionMock,
      }),
    }) as unknown as Page;

  beforeEach(() => {
    vi.resetModules();

    // Create fresh CDP session mock using factory
    cdpSession = createMockCDPSession();
    newCDPSessionMock = vi.fn().mockResolvedValue(cdpSession);
  });

  // Dynamically import after mocks are set up
  const importModule = async () => {
    return import('@/playwright/features/cpuThrottling');
  };

  describe('cpuThrottlingFeature.start', () => {
    it('should return null when rate is 1 (no throttling)', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 1 });

      expect(handle).toBeNull();
      expect(newCDPSessionMock).not.toHaveBeenCalled();
    });

    it('should return null when rate is less than 1', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 0.5 });

      expect(handle).toBeNull();
      expect(newCDPSessionMock).not.toHaveBeenCalled();
    });

    it('should create CDP session and set throttle rate when rate > 1', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).not.toBeNull();
      expect(newCDPSessionMock).toHaveBeenCalledWith(mockPage);
      expect(cdpSession.send).toHaveBeenCalledWith('Emulation.setCPUThrottlingRate', { rate: 4 });
    });

    it('should return handle with correct rate via getRate()', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 6 });

      expect(handle).not.toBeNull();
      expect(handle!.getRate()).toBe(6);
    });

    it('should return null when CDP session creation fails with unsupported error', async () => {
      newCDPSessionMock.mockRejectedValueOnce(new Error('CDP not available'));

      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).toBeNull();
    });
  });

  describe('CPUThrottlingHandle.reapply', () => {
    it('should re-send throttle rate to CDP session', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).not.toBeNull();

      // Clear mock calls from start
      vi.mocked(cdpSession.send).mockClear();

      const success = await handle!.reapply();

      expect(success).toBe(true);
      expect(cdpSession.send).toHaveBeenCalledWith('Emulation.setCPUThrottlingRate', { rate: 4 });
    });

    it('should return false when handle is inactive (after stop)', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).not.toBeNull();

      // Stop the handle to make it inactive
      await handle!.stop();

      vi.mocked(cdpSession.send).mockClear();
      const success = await handle!.reapply();

      expect(success).toBe(false);
      // Should not have called send for reapply
      expect(cdpSession.send).not.toHaveBeenCalledWith('Emulation.setCPUThrottlingRate', {
        rate: 4,
      });
    });

    it('should return false when CDP send fails', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).not.toBeNull();

      // Make the next send call fail
      vi.mocked(cdpSession.send).mockRejectedValueOnce(new Error('CDP error'));

      const success = await handle!.reapply();

      expect(success).toBe(false);
    });
  });

  describe('CPUThrottlingHandle.stop', () => {
    it('should reset throttling rate to 1 and detach session', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).not.toBeNull();

      vi.mocked(cdpSession.send).mockClear();
      await handle!.stop();

      // Should reset to rate 1
      expect(cdpSession.send).toHaveBeenCalledWith('Emulation.setCPUThrottlingRate', { rate: 1 });
      // Should detach session
      expect(cdpSession.detach).toHaveBeenCalled();
    });

    it('should mark handle as inactive after stop', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      expect(handle).not.toBeNull();
      expect(handle!.isActive()).toBe(true);

      await handle!.stop();

      expect(handle!.isActive()).toBe(false);
    });

    it('should return null when called on already stopped handle', async () => {
      const { cpuThrottlingFeature } = await importModule();
      const mockPage = createTestPage();
      const handle = await cpuThrottlingFeature.start(mockPage, { rate: 4 });

      await handle!.stop();
      vi.mocked(cdpSession.send).mockClear();
      vi.mocked(cdpSession.detach).mockClear();

      const result = await handle!.stop();

      expect(result).toBeNull();
      // Should not try to reset or detach again
      expect(cdpSession.send).not.toHaveBeenCalled();
      expect(cdpSession.detach).not.toHaveBeenCalled();
    });
  });
});
