import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CDPFeatureRegistry } from '@lib/playwright/features/registry';
import type { CDPFeature, CDPFeatureHandle } from '@lib/playwright/features/types';

describe('CDPFeatureRegistry', () => {
  let registry: CDPFeatureRegistry;

  beforeEach(() => {
    registry = new CDPFeatureRegistry();
  });

  describe('register', () => {
    it('should register a feature', () => {
      const mockFeature: CDPFeature<void> = {
        name: 'test-feature',
        requiresChromium: true,
        start: vi.fn(),
      };

      registry.register(mockFeature);

      expect(registry.has('test-feature')).toBe(true);
    });

    it('should throw if feature is already registered', () => {
      const mockFeature: CDPFeature<void> = {
        name: 'test-feature',
        requiresChromium: true,
        start: vi.fn(),
      };

      registry.register(mockFeature);

      expect(() => registry.register(mockFeature)).toThrow(
        'Feature "test-feature" is already registered',
      );
    });
  });

  describe('get', () => {
    it('should return registered feature', () => {
      const mockFeature: CDPFeature<void> = {
        name: 'test-feature',
        requiresChromium: true,
        start: vi.fn(),
      };

      registry.register(mockFeature);
      const feature = registry.get('test-feature');

      expect(feature).toBe(mockFeature);
    });

    it('should return undefined for unregistered feature', () => {
      const feature = registry.get('nonexistent');

      expect(feature).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered feature', () => {
      const mockFeature: CDPFeature<void> = {
        name: 'test-feature',
        requiresChromium: true,
        start: vi.fn(),
      };

      registry.register(mockFeature);

      expect(registry.has('test-feature')).toBe(true);
    });

    it('should return false for unregistered feature', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('getNames', () => {
    it('should return all registered feature names', () => {
      const feature1: CDPFeature<void> = {
        name: 'feature-1',
        requiresChromium: true,
        start: vi.fn(),
      };
      const feature2: CDPFeature<void> = {
        name: 'feature-2',
        requiresChromium: true,
        start: vi.fn(),
      };

      registry.register(feature1);
      registry.register(feature2);

      const names = registry.getNames();

      expect(names).toEqual(['feature-1', 'feature-2']);
    });

    it('should return empty array when no features registered', () => {
      expect(registry.getNames()).toEqual([]);
    });
  });

  describe('startFeature', () => {
    it('should start registered feature', async () => {
      const mockHandle: CDPFeatureHandle<void> = {
        stop: vi.fn(),
        isActive: vi.fn().mockReturnValue(true),
      };
      const mockFeature: CDPFeature<{ rate: number }> = {
        name: 'test-feature',
        requiresChromium: true,
        start: vi.fn().mockResolvedValue(mockHandle),
      };
      const mockPage = {} as Page;

      registry.register(mockFeature);
      const handle = await registry.startFeature('test-feature', mockPage, { rate: 4 });

      expect(mockFeature.start).toHaveBeenCalledWith(mockPage, { rate: 4 });
      expect(handle).toBe(mockHandle);
    });

    it('should throw for unregistered feature', async () => {
      const mockPage = {} as Page;

      await expect(registry.startFeature('nonexistent', mockPage, {})).rejects.toThrow(
        'Feature "nonexistent" is not registered',
      );
    });
  });

  describe('stopAll', () => {
    it('should stop all handles and collect results', async () => {
      const handle1: CDPFeatureHandle<number> = {
        stop: vi.fn().mockResolvedValue(100),
        isActive: vi.fn().mockReturnValue(true),
      };
      const handle2: CDPFeatureHandle<string> = {
        stop: vi.fn().mockResolvedValue('metrics'),
        isActive: vi.fn().mockReturnValue(true),
      };

      const handles = new Map<string, CDPFeatureHandle<unknown>>();
      handles.set('feature-1', handle1);
      handles.set('feature-2', handle2);

      const results = await registry.stopAll(handles);

      expect(handle1.stop).toHaveBeenCalled();
      expect(handle2.stop).toHaveBeenCalled();
      expect(results.get('feature-1')).toBe(100);
      expect(results.get('feature-2')).toBe('metrics');
      expect(handles.size).toBe(0); // handles cleared
    });

    it('should handle stop errors gracefully', async () => {
      const handle1: CDPFeatureHandle<number> = {
        stop: vi.fn().mockRejectedValue(new Error('Stop failed')),
        isActive: vi.fn().mockReturnValue(true),
      };
      const handle2: CDPFeatureHandle<string> = {
        stop: vi.fn().mockResolvedValue('success'),
        isActive: vi.fn().mockReturnValue(true),
      };

      const handles = new Map<string, CDPFeatureHandle<unknown>>();
      handles.set('feature-1', handle1);
      handles.set('feature-2', handle2);

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await registry.stopAll(handles);

      expect(results.get('feature-1')).toBeNull();
      expect(results.get('feature-2')).toBe('success');
    });
  });
});
