export type {
  WebVitalsMetrics,
  WebVitalsThresholds,
  ResolvedWebVitalsThresholds,
  WebVitalsBufferConfig,
} from './types';

export { DEFAULT_WEB_VITALS_THRESHOLDS, DEFAULT_WEB_VITALS_BUFFERS } from './types';

export {
  injectWebVitalsObserver,
  ensureWebVitalsInitialized,
  captureWebVitals,
  resetWebVitals,
  isWebVitalsInitialized,
  hasWebVitalsData,
} from './webVitalsTracking';
