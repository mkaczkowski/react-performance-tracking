import { useEffect, useState } from 'react';

import { PerformanceProvider } from '@lib/react';

import { Counter, ItemList } from '../components';
import { registerScenario } from './registry';

/**
 * Multi-component scenario - multiple profiled components for breakdown testing
 */
const MultiComponentContent = () => {
  const [ready, setReady] = useState(false);

  // Trigger a re-render to ensure we have profiler samples
  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div>
      <h1>Multi-Component Test</h1>
      <Counter />
      <hr />
      <ItemList />
      {ready && <span data-testid="ready" />}
    </div>
  );
};

export const MultiComponent = () => (
  <PerformanceProvider>
    <MultiComponentContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'multi-component',
  component: MultiComponent,
  description: 'Multiple profiled components for breakdown testing',
});
