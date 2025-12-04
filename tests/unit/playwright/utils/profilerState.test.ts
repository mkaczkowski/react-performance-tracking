import { describe, expect, it } from 'vitest';

import { captureProfilerState, hasAvgFps } from '@/playwright/profiler/profilerState';
import { ProfilerStateError } from '@/playwright/profiler/profilerStateError';
import { createMockPage, createMockProfilerState } from '../../../mocks/playwrightMocks';

describe('profilerState', () => {
  describe('captureProfilerState', () => {
    it('should capture profiler state from page', async () => {
      const mockState = createMockProfilerState();
      const mockPage = createMockPage(mockState);

      const result = await captureProfilerState(mockPage);

      expect(result).toEqual(mockState);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should throw ProfilerStateError when profiler state is null', async () => {
      const mockPage = createMockPage(null);

      await expect(captureProfilerState(mockPage)).rejects.toThrow(ProfilerStateError);
      await expect(captureProfilerState(mockPage)).rejects.toThrow('Profiler state is null');
    });

    it('should throw ProfilerStateError when sample count is zero', async () => {
      const mockState = createMockProfilerState({ sampleCount: 0 });
      const mockPage = createMockPage(mockState);

      await expect(captureProfilerState(mockPage)).rejects.toThrow(ProfilerStateError);
      await expect(captureProfilerState(mockPage)).rejects.toThrow('zero samples');
    });

    it('should return phase breakdown', async () => {
      const mockState = createMockProfilerState({
        phaseBreakdown: { mount: 2, update: 8 },
      });
      const mockPage = createMockPage(mockState);

      const result = await captureProfilerState(mockPage);

      expect(result.phaseBreakdown).toEqual({ mount: 2, update: 8 });
    });
  });

  describe('hasAvgFps', () => {
    it('should return true when fps metrics are present with avg', () => {
      const state = createMockProfilerState({
        fps: {
          avg: 60,
          frameCount: 120,
          trackingDurationMs: 2000,
        },
      });

      expect(hasAvgFps(state)).toBe(true);
    });

    it('should return false when fps is undefined', () => {
      const state = createMockProfilerState();

      expect(hasAvgFps(state)).toBe(false);
    });

    it('should return false when fps.avg is not a number', () => {
      const state = {
        ...createMockProfilerState(),
        fps: {
          avg: undefined as unknown as number,
          frameCount: 120,
          trackingDurationMs: 2000,
        },
      };

      expect(hasAvgFps(state)).toBe(false);
    });
  });
});
