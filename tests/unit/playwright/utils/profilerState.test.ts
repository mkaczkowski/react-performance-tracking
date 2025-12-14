import { describe, expect, it } from 'vitest';

import {
  captureProfilerState,
  hasAvgFps,
  hasCustomMetrics,
  hasMemoryMetrics,
  hasMultipleComponents,
  hasWebVitals,
} from '@/playwright/profiler/profilerState';
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

  describe('hasMemoryMetrics', () => {
    it('should return true when memory.heapGrowth is present', () => {
      const state = createMockProfilerState({
        memory: { heapGrowth: 1024 },
      });
      expect(hasMemoryMetrics(state)).toBe(true);
    });

    it('should return true when heapGrowth is 0', () => {
      const state = createMockProfilerState({
        memory: { heapGrowth: 0 },
      });
      expect(hasMemoryMetrics(state)).toBe(true);
    });

    it('should return false when memory is undefined', () => {
      const state = createMockProfilerState();
      expect(hasMemoryMetrics(state)).toBe(false);
    });

    it('should return false when heapGrowth is not a number', () => {
      const state = {
        ...createMockProfilerState(),
        memory: { heapGrowth: undefined as unknown as number },
      };
      expect(hasMemoryMetrics(state)).toBe(false);
    });
  });

  describe('hasCustomMetrics', () => {
    it('should return true when marks are present', () => {
      const state = createMockProfilerState({
        customMetrics: {
          marks: [{ name: 'test-mark', startTime: 100 }],
          measures: [],
        },
      });
      expect(hasCustomMetrics(state)).toBe(true);
    });

    it('should return true when measures are present', () => {
      const state = createMockProfilerState({
        customMetrics: {
          marks: [],
          measures: [{ name: 'test-measure', duration: 50, startTime: 100 }],
        },
      });
      expect(hasCustomMetrics(state)).toBe(true);
    });

    it('should return true when both marks and measures are present', () => {
      const state = createMockProfilerState({
        customMetrics: {
          marks: [{ name: 'test-mark', startTime: 100 }],
          measures: [{ name: 'test-measure', duration: 50, startTime: 100 }],
        },
      });
      expect(hasCustomMetrics(state)).toBe(true);
    });

    it('should return false when customMetrics is undefined', () => {
      const state = createMockProfilerState();
      expect(hasCustomMetrics(state)).toBe(false);
    });

    it('should return false when marks and measures are empty', () => {
      const state = createMockProfilerState({
        customMetrics: { marks: [], measures: [] },
      });
      expect(hasCustomMetrics(state)).toBe(false);
    });
  });

  describe('hasWebVitals', () => {
    it('should return true when lcp is present', () => {
      const state = createMockProfilerState({
        webVitals: { lcp: 1500, inp: null, cls: null },
      });
      expect(hasWebVitals(state)).toBe(true);
    });

    it('should return true when inp is present', () => {
      const state = createMockProfilerState({
        webVitals: { lcp: null, inp: 100, cls: null },
      });
      expect(hasWebVitals(state)).toBe(true);
    });

    it('should return true when cls is present', () => {
      const state = createMockProfilerState({
        webVitals: { lcp: null, inp: null, cls: 0.05 },
      });
      expect(hasWebVitals(state)).toBe(true);
    });

    it('should return true when all web vitals are present', () => {
      const state = createMockProfilerState({
        webVitals: { lcp: 1500, inp: 100, cls: 0.05 },
      });
      expect(hasWebVitals(state)).toBe(true);
    });

    it('should return false when webVitals is undefined', () => {
      const state = createMockProfilerState();
      expect(hasWebVitals(state)).toBe(false);
    });

    it('should return false when all metrics are null', () => {
      const state = createMockProfilerState({
        webVitals: { lcp: null, inp: null, cls: null },
      });
      expect(hasWebVitals(state)).toBe(false);
    });
  });

  describe('hasMultipleComponents', () => {
    it('should return true when more than one component exists', () => {
      const state = createMockProfilerState({
        components: {
          App: {
            renderCount: 2,
            totalActualDuration: 100,
            avgActualDuration: 50,
            totalPhases: { mount: 1, update: 1 },
          },
          Header: {
            renderCount: 1,
            totalActualDuration: 50,
            avgActualDuration: 50,
            totalPhases: { mount: 1, update: 0 },
          },
        },
      });
      expect(hasMultipleComponents(state)).toBe(true);
    });

    it('should return false when only one component exists', () => {
      const state = createMockProfilerState({
        components: {
          App: {
            renderCount: 2,
            totalActualDuration: 100,
            avgActualDuration: 50,
            totalPhases: { mount: 1, update: 1 },
          },
        },
      });
      expect(hasMultipleComponents(state)).toBe(false);
    });

    it('should return false when no components exist', () => {
      const state = createMockProfilerState({
        components: {},
      });
      expect(hasMultipleComponents(state)).toBe(false);
    });
  });
});
