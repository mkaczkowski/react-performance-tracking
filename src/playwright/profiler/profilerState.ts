import type { Page } from '@playwright/test';

import type { CustomMetrics } from '../customMetrics';
import type { FPSMetrics, MemoryMetrics } from '../features';
import type { Milliseconds, PhaseBreakdown } from '../types';
import type { WebVitalsMetrics } from '../webVitals';

import { ProfilerErrorPhase, ProfilerStateError } from './profilerStateError';

/**
 * Per-component metrics captured from the profiler.
 */
export type CapturedComponentMetrics = {
  /** Sum of actualDuration for this component */
  totalActualDuration: Milliseconds;
  /** Sum of baseDuration for this component */
  totalBaseDuration: Milliseconds;
  /** Number of renders for this component */
  renderCount: number;
  /** Count of samples per React phase for this component */
  phaseBreakdown: PhaseBreakdown;
};

/**
 * Captured profiler state from the browser.
 */
export type CapturedProfilerState = {
  /** Total number of React commits/renders captured */
  sampleCount: number;
  /** Total time spent rendering (including memoized components) */
  totalActualDuration: Milliseconds;
  /** Total time that would be spent without memoization */
  totalBaseDuration: Milliseconds;
  /** Count of samples per React phase (mount/update/nested-update) */
  phaseBreakdown: PhaseBreakdown;
  /** Per-component metrics, keyed by profiler id */
  components: Record<string, CapturedComponentMetrics>;
  /** FPS metrics (only present when FPS tracking is enabled) */
  fps?: FPSMetrics;
  /** Memory metrics (only present when memory tracking is enabled) */
  memory?: MemoryMetrics;
  /** Web Vitals metrics (only present when web vitals tracking is enabled) */
  webVitals?: WebVitalsMetrics;
  /** Custom metrics (marks and measures) recorded during the test */
  customMetrics?: CustomMetrics;
};

/**
 * Captured profiler state with guaranteed FPS metrics.
 */
export type CapturedProfilerStateWithFPS = CapturedProfilerState & {
  fps: FPSMetrics;
};

/**
 * Captured profiler state with guaranteed memory metrics.
 */
export type CapturedProfilerStateWithMemory = CapturedProfilerState & {
  memory: MemoryMetrics;
};

/**
 * Captured profiler state with guaranteed custom metrics.
 */
export type CapturedProfilerStateWithCustomMetrics = CapturedProfilerState & {
  customMetrics: CustomMetrics;
};

/**
 * Captured profiler state with guaranteed web vitals metrics.
 */
export type CapturedProfilerStateWithWebVitals = CapturedProfilerState & {
  webVitals: WebVitalsMetrics;
};

/**
 * Type guard to check if profiler state has FPS metrics.
 */
export function hasAvgFps(state: CapturedProfilerState): state is CapturedProfilerStateWithFPS {
  return state.fps !== undefined && typeof state.fps.avg === 'number';
}

/**
 * Type guard to check if profiler state has memory metrics.
 */
export function hasMemoryMetrics(
  state: CapturedProfilerState,
): state is CapturedProfilerStateWithMemory {
  return state.memory !== undefined && typeof state.memory.heapGrowth === 'number';
}

/**
 * Type guard to check if profiler state has custom metrics.
 */
export function hasCustomMetrics(
  state: CapturedProfilerState,
): state is CapturedProfilerStateWithCustomMetrics {
  return (
    state.customMetrics !== undefined &&
    (state.customMetrics.marks.length > 0 || state.customMetrics.measures.length > 0)
  );
}

/**
 * Type guard to check if profiler state has web vitals metrics with data.
 */
export function hasWebVitals(
  state: CapturedProfilerState,
): state is CapturedProfilerStateWithWebVitals {
  if (!state.webVitals) return false;
  // At least one web vital metric should be present
  return (
    state.webVitals.lcp !== null || state.webVitals.inp !== null || state.webVitals.cls !== null
  );
}

/**
 * Type guard to check if profiler state has multiple components.
 */
export function hasMultipleComponents(state: CapturedProfilerState): boolean {
  return Object.keys(state.components).length > 1;
}

function validateProfilerState(
  state: CapturedProfilerState | null,
): asserts state is CapturedProfilerState {
  if (!state) {
    throw new ProfilerStateError(
      'Profiler state is null. Store may have been cleaned up.',
      ProfilerErrorPhase.VALIDATION,
      { state: null },
    );
  }

  if (state.sampleCount === 0) {
    throw new ProfilerStateError(
      'Profiler state has zero samples. Component may not have rendered properly.',
      ProfilerErrorPhase.VALIDATION,
      { sampleCount: state.sampleCount },
    );
  }
}

export const captureProfilerState = async (page: Page): Promise<CapturedProfilerState> => {
  const profilerState = await page.evaluate((): CapturedProfilerState | null => {
    const store = window.__REACT_PERFORMANCE__;

    if (!store) {
      return null;
    }

    // Calculate global phase breakdown
    const phaseBreakdown: Record<string, number> = {};
    for (const sample of store.samples) {
      phaseBreakdown[sample.phase] = (phaseBreakdown[sample.phase] ?? 0) + 1;
    }

    // Build per-component metrics
    const components: Record<
      string,
      {
        totalActualDuration: number;
        totalBaseDuration: number;
        renderCount: number;
        phaseBreakdown: Record<string, number>;
      }
    > = {};

    for (const [componentId, metrics] of Object.entries(store.components)) {
      const componentPhaseBreakdown: Record<string, number> = {};
      for (const sample of metrics.samples) {
        componentPhaseBreakdown[sample.phase] = (componentPhaseBreakdown[sample.phase] ?? 0) + 1;
      }

      components[componentId] = {
        totalActualDuration: metrics.totalActualDuration,
        totalBaseDuration: metrics.totalBaseDuration,
        renderCount: metrics.renderCount,
        phaseBreakdown: componentPhaseBreakdown,
      };
    }

    return {
      sampleCount: store.samples.length,
      totalActualDuration: store.totalActualDuration,
      totalBaseDuration: store.totalBaseDuration,
      phaseBreakdown,
      components,
    };
  });

  validateProfilerState(profilerState);

  return profilerState;
};
