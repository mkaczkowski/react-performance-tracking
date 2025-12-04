import { Profiler, useEffect, useState } from 'react';

import { PerformanceProvider, usePerformance } from '@lib/react';

import { registerScenario } from './registry';

/**
 * Web vitals test scenario - large content for LCP, click handler for INP
 */
const WebVitalsContent = () => {
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

  const handleClick = () => {
    // Small delay to simulate processing for INP measurement
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait
    }
  };

  return (
    <Profiler id="app" onRender={onProfilerRender}>
      <div>
        <div
          className="large-content"
          style={{
            width: 300,
            height: 300,
            background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
            fontSize: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          LCP Content
        </div>
        <button
          id="click-me"
          onClick={handleClick}
          style={{ padding: '20px 40px', fontSize: 18, cursor: 'pointer' }}
        >
          Click for INP
        </button>
        {ready && <span data-testid="ready" />}
      </div>
    </Profiler>
  );
};

export const WebVitalsTest = () => (
  <PerformanceProvider>
    <WebVitalsContent />
  </PerformanceProvider>
);

registerScenario({
  name: 'web-vitals',
  component: WebVitalsTest,
  description: 'Web vitals test with LCP content and INP click handler',
});
