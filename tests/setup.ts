import '@testing-library/jest-dom/vitest';

// Reset any global state between tests
afterEach(() => {
  // Clean up window.__REACT_PERFORMANCE__ if set
  if (typeof window !== 'undefined') {
    delete (window as Window & { __REACT_PERFORMANCE__?: unknown }).__REACT_PERFORMANCE__;
    delete (window as Window & { __REACT_PROFILER_STABILITY_TRACKER__?: unknown })
      .__REACT_PROFILER_STABILITY_TRACKER__;
  }
});
