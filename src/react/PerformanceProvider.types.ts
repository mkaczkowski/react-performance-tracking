/** Duration in milliseconds */
type Milliseconds = number;

/** Timestamp in milliseconds */
type Timestamp = number;

/**
 * React Profiler phase indicating the type of render.
 */
export type ProfilerPhase = 'mount' | 'update' | 'nested-update';

/**
 * Represents a single profiling sample captured during React component rendering.
 * Matches the data provided by React's Profiler onRender callback.
 */
export type PerformanceSample = {
  /** Unique identifier for the profiled component tree */
  id: string;
  /** Phase of the render (mount, update, or nested-update) */
  phase: ProfilerPhase;
  /** Time spent rendering the committed update */
  actualDuration: Milliseconds;
  /** Estimated time to render the entire subtree without memoization */
  baseDuration: Milliseconds;
  /** When React began rendering this update */
  startTime: Timestamp;
  /** When React committed this update */
  commitTime: Timestamp;
  /** Set of interactions that were being tracked (legacy API) */
  interactions?: Set<unknown>;
  /** React internal lanes (for debugging) */
  lanes?: number;
};

/**
 * Aggregated metrics for a single profiled component.
 * Tracks render counts and durations for each unique profiler id.
 */
export type ComponentMetrics = {
  /** Sum of actualDuration for this component */
  totalActualDuration: Milliseconds;
  /** Sum of baseDuration for this component */
  totalBaseDuration: Milliseconds;
  /** Number of renders for this component */
  renderCount: number;
  /** Samples collected for this component */
  samples: PerformanceSample[];
};

/**
 * Represents the state and methods for managing profiling data in a React application.
 * This store is exposed on `window.__REACT_PERFORMANCE__` for test access.
 */
export type PerformanceStore = {
  /** Array of all collected profiler samples */
  samples: PerformanceSample[];
  /** Sum of actualDuration across all samples */
  totalActualDuration: Milliseconds;
  /** Sum of baseDuration across all samples */
  totalBaseDuration: Milliseconds;
  /** Most recently collected sample */
  lastSample?: PerformanceSample;
  /** Per-component aggregated metrics, keyed by profiler id */
  components: Record<string, ComponentMetrics>;
  /** Reset the store, clearing all samples and durations */
  reset: () => void;
};
