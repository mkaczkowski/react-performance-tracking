import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { registerScenario } from './registry';

/**
 * Basic profiler scenario - simple component with state updates
 */
const BasicProfilerContent = () => {
  const [value, setValue] = useState(0);
  const [ready, setReady] = useState(false);
  const performanceContext = usePerformance();

  // Trigger a re-render to ensure we have profiler samples
  useEffect(() => {
    setReady(true);
  }, []);

  if (!performanceContext) {
    return <div>Profiler not available</div>;
  }

  const { onProfilerRender } = performanceContext;

  return (
    <Profiler id="app" onRender={onProfilerRender}>
      <div>
        <div id="root">Test App</div>
        <p>Value: {value}</p>
        <button onClick={() => setValue((v) => v + 1)} data-testid="update-btn">
          Update
        </button>
        {ready && <span data-testid="ready" />}
      </div>
    </Profiler>
  );
};

export const BasicProfiler = () => (
  <PerformanceProvider>
    <BasicProfilerContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'basic-profiler',
  component: BasicProfiler,
  description: 'Basic profiler integration test',
});
