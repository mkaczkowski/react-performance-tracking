import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { registerScenario } from './registry';

/**
 * Network throttling scenario - for testing network condition effects
 */
const NetworkThrottlingContent = () => {
  const [status, setStatus] = useState('idle');
  const performanceContext = usePerformance();

  useEffect(() => {
    setStatus('ready');
  }, []);

  if (!performanceContext) {
    return <div>Profiler not available</div>;
  }

  const { onProfilerRender } = performanceContext;

  return (
    <Profiler id="app" onRender={onProfilerRender}>
      <div>
        <h1>Network Throttling Test</h1>
        <p>Status: {status}</p>
        <p>This scenario tests network throttling conditions</p>
      </div>
    </Profiler>
  );
};

export const NetworkThrottling = () => (
  <PerformanceProvider>
    <NetworkThrottlingContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'network-throttling',
  component: NetworkThrottling,
  description: 'Network throttling test scenario',
});
