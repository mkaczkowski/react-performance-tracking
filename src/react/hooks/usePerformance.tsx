import { useContext } from 'react';

import { PerformanceContext, type PerformanceContextValue } from '../PerformanceProvider';

/**
 * Hook to access the React performance configuration.
 * Returns null if used outside of PerformanceProvider.
 *
 * @see usePerformanceRequired for a variant that throws if used outside provider
 */
export const usePerformance = (): PerformanceContextValue | null => {
  return useContext(PerformanceContext);
};

/**
 * Hook to access the React performance configuration.
 * Throws an error if used outside of PerformanceProvider.
 *
 * Use this hook when you want to ensure the performance context is available
 * and avoid null checks in your component code.
 *
 * @throws {Error} If used outside of PerformanceProvider
 * @example
 * ```tsx
 * const { onProfilerRender } = usePerformanceRequired();
 * return <Profiler id="my-component" onRender={onProfilerRender}>...</Profiler>;
 * ```
 */
export const usePerformanceRequired = (): PerformanceContextValue => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error(
      'usePerformanceRequired must be used within a PerformanceProvider. ' +
        'Wrap your component tree with <PerformanceProvider> to use profiling features.',
    );
  }
  return context;
};
