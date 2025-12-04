import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { AnimatedBox } from '../components';
import { registerScenario } from './registry';

/**
 * Trace export scenario - animation for generating trace events
 */
const TraceExportContent = () => {
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
        <h1>Trace Export Test</h1>
        <AnimatedBox speed={3} maxDistance={400} />
        {ready && <span data-testid="ready" />}
      </div>
    </Profiler>
  );
};

export const TraceExport = () => (
  <PerformanceProvider>
    <TraceExportContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'trace-export',
  component: TraceExport,
  description: 'Animation scenario for generating trace events',
});
