import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { usePerformance, usePerformanceRequired } from '@lib/react/hooks/usePerformance';
import { PerformanceProvider } from '@lib/react/PerformanceProvider';

describe('usePerformance', () => {
  it('should return null when used outside PerformanceProvider', () => {
    const { result } = renderHook(() => usePerformance());

    expect(result.current).toBeNull();
  });

  it('should return context value when used inside PerformanceProvider', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <PerformanceProvider>{children}</PerformanceProvider>
    );

    const { result } = renderHook(() => usePerformance(), { wrapper });

    expect(result.current).toEqual(
      expect.objectContaining({ onProfilerRender: expect.any(Function) }),
    );
  });
});

describe('usePerformanceRequired', () => {
  it('should throw when used outside PerformanceProvider', () => {
    expect(() => renderHook(() => usePerformanceRequired())).toThrow(
      'usePerformanceRequired must be used within a PerformanceProvider',
    );
  });

  it('should include helpful message in error', () => {
    expect(() => renderHook(() => usePerformanceRequired())).toThrow(
      'Wrap your component tree with <PerformanceProvider>',
    );
  });

  it('should return context value when used inside PerformanceProvider', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <PerformanceProvider>{children}</PerformanceProvider>
    );

    const { result } = renderHook(() => usePerformanceRequired(), { wrapper });

    expect(result.current).toEqual(
      expect.objectContaining({ onProfilerRender: expect.any(Function) }),
    );
  });

  it('should return onProfilerRender callback that can be invoked', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <PerformanceProvider>{children}</PerformanceProvider>
    );

    const { result } = renderHook(() => usePerformanceRequired(), { wrapper });

    // Should not throw when invoked with valid profiler args
    expect(() => {
      result.current.onProfilerRender(
        'test-id',
        'mount',
        10, // actualDuration
        15, // baseDuration
        100, // startTime
        110, // commitTime
      );
    }).not.toThrow();
  });
});
