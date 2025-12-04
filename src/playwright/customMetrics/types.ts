import type { Milliseconds } from '../types';

/**
 * A performance mark representing a point in time during test execution.
 */
export type PerformanceMark = {
  /** Unique name identifying this mark */
  name: string;
  /** Timestamp in milliseconds relative to the start of the performance test */
  timestamp: Milliseconds;
};

/**
 * A performance measure representing a duration between two marks.
 */
export type PerformanceMeasure = {
  /** Unique name identifying this measure */
  name: string;
  /** Name of the starting mark */
  startMark: string;
  /** Name of the ending mark */
  endMark: string;
  /** Duration in milliseconds between startMark and endMark */
  duration: Milliseconds;
};

/**
 * Custom metrics captured during a performance test.
 * Includes user-defined performance marks and measures.
 */
export type CustomMetrics = {
  /** All performance marks recorded during the test */
  marks: PerformanceMark[];
  /** All performance measures calculated from marks */
  measures: PerformanceMeasure[];
};

/**
 * Interface for the custom metrics store.
 */
export type CustomMetricsStore = {
  /**
   * Records a performance mark at the current timestamp.
   * Marks can be used as start/end points for measures.
   *
   * @param name - Unique name for the mark
   */
  mark: (name: string) => void;

  /**
   * Creates a performance measure between two marks.
   *
   * @param name - Unique name for the measure
   * @param startMark - Name of the mark to use as start point
   * @param endMark - Name of the mark to use as end point
   * @returns The duration in milliseconds
   * @throws Error if either mark is not found
   */
  measure: (name: string, startMark: string, endMark: string) => number;

  /**
   * Returns all recorded marks.
   */
  getMarks: () => PerformanceMark[];

  /**
   * Returns all calculated measures.
   */
  getMeasures: () => PerformanceMeasure[];

  /**
   * Returns the complete custom metrics object.
   */
  getMetrics: () => CustomMetrics;

  /**
   * Clears all marks and measures.
   */
  reset: () => void;
};
