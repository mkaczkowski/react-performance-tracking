import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { registerScenario } from './registry';

/**
 * Memory test scenario - allocates arrays to test memory tracking
 */
const MemoryTestContent = () => {
  const [, setData] = useState<number[][]>([]);
  const performanceContext = usePerformance();

  useEffect(() => {
    // Allocate some memory to have measurable heap usage
    const arrays: number[][] = [];
    for (let i = 0; i < 100; i++) {
      arrays.push(new Array(1000).fill(i));
    }
    setData(arrays);
  }, []);

  if (!performanceContext) {
    return <div>Profiler not available</div>;
  }

  const { onProfilerRender } = performanceContext;

  return (
    <Profiler id="app" onRender={onProfilerRender}>
      <div>
        <h1>Memory Test</h1>
        <p>Memory allocation scenario for heap tracking tests</p>
      </div>
    </Profiler>
  );
};

export const MemoryTest = () => (
  <PerformanceProvider>
    <MemoryTestContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'memory-test',
  component: MemoryTest,
  description: 'Memory allocation scenario for heap tracking tests',
});
