import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDurationMetricRow,
  createFPSMetricRow,
  createHeapGrowthMetricRow,
  createSamplesMetricRow,
  createWebVitalsMetricRows,
  logBreakdown,
  logComponentMetrics,
  logCustomMetrics,
  logIterationsTable,
  logPhaseBreakdown,
  logResultsTable,
  logSummary,
  logTestFooter,
  logTestHeader,
} from '@lib/playwright/assertions/logging';

describe('logging', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('logTestHeader', () => {
    it('should log test header with test name', () => {
      logTestHeader({
        testName: 'My Test',
        throttleRate: 1,
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('PERFORMANCE TEST: My Test');
      expect(calls).toContain('Environment:');
    });

    it('should show CPU throttle when rate > 1', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 4,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('CPU: 4x');
    });

    it('should not show CPU when throttle rate is 1', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 1,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).not.toContain('CPU:');
    });

    it('should show iterations count when multiple iterations', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 4,
        iterations: 5,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Iterations: 5');
    });

    it('should show warmup note when iterations with warmup enabled', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 4,
        iterations: 3,
        warmup: true,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Iterations: 3 (first is warmup)');
    });

    it('should not show iterations for single iteration', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 4,
        iterations: 1,
        warmup: true,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).not.toContain('Iterations');
    });

    it('should show network throttling with preset', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 1,
        networkThrottling: 'fast-3g',
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Network: fast-3g');
    });

    it('should show offline network throttling', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 1,
        networkThrottling: 'offline',
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Network: offline');
    });

    it('should not show network line when network throttling is undefined', () => {
      logTestHeader({
        testName: 'Test',
        throttleRate: 1,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).not.toContain('Network:');
    });
  });

  describe('logTestFooter', () => {
    it('should log all passed when passedCount equals totalCount', () => {
      logTestFooter(5, 5);

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('ALL CHECKS PASSED');
    });

    it('should log failed count when some checks failed', () => {
      logTestFooter(3, 5);

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('2 OF 5 CHECKS FAILED');
    });

    it('should log all failed when none passed', () => {
      logTestFooter(0, 3);

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('3 OF 3 CHECKS FAILED');
    });
  });

  describe('logResultsTable', () => {
    it('should log results table with metrics', () => {
      logResultsTable([
        { name: 'Duration', actual: '25.50ms', threshold: '< 600ms', passed: true },
        { name: 'Renders', actual: '26', threshold: '≤ 24', passed: false },
      ]);

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('RESULTS');
      expect(calls).toContain('Duration');
      expect(calls).toContain('25.50ms');
      expect(calls).toContain('< 600ms');
      expect(calls).toContain('PASS');
      expect(calls).toContain('Renders');
      expect(calls).toContain('FAIL');
    });

    it('should not log anything for empty metrics', () => {
      logResultsTable([]);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should show table borders', () => {
      logResultsTable([
        { name: 'Duration', actual: '25.50ms', threshold: '< 600ms', passed: true },
      ]);

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('┌');
      expect(calls).toContain('┐');
      expect(calls).toContain('└');
      expect(calls).toContain('┘');
      expect(calls).toContain('│');
    });
  });

  describe('logIterationsTable', () => {
    it('should log iterations table with multiple iterations', () => {
      logIterationsTable({
        iterations: [
          { index: 1, isWarmup: true, duration: 35.2, renders: 26, fps: 29.6 },
          { index: 2, isWarmup: false, duration: 22.5, renders: 26, fps: 47.4 },
          { index: 3, isWarmup: false, duration: 21.6, renders: 26, fps: 50.5 },
        ],
        averages: { duration: 22.05, renders: 26, fps: 48.95 },
        standardDeviation: { duration: 0.6, rerenders: 0 },
        hasWarmup: true,
        trackFps: true,
        trackMemory: false,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('ITERATIONS');
      expect(calls).toContain('Duration');
      expect(calls).toContain('Renders');
      expect(calls).toContain('FPS');
      expect(calls).toContain('AVG');
      expect(calls).toContain('warmup (excluded from average)');
    });

    it('should not log table for single iteration', () => {
      logIterationsTable({
        iterations: [{ index: 1, isWarmup: false, duration: 25, renders: 10 }],
        averages: { duration: 25, renders: 10 },
        hasWarmup: false,
        trackFps: false,
        trackMemory: false,
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should show warmup symbol for first iteration when warmup enabled', () => {
      logIterationsTable({
        iterations: [
          { index: 1, isWarmup: true, duration: 35, renders: 26 },
          { index: 2, isWarmup: false, duration: 25, renders: 26 },
        ],
        averages: { duration: 25, renders: 26 },
        hasWarmup: true,
        trackFps: false,
        trackMemory: false,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('1 ○');
    });

    it('should show heap growth column when memory tracking enabled', () => {
      logIterationsTable({
        iterations: [
          { index: 1, isWarmup: false, duration: 25, renders: 10, heapGrowth: 1024 * 1024 },
          { index: 2, isWarmup: false, duration: 26, renders: 10, heapGrowth: 512 * 1024 },
        ],
        averages: { duration: 25.5, renders: 10, heapGrowth: 768 * 1024 },
        hasWarmup: false,
        trackFps: false,
        trackMemory: true,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Heap Growth');
    });
  });

  describe('logBreakdown', () => {
    it('should log phase breakdown inline', () => {
      logBreakdown({
        phaseBreakdown: { mount: 1, update: 10 },
        components: {},
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('BREAKDOWN');
      expect(calls).toContain('Phases:');
      expect(calls).toContain('update: 10');
      expect(calls).toContain('mount: 1');
    });

    it('should log component breakdown', () => {
      logBreakdown({
        phaseBreakdown: {},
        components: {
          counter: {
            totalActualDuration: 100,
            totalBaseDuration: 150,
            renderCount: 5,
            phaseBreakdown: { mount: 1, update: 4 },
          },
        },
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('BREAKDOWN');
      expect(calls).toContain('Components:');
      expect(calls).toContain('counter');
      expect(calls).toContain('100.00ms');
      expect(calls).toContain('5 renders');
    });

    it('should not log anything when both are empty', () => {
      logBreakdown({
        phaseBreakdown: {},
        components: {},
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('logCustomMetrics', () => {
    it('should log measures', () => {
      logCustomMetrics({
        marks: [],
        measures: [{ name: 'api-call', duration: 120.5, startMark: 'start', endMark: 'end' }],
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('CUSTOM METRICS');
      expect(calls).toContain('api-call');
      expect(calls).toContain('120.50ms');
      expect(calls).toContain('start → end');
    });

    it('should log marks', () => {
      logCustomMetrics({
        marks: [{ name: 'checkpoint', timestamp: 50.5 }],
        measures: [],
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('checkpoint');
      expect(calls).toContain('50.50ms');
    });

    it('should not log anything when empty', () => {
      logCustomMetrics({
        marks: [],
        measures: [],
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('createDurationMetricRow', () => {
    it('should create passing duration metric row', () => {
      const row = createDurationMetricRow(100, 200, 20);

      expect(row.name).toBe('Duration');
      expect(row.actual).toBe('100.00ms');
      expect(row.threshold).toBe('< 240ms'); // 200 + 20%
      expect(row.passed).toBe(true);
    });

    it('should create failing duration metric row', () => {
      const row = createDurationMetricRow(300, 200, 20);

      expect(row.passed).toBe(false);
    });
  });

  describe('createSamplesMetricRow', () => {
    it('should create passing samples metric row', () => {
      const row = createSamplesMetricRow(10, 20, 20);

      expect(row.name).toBe('Renders');
      expect(row.actual).toBe('10');
      expect(row.threshold).toBe('≤ 24'); // ceil(20 + 20%)
      expect(row.passed).toBe(true);
    });

    it('should create failing samples metric row', () => {
      const row = createSamplesMetricRow(30, 20, 20);

      expect(row.passed).toBe(false);
    });
  });

  describe('createFPSMetricRow', () => {
    it('should create passing FPS metric row', () => {
      const row = createFPSMetricRow(58.5, 60, 20);

      expect(row.name).toBe('FPS');
      expect(row.actual).toBe('58.5');
      expect(row.threshold).toBe('≥ 48.0'); // 60 - 20%
      expect(row.passed).toBe(true);
    });

    it('should create failing FPS metric row', () => {
      const row = createFPSMetricRow(40, 60, 20);

      expect(row.passed).toBe(false);
    });
  });

  describe('createHeapGrowthMetricRow', () => {
    it('should create passing heap growth metric row', () => {
      const row = createHeapGrowthMetricRow(5 * 1024 * 1024, 10 * 1024 * 1024, 20);

      expect(row.name).toBe('Heap Growth');
      expect(row.actual).toBe('5.00 MB');
      expect(row.threshold).toContain('12.00 MB'); // 10MB + 20%
      expect(row.passed).toBe(true);
    });

    it('should create failing heap growth metric row', () => {
      const row = createHeapGrowthMetricRow(15 * 1024 * 1024, 10 * 1024 * 1024, 20);

      expect(row.passed).toBe(false);
    });
  });

  describe('createWebVitalsMetricRows', () => {
    it('should create metric rows for web vitals with thresholds', () => {
      const rows = createWebVitalsMetricRows(
        { lcp: 1250, inp: 45, cls: 0.05 },
        { lcp: 2500, inp: 200, cls: 0.1 },
        { lcp: 20, inp: 20, cls: 20 },
      );

      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe('LCP');
      expect(rows[0].passed).toBe(true);
      expect(rows[1].name).toBe('INP');
      expect(rows[1].passed).toBe(true);
      expect(rows[2].name).toBe('CLS');
      expect(rows[2].passed).toBe(true);
    });

    it('should skip web vitals with zero thresholds', () => {
      const rows = createWebVitalsMetricRows(
        { lcp: 1250, inp: 45, cls: 0.05 },
        { lcp: 0, inp: 200, cls: 0 },
        { lcp: 20, inp: 20, cls: 20 },
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('INP');
    });

    it('should skip null web vitals', () => {
      const rows = createWebVitalsMetricRows(
        { lcp: null, inp: 45, cls: null },
        { lcp: 2500, inp: 200, cls: 0.1 },
        { lcp: 20, inp: 20, cls: 20 },
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('INP');
    });
  });

  // Legacy function tests (kept for backward compatibility)
  describe('logPhaseBreakdown (legacy)', () => {
    it('should log phase breakdown sorted by count', () => {
      logPhaseBreakdown({
        mount: 1,
        update: 10,
        'nested-update': 5,
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('PHASE BREAKDOWN');
      expect(calls).toContain('update: 10');
      expect(calls).toContain('nested-update: 5');
      expect(calls).toContain('mount: 1');
    });
  });

  describe('logComponentMetrics (legacy)', () => {
    it('should log component breakdown', () => {
      logComponentMetrics({
        counter: {
          totalActualDuration: 100,
          totalBaseDuration: 150,
          renderCount: 5,
          phaseBreakdown: { mount: 1, update: 4 },
        },
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('COMPONENT BREAKDOWN');
      expect(calls).toContain('counter');
      expect(calls).toContain('100.00ms');
      expect(calls).toContain('5 renders');
    });

    it('should not log anything for empty components', () => {
      logComponentMetrics({});

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should sort components by duration (highest first)', () => {
      logComponentMetrics({
        'fast-component': {
          totalActualDuration: 50,
          totalBaseDuration: 75,
          renderCount: 2,
          phaseBreakdown: { mount: 1, update: 1 },
        },
        'slow-component': {
          totalActualDuration: 200,
          totalBaseDuration: 300,
          renderCount: 3,
          phaseBreakdown: { mount: 1, update: 2 },
        },
      });

      const calls = consoleLogSpy.mock.calls.flat() as string[];
      const slowIndex = calls.findIndex((call) => call.includes('slow-component'));
      const fastIndex = calls.findIndex((call) => call.includes('fast-component'));
      expect(slowIndex).toBeLessThan(fastIndex);
    });
  });

  describe('logSummary (legacy)', () => {
    it('should call logIterationsTable for multiple iterations', () => {
      logSummary({
        duration: 150,
        renders: 10,
        iterationMetrics: {
          iterations: 3,
          duration: 150,
          rerenders: 10,
          iterationResults: [
            { duration: 140, rerenders: 9 },
            { duration: 150, rerenders: 10 },
            { duration: 160, rerenders: 11 },
          ],
          standardDeviation: {
            duration: 8.16,
            rerenders: 0.82,
          },
        },
      });

      const calls = consoleLogSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('ITERATIONS');
      expect(calls).toContain('AVG');
    });

    it('should not log anything for single iteration', () => {
      logSummary({
        duration: 150,
        renders: 10,
        iterationMetrics: {
          iterations: 1,
          duration: 150,
          rerenders: 10,
          iterationResults: [{ duration: 150, rerenders: 10 }],
        },
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
