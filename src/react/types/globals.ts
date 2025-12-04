import type { PerformanceStore } from '../PerformanceProvider.types';

declare global {
  interface Window {
    /** Performance store exposed for testing purposes */
    __REACT_PERFORMANCE__?: PerformanceStore;
    /** Internal tracker to monitor performance stability over time */
    __REACT_PERFORMANCE_STABILITY_TRACKER__?: {
      lastCount: number;
      lastChangeTime: number;
    };
  }
}

export {};
