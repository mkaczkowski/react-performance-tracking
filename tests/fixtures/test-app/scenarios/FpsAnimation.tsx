import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { AnimatedBox } from '../components';
import { registerScenario } from './registry';

/**
 * FPS animation scenario - animated box for FPS tracking tests
 */
const FpsAnimationContent = () => {
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
        <AnimatedBox speed={2} maxDistance={300} />
        {ready && <span data-testid="ready" />}
      </div>
    </Profiler>
  );
};

export const FpsAnimation = () => (
  <PerformanceProvider>
    <FpsAnimationContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'fps-animation',
  component: FpsAnimation,
  description: 'Animated box for FPS tracking tests',
});
