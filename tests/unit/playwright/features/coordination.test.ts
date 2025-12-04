import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFeatureCoordination } from '@lib/playwright/features/coordination';
import type { ResettableCDPFeatureHandle } from '@lib/playwright/features/types';

describe('createFeatureCoordination', () => {
  let coordination: ReturnType<typeof createFeatureCoordination>;

  beforeEach(() => {
    coordination = createFeatureCoordination();
  });

  describe('setHandle', () => {
    it('should register a handle', () => {
      const mockHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
        reset: vi.fn(),
      };

      coordination.setHandle('fps-tracking', mockHandle);

      expect(coordination.getHandle('fps-tracking')).toBe(mockHandle);
    });

    it('should unregister handle when null is passed', () => {
      const mockHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
        reset: vi.fn(),
      };

      coordination.setHandle('fps-tracking', mockHandle);
      coordination.setHandle('fps-tracking', null);

      expect(coordination.getHandle('fps-tracking')).toBeNull();
    });
  });

  describe('getHandle', () => {
    it('should return registered handle', () => {
      const mockHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
        reset: vi.fn(),
      };

      coordination.setHandle('fps-tracking', mockHandle);

      expect(coordination.getHandle('fps-tracking')).toBe(mockHandle);
    });

    it('should return null for unregistered handle', () => {
      expect(coordination.getHandle('nonexistent')).toBeNull();
    });
  });

  describe('resetIfActive', () => {
    it('should reset active handle and return true', async () => {
      const mockHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
        reset: vi.fn().mockResolvedValue(undefined),
      };

      coordination.setHandle('fps-tracking', mockHandle);
      const result = await coordination.resetIfActive('fps-tracking');

      expect(mockHandle.reset).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for inactive handle', async () => {
      const mockHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(false),
        reset: vi.fn(),
      };

      coordination.setHandle('fps-tracking', mockHandle);
      const result = await coordination.resetIfActive('fps-tracking');

      expect(mockHandle.reset).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false for unregistered handle', async () => {
      const result = await coordination.resetIfActive('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('resetAllActive', () => {
    it('should reset all active handles and return their names', async () => {
      const fpsHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
        reset: vi.fn().mockResolvedValue(undefined),
      };
      const memoryHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
        reset: vi.fn().mockResolvedValue(undefined),
      };
      const inactiveHandle: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(false),
        reset: vi.fn(),
      };

      coordination.setHandle('fps-tracking', fpsHandle);
      coordination.setHandle('memory-tracking', memoryHandle);
      coordination.setHandle('inactive', inactiveHandle);

      const resetNames = await coordination.resetAllActive();

      expect(fpsHandle.reset).toHaveBeenCalled();
      expect(memoryHandle.reset).toHaveBeenCalled();
      expect(inactiveHandle.reset).not.toHaveBeenCalled();
      expect(resetNames).toContain('fps-tracking');
      expect(resetNames).toContain('memory-tracking');
      expect(resetNames).not.toContain('inactive');
    });

    it('should return empty array when no handles registered', async () => {
      const resetNames = await coordination.resetAllActive();

      expect(resetNames).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all handles', () => {
      const handle1: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn(),
        reset: vi.fn(),
      };
      const handle2: ResettableCDPFeatureHandle<unknown> = {
        stop: vi.fn(),
        isActive: vi.fn(),
        reset: vi.fn(),
      };

      coordination.setHandle('feature-1', handle1);
      coordination.setHandle('feature-2', handle2);

      coordination.clear();

      expect(coordination.getHandle('feature-1')).toBeNull();
      expect(coordination.getHandle('feature-2')).toBeNull();
    });
  });
});
