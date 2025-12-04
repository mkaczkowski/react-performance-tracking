import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { registerScenario } from './registry';

/**
 * Percentile test scenario - creates distribution of render times for percentile calculations
 */
const PercentileTestContent = () => {
  const [items, setItems] = useState<number[]>([]);
  const performanceContext = usePerformance();

  useEffect(() => {
    // Create some initial items to generate profiler data
    setItems([1, 2, 3]);
  }, []);

  if (!performanceContext) {
    return <div>Profiler not available</div>;
  }

  const { onProfilerRender } = performanceContext;

  return (
    <Profiler id="app" onRender={onProfilerRender}>
      <div>
        <h1>Percentile Test</h1>
        <ul>
          {items.map((item) => (
            <li key={item}>Item {item}</li>
          ))}
        </ul>
        <button
          onClick={() => setItems((prev) => [...prev, prev.length + 1])}
          data-testid="add-btn"
        >
          Add Item
        </button>
      </div>
    </Profiler>
  );
};

export const PercentileTest = () => (
  <PerformanceProvider>
    <PercentileTestContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'percentile-test',
  component: PercentileTest,
  description: 'Creates distribution of render times for percentile calculations',
});
