import type {
  CustomMetrics,
  CustomMetricsStore,
  PerformanceMark,
  PerformanceMeasure,
} from './types';

/**
 * Creates a custom metrics store for recording performance marks and measures.
 * All timestamps are relative to when the store was created (test start time).
 *
 * @returns A CustomMetricsStore instance
 */
export function createCustomMetricsStore(): CustomMetricsStore {
  const startTime = Date.now();
  const marks = new Map<string, number>();
  const measures: PerformanceMeasure[] = [];

  // Define helper functions to avoid `this` binding issues
  const getMarksInternal = (): PerformanceMark[] => {
    return Array.from(marks.entries()).map(([name, timestamp]) => ({ name, timestamp }));
  };

  const getMeasuresInternal = (): PerformanceMeasure[] => {
    return [...measures];
  };

  return {
    mark(name: string): void {
      const timestamp = Date.now() - startTime;
      marks.set(name, timestamp);
    },

    measure(name: string, startMark: string, endMark: string): number {
      const start = marks.get(startMark);
      const end = marks.get(endMark);

      if (start === undefined) {
        throw new Error(
          `Performance mark "${startMark}" not found. Available marks: ${Array.from(marks.keys()).join(', ') || 'none'}`,
        );
      }

      if (end === undefined) {
        throw new Error(
          `Performance mark "${endMark}" not found. Available marks: ${Array.from(marks.keys()).join(', ') || 'none'}`,
        );
      }

      const duration = end - start;
      measures.push({ name, startMark, endMark, duration });
      return duration;
    },

    getMarks: getMarksInternal,

    getMeasures: getMeasuresInternal,

    getMetrics(): CustomMetrics {
      return {
        marks: getMarksInternal(),
        measures: getMeasuresInternal(),
      };
    },

    reset(): void {
      marks.clear();
      measures.length = 0;
    },
  };
}

/**
 * Checks if custom metrics contain any data.
 *
 * @param metrics - The custom metrics to check
 * @returns true if there are any marks or measures
 */
export function hasCustomMetrics(metrics: CustomMetrics | undefined): metrics is CustomMetrics {
  return metrics !== undefined && (metrics.marks.length > 0 || metrics.measures.length > 0);
}
