import type { ProfilerOnRenderCallback, PropsWithChildren } from 'react';
import { createContext, useCallback, useMemo } from 'react';

import { usePerformanceStore } from './hooks/usePerformanceStore';
import { updatePerformanceStore } from './PerformanceProvider.helpers';
import type { PerformanceSample } from './PerformanceProvider.types';

export type PerformanceContextValue = {
  onProfilerRender: ProfilerOnRenderCallback;
};

export const PerformanceContext = createContext<PerformanceContextValue | null>(null);

/**
 * Provides React Profiler callback configuration.
 * Wrap an app with this provider to enable profiling data collection.
 */
export const PerformanceProvider = ({ children }: PropsWithChildren) => {
  const { samplesRef, storeRef } = usePerformanceStore();

  /**
   * Collects each commit from the React Profiler and forwards structured samples to consumers.
   */
  const onProfilerRender = useCallback<
    (...args: [...Parameters<ProfilerOnRenderCallback>, Set<unknown>?, number?]) => void
  >(
    (id, phase, actualDuration, baseDuration, startTime, commitTime, interactions, lanes) => {
      // Create sample directly without unnecessary mapping function
      const sample: PerformanceSample = {
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        interactions,
        lanes,
      };

      const sampleBuffer = samplesRef.current;
      sampleBuffer.push(sample);

      updatePerformanceStore({
        store: storeRef.current,
        samples: sampleBuffer,
        sample,
        actualDuration,
        baseDuration,
      });
    },
    [samplesRef, storeRef],
  );

  const value = useMemo(() => ({ onProfilerRender }), [onProfilerRender]);

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
};
