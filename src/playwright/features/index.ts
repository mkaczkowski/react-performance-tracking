export type {
  ActiveFeatureHandles,
  CDPFeature,
  CDPFeatureHandle,
  CDPFeatureState,
  FeatureName,
  FeatureStopResults,
  ResettableCDPFeatureHandle,
} from './types';

export { CDPFeatureRegistry, featureRegistry } from './registry';

export { createFeatureCoordination, type FeatureCoordination } from './coordination';

export {
  createCDPSession,
  createFeatureHandle,
  createResettableFeatureHandle,
  detachCDPSession,
  isCdpUnsupportedError,
  safeCDPSend,
  withCDPSession,
} from './utils';

export {
  cpuThrottlingFeature,
  type CPUThrottlingConfig,
  type CPUThrottlingHandle,
} from './cpuThrottling';

export {
  formatNetworkConditions,
  isNetworkPreset,
  NETWORK_PRESETS,
  networkThrottlingFeature,
  resolveNetworkConditions,
  type BytesPerSecond,
  type LatencyMs,
  type NetworkConditions,
  type NetworkPreset,
  type NetworkThrottlingConfig,
  type NetworkThrottlingHandle,
  type ResolvedNetworkConditions,
} from './networkThrottling';

export {
  calculateMetricsFromEvents,
  collectTraceData,
  extractFrameEvents,
  fpsTrackingFeature,
  parseTraceEvent,
  type FPSMetrics,
  type FPSTrackingHandle,
  type RawTraceEvent,
  type TraceEvent,
} from './fpsTracking';

export {
  calculateMemoryGrowth,
  captureMemorySnapshot,
  extractMemoryMetrics,
  formatBytes,
  memoryTrackingFeature,
  type CDPMetric,
  type MemoryMetrics,
  type MemorySnapshot,
  type MemoryTrackingHandle,
} from './memoryTracking';
