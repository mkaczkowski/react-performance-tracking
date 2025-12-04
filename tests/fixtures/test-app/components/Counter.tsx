import { Profiler, useState } from 'react';

import { usePerformance } from '@lib/react';

/**
 * Simple counter component for testing profiler integration
 */
export const Counter = () => {
  const [count, setCount] = useState(0);
  const performanceContext = usePerformance();

  if (!performanceContext) {
    return <div>Profiler not available</div>;
  }

  const { onProfilerRender } = performanceContext;

  return (
    <Profiler id="counter" onRender={onProfilerRender}>
      <div className="counter">
        <p>Count: {count}</p>
        <button onClick={() => setCount((c) => c + 1)} data-testid="increment-btn">
          Increment
        </button>
        <button onClick={() => setCount((c) => c - 1)} data-testid="decrement-btn">
          Decrement
        </button>
      </div>
    </Profiler>
  );
};
