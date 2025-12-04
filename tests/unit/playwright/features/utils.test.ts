import type { CDPSession, Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCDPSession,
  createFeatureHandle,
  createResettableFeatureHandle,
  detachCDPSession,
  isCdpUnsupportedError,
  safeCDPSend,
  withCDPSession,
} from '@lib/playwright/features/utils';
import type { CDPFeatureState } from '@lib/playwright/features/types';

describe('features/utils', () => {
  describe('isCdpUnsupportedError', () => {
    it('should return true for CDP not available errors', () => {
      expect(isCdpUnsupportedError(new Error('CDP not available'))).toBe(true);
      expect(isCdpUnsupportedError(new Error('Protocol error'))).toBe(true);
      expect(isCdpUnsupportedError(new Error('Target.setAutoAttach'))).toBe(true);
      expect(isCdpUnsupportedError(new Error('does not support CDP'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isCdpUnsupportedError(new Error('Random error'))).toBe(false);
      expect(isCdpUnsupportedError(new Error('Something else'))).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isCdpUnsupportedError('string error')).toBe(false);
      expect(isCdpUnsupportedError(null)).toBe(false);
      expect(isCdpUnsupportedError(undefined)).toBe(false);
      expect(isCdpUnsupportedError({})).toBe(false);
    });
  });

  describe('detachCDPSession', () => {
    it('should call detach on session', async () => {
      const mockSession = {
        detach: vi.fn().mockResolvedValue(undefined),
      } as unknown as CDPSession;

      await detachCDPSession(mockSession);

      expect(mockSession.detach).toHaveBeenCalled();
    });

    it('should silently ignore errors', async () => {
      const mockSession = {
        detach: vi.fn().mockRejectedValue(new Error('Already detached')),
      } as unknown as CDPSession;

      // Should not throw
      await expect(detachCDPSession(mockSession)).resolves.toBeUndefined();
    });
  });

  describe('createCDPSession', () => {
    it('should create CDP session successfully', async () => {
      const mockSession = { send: vi.fn() } as unknown as CDPSession;
      const mockPage = {
        context: vi.fn().mockReturnValue({
          newCDPSession: vi.fn().mockResolvedValue(mockSession),
        }),
      } as unknown as Page;

      const session = await createCDPSession(mockPage);

      expect(session).toBe(mockSession);
    });

    it('should return null for CDP unsupported browsers', async () => {
      const mockPage = {
        context: vi.fn().mockReturnValue({
          newCDPSession: vi.fn().mockRejectedValue(new Error('CDP not available')),
        }),
      } as unknown as Page;

      const session = await createCDPSession(mockPage);

      expect(session).toBeNull();
    });

    it('should rethrow non-CDP errors', async () => {
      const mockPage = {
        context: vi.fn().mockReturnValue({
          newCDPSession: vi.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Page;

      await expect(createCDPSession(mockPage)).rejects.toThrow('Network error');
    });
  });

  describe('safeCDPSend', () => {
    it('should return true on success', async () => {
      const mockSession = {
        send: vi.fn().mockResolvedValue(undefined),
      } as unknown as CDPSession;

      const result = await safeCDPSend(mockSession, 'Network.enable', { option: true });

      expect(result).toBe(true);
      expect(mockSession.send).toHaveBeenCalledWith('Network.enable', { option: true });
    });

    it('should return false on error', async () => {
      const mockSession = {
        send: vi.fn().mockRejectedValue(new Error('Session closed')),
      } as unknown as CDPSession;

      const result = await safeCDPSend(mockSession, 'Network.enable');

      expect(result).toBe(false);
    });

    it('should handle missing params', async () => {
      const mockSession = {
        send: vi.fn().mockResolvedValue(undefined),
      } as unknown as CDPSession;

      await safeCDPSend(mockSession, 'Network.enable');

      expect(mockSession.send).toHaveBeenCalledWith('Network.enable', undefined);
    });
  });

  describe('createFeatureHandle', () => {
    type OnStopCallback = (state: CDPFeatureState) => Promise<unknown>;
    let mockState: CDPFeatureState;
    let mockOnStop: ReturnType<typeof vi.fn<OnStopCallback>>;

    beforeEach(() => {
      mockState = {
        cdpSession: {
          detach: vi.fn().mockResolvedValue(undefined),
        } as unknown as CDPSession,
        page: {} as Page,
        active: true,
      };
      mockOnStop = vi.fn<OnStopCallback>().mockResolvedValue({ result: 'metrics' });
    });

    it('should return handle with stop and isActive methods', () => {
      const handle = createFeatureHandle(mockState, { onStop: mockOnStop });

      expect(handle).toHaveProperty('stop');
      expect(handle).toHaveProperty('isActive');
      expect(typeof handle.stop).toBe('function');
      expect(typeof handle.isActive).toBe('function');
    });

    it('should return active state', () => {
      const handle = createFeatureHandle(mockState, { onStop: mockOnStop });

      expect(handle.isActive()).toBe(true);

      mockState.active = false;
      expect(handle.isActive()).toBe(false);
    });

    it('should call onStop and detach on stop', async () => {
      const handle = createFeatureHandle(mockState, { onStop: mockOnStop });

      const result = await handle.stop();

      expect(mockOnStop).toHaveBeenCalledWith(mockState);
      expect(mockState.cdpSession.detach).toHaveBeenCalled();
      expect(result).toEqual({ result: 'metrics' });
      expect(mockState.active).toBe(false);
    });

    it('should return null if already stopped', async () => {
      mockState.active = false;
      const handle = createFeatureHandle(mockState, { onStop: mockOnStop });

      const result = await handle.stop();

      expect(result).toBeNull();
      expect(mockOnStop).not.toHaveBeenCalled();
    });

    it('should handle onStop errors gracefully', async () => {
      mockOnStop.mockRejectedValue(new Error('Stop failed'));
      const handle = createFeatureHandle(mockState, { onStop: mockOnStop });

      const result = await handle.stop();

      expect(result).toBeNull();
      expect(mockState.active).toBe(false);
      expect(mockState.cdpSession.detach).toHaveBeenCalled();
    });
  });

  describe('createResettableFeatureHandle', () => {
    type OnStopCallback = (state: CDPFeatureState) => Promise<unknown>;
    type OnResetCallback = (state: CDPFeatureState) => Promise<void>;
    let mockState: CDPFeatureState;
    let mockOnStop: ReturnType<typeof vi.fn<OnStopCallback>>;
    let mockOnReset: ReturnType<typeof vi.fn<OnResetCallback>>;

    beforeEach(() => {
      mockState = {
        cdpSession: {
          detach: vi.fn().mockResolvedValue(undefined),
        } as unknown as CDPSession,
        page: {} as Page,
        active: true,
      };
      mockOnStop = vi.fn<OnStopCallback>().mockResolvedValue({ result: 'metrics' });
      mockOnReset = vi.fn<OnResetCallback>().mockResolvedValue(undefined);
    });

    it('should include reset method', () => {
      const handle = createResettableFeatureHandle(mockState, {
        onStop: mockOnStop,
        onReset: mockOnReset,
      });

      expect(handle).toHaveProperty('reset');
      expect(typeof handle.reset).toBe('function');
    });

    it('should call onReset when reset is called', async () => {
      const handle = createResettableFeatureHandle(mockState, {
        onStop: mockOnStop,
        onReset: mockOnReset,
      });

      await handle.reset();

      expect(mockOnReset).toHaveBeenCalledWith(mockState);
    });

    it('should not reset if inactive', async () => {
      mockState.active = false;
      const handle = createResettableFeatureHandle(mockState, {
        onStop: mockOnStop,
        onReset: mockOnReset,
      });

      await handle.reset();

      expect(mockOnReset).not.toHaveBeenCalled();
    });

    it('should deactivate and detach on reset error', async () => {
      mockOnReset.mockRejectedValue(new Error('Reset failed'));
      const handle = createResettableFeatureHandle(mockState, {
        onStop: mockOnStop,
        onReset: mockOnReset,
      });

      await handle.reset();

      expect(mockState.active).toBe(false);
      expect(mockState.cdpSession.detach).toHaveBeenCalled();
    });
  });

  describe('withCDPSession', () => {
    it('should execute operation with CDP session', async () => {
      const mockSession = { send: vi.fn() } as unknown as CDPSession;
      const mockPage = {
        context: vi.fn().mockReturnValue({
          newCDPSession: vi.fn().mockResolvedValue(mockSession),
        }),
      } as unknown as Page;
      const operation = vi.fn().mockResolvedValue('result');

      const result = await withCDPSession(mockPage, 'TestFeature', operation);

      expect(operation).toHaveBeenCalledWith(mockSession);
      expect(result).toBe('result');
    });

    it('should return null for unsupported browsers', async () => {
      const mockPage = {
        context: vi.fn().mockReturnValue({
          newCDPSession: vi.fn().mockRejectedValue(new Error('CDP not available')),
        }),
      } as unknown as Page;
      const operation = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await withCDPSession(mockPage, 'TestFeature', operation);

      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('TestFeature not supported'));

      consoleSpy.mockRestore();
    });

    it('should rethrow non-CDP errors', async () => {
      const mockPage = {
        context: vi.fn().mockReturnValue({
          newCDPSession: vi.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Page;
      const operation = vi.fn();

      await expect(withCDPSession(mockPage, 'TestFeature', operation)).rejects.toThrow(
        'Network error',
      );
    });
  });
});
