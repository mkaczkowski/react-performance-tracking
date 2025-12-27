export type PerformanceConfig = {
  readonly isCI: boolean;
  readonly profiler: {
    readonly stabilityPeriodMs: number;
    readonly checkIntervalMs: number;
    readonly maxWaitMs: number;
    readonly initializationTimeoutMs: number;
  };
  readonly buffers: {
    readonly duration: number;
    readonly rerenders: number;
    readonly fps: number;
    readonly heapGrowth: number;
    readonly webVitals: {
      readonly lcp: number;
      readonly inp: number;
      readonly cls: number;
      readonly ttfb: number;
      readonly fcp: number;
    };
    readonly longTasks: {
      readonly tbt: number;
      readonly maxDuration: number;
      readonly maxCount: number;
    };
  };
  readonly throttling: {
    readonly defaultRate: number;
  };
  readonly fps: {
    /** Default FPS threshold (frames per second) */
    readonly defaultThreshold: number;
  };
  readonly iterations: {
    /** Default number of iterations to run (1 = single run, backward compatible) */
    readonly defaultCount: number;
  };
  readonly memory: {
    /** Default heap growth threshold in bytes (0 = no threshold, skip validation) */
    readonly defaultThreshold: number;
  };
  readonly webVitals: {
    /** Whether web vitals tracking is enabled by default */
    readonly enabled: boolean;
  };
  readonly longTasks: {
    /** Long task threshold in milliseconds (tasks > this are "long") */
    readonly threshold: number;
  };
};

// Freeze nested objects for true immutability
const profilerConfig = Object.freeze({
  stabilityPeriodMs: 1000,
  checkIntervalMs: 100,
  maxWaitMs: 5000,
  initializationTimeoutMs: 10000,
});

const webVitalsBuffersConfig = Object.freeze({
  lcp: 20, // additive: threshold + 20% = max allowed
  inp: 20, // additive: threshold + 20% = max allowed
  cls: 20, // additive: threshold + 20% = max allowed
  ttfb: 20, // additive: threshold + 20% = max allowed
  fcp: 20, // additive: threshold + 20% = max allowed
});

const longTasksBuffersConfig = Object.freeze({
  tbt: 20, // additive: threshold + 20% = max allowed
  maxDuration: 20, // additive: threshold + 20% = max allowed
  maxCount: 20, // additive: threshold + 20% = max allowed
});

const buffersConfig = Object.freeze({
  duration: 20,
  rerenders: 20,
  fps: 20,
  heapGrowth: 20,
  webVitals: webVitalsBuffersConfig,
  longTasks: longTasksBuffersConfig,
});

const throttlingConfig = Object.freeze({
  defaultRate: 1,
});

const fpsConfig = Object.freeze({
  defaultThreshold: 60,
});

const iterationsConfig = Object.freeze({
  defaultCount: 1,
});

const memoryConfig = Object.freeze({
  /** Default heap growth threshold (0 = no threshold, skip validation) */
  defaultThreshold: 0,
});

const webVitalsConfig = Object.freeze({
  /** Web vitals tracking is disabled by default to avoid overhead */
  enabled: false,
});

const longTasksConfig = Object.freeze({
  /** Long task threshold - tasks > 50ms are considered "long" per Web Vitals spec */
  threshold: 50,
});

export const PERFORMANCE_CONFIG: PerformanceConfig = Object.freeze({
  get isCI(): boolean {
    return Boolean(process.env.CI);
  },

  profiler: profilerConfig,
  buffers: buffersConfig,
  throttling: throttlingConfig,
  fps: fpsConfig,
  iterations: iterationsConfig,
  memory: memoryConfig,
  webVitals: webVitalsConfig,
  longTasks: longTasksConfig,
});
