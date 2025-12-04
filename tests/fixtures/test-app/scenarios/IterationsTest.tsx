import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { registerScenario } from './registry';

/**
 * Iterations test scenario - variable render times for multi-iteration testing
 */
const IterationsTestContent = () => {
  const [renderCount, setRenderCount] = useState(0);
  const performanceContext = usePerformance();

  useEffect(() => {
    // Trigger a re-render to have some profiler data
    setRenderCount((c) => c + 1);
  }, []);

  if (!performanceContext) {
    return <div>Profiler not available</div>;
  }

  const { onProfilerRender } = performanceContext;

  return (
    <Profiler id="app" onRender={onProfilerRender}>
      <div>
        <h1>Iterations Test</h1>
        <p>Render count: {renderCount}</p>
        <button onClick={() => setRenderCount((c) => c + 1)} data-testid="render-btn">
          Trigger Render
        </button>
      </div>
    </Profiler>
  );
};

export const IterationsTest = () => (
  <PerformanceProvider>
    <IterationsTestContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'iterations-test',
  component: IterationsTest,
  description: 'Variable render times for multi-iteration testing',
});
