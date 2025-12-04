import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

import { createPerformanceStore } from '../PerformanceProvider.helpers';
import type { PerformanceSample, PerformanceStore } from '../PerformanceProvider.types';

type PerformanceStoreHandles = {
  samplesRef: MutableRefObject<PerformanceSample[]>;
  storeRef: MutableRefObject<PerformanceStore | null>;
};

/**
 * Manages the lifecycle of the performance store, optionally exposing it globally for tests.
 */
export const usePerformanceStore = (): PerformanceStoreHandles => {
  const samplesRef = useRef<PerformanceSample[]>([]);
  const storeRef = useRef<PerformanceStore | null>(null);

  useEffect(() => {
    const samples = samplesRef.current;
    samples.length = 0;

    if (typeof window === 'undefined') {
      storeRef.current = null;
      return;
    }

    const store = createPerformanceStore(samples);
    window.__REACT_PERFORMANCE__ = store;
    storeRef.current = store;

    return () => {
      if (typeof window !== 'undefined') {
        delete window.__REACT_PERFORMANCE__;
      }

      samples.length = 0;
      storeRef.current = null;
    };
  }, []);

  return { samplesRef, storeRef };
};
