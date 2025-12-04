import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePerformanceStore } from '@lib/react/hooks/usePerformanceStore';

describe('usePerformanceStore', () => {
  beforeEach(() => {
    // Clean up before each test
    delete window.__REACT_PERFORMANCE__;
  });

  afterEach(() => {
    // Clean up after each test
    delete window.__REACT_PERFORMANCE__;
  });

  it('should initialize with empty samples array', () => {
    const { result } = renderHook(() => usePerformanceStore());

    expect(result.current.samplesRef.current).toEqual([]);
  });

  it('should expose performance store on window', () => {
    renderHook(() => usePerformanceStore());

    expect(window.__REACT_PERFORMANCE__).toBeDefined();
    expect(window.__REACT_PERFORMANCE__?.samples).toBeDefined();
  });

  it('should provide store ref', () => {
    const { result } = renderHook(() => usePerformanceStore());

    expect(result.current.storeRef.current).not.toBeNull();
    expect(result.current.storeRef.current).toHaveProperty('samples');
    expect(result.current.storeRef.current).toHaveProperty('reset');
  });

  it('should clean up window.__REACT_PERFORMANCE__ on unmount', () => {
    const { unmount } = renderHook(() => usePerformanceStore());

    expect(window.__REACT_PERFORMANCE__).toBeDefined();

    unmount();

    expect(window.__REACT_PERFORMANCE__).toBeUndefined();
  });

  it('should reset samples array on unmount', () => {
    const { result, unmount } = renderHook(() => usePerformanceStore());

    // Add some samples
    result.current.samplesRef.current.push({
      id: 'test',
      phase: 'mount',
      actualDuration: 10,
      baseDuration: 15,
      startTime: 0,
      commitTime: 10,
    });

    expect(result.current.samplesRef.current.length).toBe(1);

    unmount();

    expect(result.current.samplesRef.current.length).toBe(0);
  });

  it('should support reset functionality through store', () => {
    const { result } = renderHook(() => usePerformanceStore());

    const store = result.current.storeRef.current;
    expect(store).not.toBeNull();

    // Add some data
    result.current.samplesRef.current.push({
      id: 'test',
      phase: 'mount',
      actualDuration: 10,
      baseDuration: 15,
      startTime: 0,
      commitTime: 10,
    });
    store!.totalActualDuration = 100;
    store!.totalBaseDuration = 150;

    // Reset
    act(() => {
      store!.reset();
    });

    expect(result.current.samplesRef.current.length).toBe(0);
    expect(store!.totalActualDuration).toBe(0);
    expect(store!.totalBaseDuration).toBe(0);
  });
});
