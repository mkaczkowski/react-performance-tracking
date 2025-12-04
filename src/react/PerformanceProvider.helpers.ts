import type {
  ComponentMetrics,
  PerformanceSample,
  PerformanceStore,
} from './PerformanceProvider.types';

/**
 * Creates empty component metrics for a new component.
 */
const createComponentMetrics = (): ComponentMetrics => ({
  totalActualDuration: 0,
  totalBaseDuration: 0,
  renderCount: 0,
  samples: [],
});

/**
 * Builds a reusable performance store tied to the provided samples array.
 *
 * @param samples - Array to store performance samples
 * @returns A performance store with methods to access and reset performance data
 */
export const createPerformanceStore = (samples: PerformanceSample[]): PerformanceStore => {
  const store: PerformanceStore = {
    samples,
    totalActualDuration: 0,
    totalBaseDuration: 0,
    components: {},
    reset: () => {
      samples.length = 0;
      store.totalActualDuration = 0;
      store.totalBaseDuration = 0;
      store.lastSample = undefined;
      store.components = {};
    },
  };

  return store;
};

/**
 * Parameters for updating the performance store with a new sample.
 */
export type UpdatePerformanceStoreParams = {
  store: PerformanceStore | null;
  samples: PerformanceSample[];
  sample: PerformanceSample;
  actualDuration: number;
  baseDuration: number;
};

/**
 * Synchronizes the runtime performance store with the latest commit sample.
 * Updates both global totals and per-component metrics.
 */
export const updatePerformanceStore = ({
  store,
  samples,
  sample,
  actualDuration,
  baseDuration,
}: UpdatePerformanceStoreParams): void => {
  if (!store) {
    return;
  }

  // Update global metrics
  store.samples = samples;
  store.totalActualDuration += actualDuration;
  store.totalBaseDuration += baseDuration;
  store.lastSample = sample;

  // Update component-level metrics
  const componentId = sample.id;
  if (!store.components[componentId]) {
    store.components[componentId] = createComponentMetrics();
  }

  const componentMetrics = store.components[componentId];
  componentMetrics.totalActualDuration += actualDuration;
  componentMetrics.totalBaseDuration += baseDuration;
  componentMetrics.renderCount += 1;
  componentMetrics.samples.push(sample);
};
