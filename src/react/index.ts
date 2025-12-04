import './types/globals';

export {
  PerformanceProvider,
  PerformanceContext,
  type PerformanceContextValue,
} from './PerformanceProvider';

export { usePerformance, usePerformanceRequired } from './hooks/usePerformance';
export { usePerformanceStore } from './hooks/usePerformanceStore';

export type {
  ComponentMetrics,
  ProfilerPhase,
  PerformanceSample,
  PerformanceStore,
} from './PerformanceProvider.types';

export {
  createPerformanceStore,
  updatePerformanceStore,
  type UpdatePerformanceStoreParams,
} from './PerformanceProvider.helpers';
