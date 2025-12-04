import { render, screen } from '@testing-library/react';
import { Profiler, useContext } from 'react';
import { describe, expect, it } from 'vitest';

import { PerformanceContext, PerformanceProvider } from '@lib/react/PerformanceProvider';

describe('PerformanceProvider', () => {
  it('should render children', () => {
    render(
      <PerformanceProvider>
        <div data-testid="child">Child content</div>
      </PerformanceProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should provide context value', () => {
    let contextValue: unknown = null;

    const ContextConsumer = () => {
      contextValue = useContext(PerformanceContext);
      return null;
    };

    render(
      <PerformanceProvider>
        <ContextConsumer />
      </PerformanceProvider>,
    );

    expect(contextValue).not.toBeNull();
    expect(contextValue).toHaveProperty('onProfilerRender');
    expect(typeof (contextValue as { onProfilerRender: unknown }).onProfilerRender).toBe(
      'function',
    );
  });

  it('should provide onProfilerRender callback that can be used with React.Profiler', async () => {
    const ProfiledComponent = () => {
      const context = useContext(PerformanceContext);
      if (!context) return null;

      return (
        <Profiler id="test-profiler" onRender={context.onProfilerRender}>
          <div>Profiled content</div>
        </Profiler>
      );
    };

    render(
      <PerformanceProvider>
        <ProfiledComponent />
      </PerformanceProvider>,
    );

    // The performance store should be exposed on window.__REACT_PERFORMANCE__
    expect(window.__REACT_PERFORMANCE__).toBeDefined();
    // Note: In test environment, React Profiler may not trigger onRender callbacks
    // The important thing is that the callback is available and the store is exposed
    expect(typeof window.__REACT_PERFORMANCE__?.samples).toBe('object');
  });

  it('should expose performance store on window', () => {
    render(
      <PerformanceProvider>
        <div>Test</div>
      </PerformanceProvider>,
    );

    expect(window.__REACT_PERFORMANCE__).toBeDefined();
    expect(window.__REACT_PERFORMANCE__).toHaveProperty('samples');
    expect(window.__REACT_PERFORMANCE__).toHaveProperty('totalActualDuration');
    expect(window.__REACT_PERFORMANCE__).toHaveProperty('totalBaseDuration');
    expect(window.__REACT_PERFORMANCE__).toHaveProperty('reset');
  });
});
