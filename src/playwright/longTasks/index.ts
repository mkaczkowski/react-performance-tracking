export {
  captureLongTasks,
  ensureLongTasksInitialized,
  hasLongTaskData,
  injectLongTaskObserver,
  isLongTasksInitialized,
  resetLongTasks,
} from './longTaskTracking';
export type {
  ContainerType,
  LongTaskBufferConfig,
  LongTaskEntry,
  LongTaskMetrics,
  LongTaskThresholds,
  ResolvedLongTaskThresholds,
} from './types';
