import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCustomMetricsStore,
  hasCustomMetrics,
} from '../../../../src/playwright/customMetrics';

describe('customMetricsStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createCustomMetricsStore', () => {
    it('should create an empty store', () => {
      const store = createCustomMetricsStore();
      const metrics = store.getMetrics();

      expect(metrics.marks).toHaveLength(0);
      expect(metrics.measures).toHaveLength(0);
    });

    describe('mark', () => {
      it('should record a mark with timestamp relative to store creation', () => {
        const store = createCustomMetricsStore();

        vi.advanceTimersByTime(100);
        store.mark('start');

        const metrics = store.getMetrics();
        expect(metrics.marks).toHaveLength(1);
        expect(metrics.marks[0]).toEqual({
          name: 'start',
          timestamp: 100,
        });
      });

      it('should record multiple marks with correct timestamps', () => {
        const store = createCustomMetricsStore();

        vi.advanceTimersByTime(50);
        store.mark('first');

        vi.advanceTimersByTime(100);
        store.mark('second');

        vi.advanceTimersByTime(50);
        store.mark('third');

        const metrics = store.getMetrics();
        expect(metrics.marks).toHaveLength(3);
        expect(metrics.marks[0]).toEqual({ name: 'first', timestamp: 50 });
        expect(metrics.marks[1]).toEqual({ name: 'second', timestamp: 150 });
        expect(metrics.marks[2]).toEqual({ name: 'third', timestamp: 200 });
      });

      it('should overwrite mark with same name', () => {
        const store = createCustomMetricsStore();

        vi.advanceTimersByTime(100);
        store.mark('test');

        vi.advanceTimersByTime(100);
        store.mark('test');

        const metrics = store.getMetrics();
        expect(metrics.marks).toHaveLength(1);
        expect(metrics.marks[0]).toEqual({ name: 'test', timestamp: 200 });
      });
    });

    describe('measure', () => {
      it('should calculate duration between two marks', () => {
        const store = createCustomMetricsStore();

        vi.advanceTimersByTime(100);
        store.mark('start');

        vi.advanceTimersByTime(250);
        store.mark('end');

        const duration = store.measure('operation', 'start', 'end');

        expect(duration).toBe(250);
        const metrics = store.getMetrics();
        expect(metrics.measures).toHaveLength(1);
        expect(metrics.measures[0]).toEqual({
          name: 'operation',
          startMark: 'start',
          endMark: 'end',
          duration: 250,
        });
      });

      it('should throw error when start mark does not exist', () => {
        const store = createCustomMetricsStore();
        store.mark('end');

        expect(() => store.measure('test', 'nonexistent', 'end')).toThrow(
          'Performance mark "nonexistent" not found. Available marks: end',
        );
      });

      it('should throw error when end mark does not exist', () => {
        const store = createCustomMetricsStore();
        store.mark('start');

        expect(() => store.measure('test', 'start', 'nonexistent')).toThrow(
          'Performance mark "nonexistent" not found. Available marks: start',
        );
      });

      it('should show all available marks in error message', () => {
        const store = createCustomMetricsStore();
        store.mark('a');
        store.mark('b');
        store.mark('c');

        expect(() => store.measure('test', 'x', 'c')).toThrow(
          'Performance mark "x" not found. Available marks: a, b, c',
        );
      });

      it('should show "none" when no marks available', () => {
        const store = createCustomMetricsStore();

        expect(() => store.measure('test', 'start', 'end')).toThrow(
          'Performance mark "start" not found. Available marks: none',
        );
      });

      it('should support multiple measures', () => {
        const store = createCustomMetricsStore();

        store.mark('a');
        vi.advanceTimersByTime(100);
        store.mark('b');
        vi.advanceTimersByTime(200);
        store.mark('c');

        store.measure('first', 'a', 'b');
        store.measure('second', 'b', 'c');
        store.measure('total', 'a', 'c');

        const metrics = store.getMetrics();
        expect(metrics.measures).toHaveLength(3);
        expect(metrics.measures[0].duration).toBe(100);
        expect(metrics.measures[1].duration).toBe(200);
        expect(metrics.measures[2].duration).toBe(300);
      });

      it('should handle negative durations when marks are in wrong order', () => {
        const store = createCustomMetricsStore();

        vi.advanceTimersByTime(200);
        store.mark('later');

        vi.advanceTimersByTime(0); // Same time as before since we haven't advanced
        store.mark('earlier');

        // Mark 'earlier' was created at same time as 'later' (200ms), so duration is 0
        const duration = store.measure('reversed', 'later', 'earlier');
        expect(duration).toBe(0);
      });
    });

    describe('getMarks', () => {
      it('should return a copy of marks array', () => {
        const store = createCustomMetricsStore();
        store.mark('test');

        const marks1 = store.getMarks();
        const marks2 = store.getMarks();

        expect(marks1).toEqual(marks2);
        expect(marks1).not.toBe(marks2);
      });
    });

    describe('getMeasures', () => {
      it('should return a copy of measures array', () => {
        const store = createCustomMetricsStore();
        store.mark('start');
        store.mark('end');
        store.measure('test', 'start', 'end');

        const measures1 = store.getMeasures();
        const measures2 = store.getMeasures();

        expect(measures1).toEqual(measures2);
        expect(measures1).not.toBe(measures2);
      });
    });

    describe('reset', () => {
      it('should clear all marks and measures', () => {
        const store = createCustomMetricsStore();

        store.mark('test');
        vi.advanceTimersByTime(100);
        store.mark('end');
        store.measure('duration', 'test', 'end');

        expect(store.getMarks()).toHaveLength(2);
        expect(store.getMeasures()).toHaveLength(1);

        store.reset();

        expect(store.getMarks()).toHaveLength(0);
        expect(store.getMeasures()).toHaveLength(0);
      });

      it('should allow adding new marks after reset', () => {
        const store = createCustomMetricsStore();

        store.mark('old');
        store.reset();

        vi.advanceTimersByTime(50);
        store.mark('new');

        const metrics = store.getMetrics();
        expect(metrics.marks).toHaveLength(1);
        expect(metrics.marks[0].name).toBe('new');
      });
    });

    describe('getMetrics', () => {
      it('should return complete metrics object', () => {
        const store = createCustomMetricsStore();

        vi.advanceTimersByTime(10);
        store.mark('start');
        vi.advanceTimersByTime(100);
        store.mark('end');
        store.measure('operation', 'start', 'end');

        const metrics = store.getMetrics();

        expect(metrics).toEqual({
          marks: [
            { name: 'start', timestamp: 10 },
            { name: 'end', timestamp: 110 },
          ],
          measures: [
            {
              name: 'operation',
              startMark: 'start',
              endMark: 'end',
              duration: 100,
            },
          ],
        });
      });
    });
  });

  describe('hasCustomMetrics', () => {
    it('should return false for undefined', () => {
      expect(hasCustomMetrics(undefined)).toBe(false);
    });

    it('should return false for empty metrics', () => {
      expect(hasCustomMetrics({ marks: [], measures: [] })).toBe(false);
    });

    it('should return true when marks exist', () => {
      expect(hasCustomMetrics({ marks: [{ name: 'test', timestamp: 0 }], measures: [] })).toBe(
        true,
      );
    });

    it('should return true when measures exist', () => {
      expect(
        hasCustomMetrics({
          marks: [],
          measures: [{ name: 'test', startMark: 'a', endMark: 'b', duration: 100 }],
        }),
      ).toBe(true);
    });

    it('should return true when both marks and measures exist', () => {
      expect(
        hasCustomMetrics({
          marks: [{ name: 'test', timestamp: 0 }],
          measures: [{ name: 'test', startMark: 'a', endMark: 'b', duration: 100 }],
        }),
      ).toBe(true);
    });
  });
});
