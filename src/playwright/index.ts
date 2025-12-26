export { createPerformanceTest, type PerformanceTest } from './createPerformanceTest';

export { createPerformanceInstance, performanceFixture } from './fixtures/performanceFixture';

export { PERFORMANCE_CONFIG, type PerformanceConfig } from './config/performanceConfig';

export {
  addConfigurationAnnotation,
  createConfiguredTestInfo,
  generateArtifactName,
  resolveBuffers,
  resolveComponentThresholds,
  resolveDurationThresholds,
  resolveExportTrace,
  resolveFPSThresholds,
  resolveIterations,
  resolveNetworkThrottling,
  resolveProfilerThresholds,
  resolveThresholds,
  resolveThrottleRate,
  resolveTrackFps,
  resolveTrackMemory,
  resolveTrackWebVitals,
  resolveWebVitalsBuffers,
  resolveWebVitalsThresholds,
} from './config/configResolver';

export { DEFAULT_COMPONENT_KEY } from './types';

export type {
  BasePerformanceFixtures,
  Bytes,
  BufferConfig,
  ComponentThresholds,
  ConfiguredTestInfo,
  DurationThresholdObject,
  DurationThresholds,
  EffectiveThresholds,
  FPS,
  FPSThresholdObject,
  FPSThresholds,
  Milliseconds,
  PartialBufferConfig,
  PartialThresholdValues,
  Percentage,
  PercentileThresholdObject,
  PerformanceTestFixtures,
  PerformanceTestFunction,
  PhaseBreakdown,
  PerformanceFixture,
  PerformanceInstance,
  ProfilerPhase,
  ResolvedComponentThresholds,
  ResolvedDurationThresholds,
  ResolvedFPSThresholds,
  ResolvedPercentileThresholds,
  ResolvedTestConfig,
  ResolvedThresholdValues,
  TestConfig,
  ThresholdConfig,
  ThresholdValues,
  ThrottleRate,
  WaitForStableOptions,
} from './types';

export {
  CDPFeatureRegistry,
  featureRegistry,
  createFeatureCoordination,
  createCDPSession,
  createFeatureHandle,
  createResettableFeatureHandle,
  detachCDPSession,
  isCdpUnsupportedError,
  cpuThrottlingFeature,
  formatNetworkConditions,
  isNetworkPreset,
  NETWORK_PRESETS,
  networkThrottlingFeature,
  resolveNetworkConditions,
  calculateMetricsFromEvents,
  collectTraceData,
  extractFrameEvents,
  fpsTrackingFeature,
  parseTraceEvent,
  calculateMemoryGrowth,
  captureMemorySnapshot,
  extractMemoryMetrics,
  formatBytes,
  memoryTrackingFeature,
  type ActiveFeatureHandles,
  type BytesPerSecond,
  type CDPFeature,
  type CDPFeatureHandle,
  type CDPFeatureState,
  type CDPMetric,
  type CPUThrottlingConfig,
  type CPUThrottlingHandle,
  type FeatureCoordination,
  type FeatureName,
  type FeatureStopResults,
  type FPSMetrics,
  type FPSTrackingHandle,
  type LatencyMs,
  type MemoryMetrics,
  type MemorySnapshot,
  type MemoryTrackingHandle,
  type NetworkConditions,
  type NetworkPreset,
  type NetworkThrottlingConfig,
  type NetworkThrottlingHandle,
  type RawTraceEvent,
  type ResettableCDPFeatureHandle,
  type ResolvedNetworkConditions,
  type TraceEvent,
} from './features';

export {
  createCustomMetricsStore,
  hasCustomMetrics,
  type CustomMetrics,
  type CustomMetricsStore,
  type PerformanceMark,
  type PerformanceMeasure,
} from './customMetrics';

export {
  captureProfilerState,
  hasAvgFps,
  hasCustomMetrics as hasProfilerCustomMetrics,
  hasMemoryMetrics,
  hasMultipleComponents,
  hasWebVitals,
  type CapturedComponentMetrics,
  type CapturedProfilerState,
  type CapturedProfilerStateWithCustomMetrics,
  type CapturedProfilerStateWithFPS,
  type CapturedProfilerStateWithMemory,
  type CapturedProfilerStateWithWebVitals,
} from './profiler/profilerState';
export { ProfilerErrorPhase, ProfilerStateError } from './profiler/profilerStateError';

export {
  calculateEffectiveMinThreshold,
  calculateEffectiveThreshold,
} from './utils/thresholdCalculator';

export {
  createLogger,
  getLogLevel,
  logger,
  LOG_PREFIX,
  setLogLevel,
  type Logger,
  type LogLevel,
} from '../utils';

export {
  assertPerformanceThresholds,
  getComponentThreshold,
} from './assertions/performanceAssertions';
export {
  assertCLSThreshold,
  assertDurationThreshold,
  assertFPSThreshold,
  assertHeapGrowthThreshold,
  assertINPThreshold,
  assertLCPThreshold,
  assertMemoizationEffectiveness,
  assertMinimumActivity,
  assertPercentileThreshold,
  assertSampleCountThreshold,
} from './assertions/validators';

export { PerformanceTestRunner, type CombinedMetrics } from './runner/PerformanceTestRunner';

export { attachTestResults } from './metrics/metricsAttachment';

export {
  aggregateIterationResults,
  calculateAverage,
  calculatePercentile,
  calculatePercentileMetrics,
  calculatePercentiles,
  calculateStandardDeviation,
  type IterationMetrics,
  type IterationResult,
  type PercentileLevel,
  type PercentileMetrics,
  type PercentileValues,
  type StandardDeviation,
} from './iterations';

export {
  captureWebVitals,
  hasWebVitalsData,
  injectWebVitalsObserver,
  isWebVitalsInitialized,
  resetWebVitals,
  DEFAULT_WEB_VITALS_BUFFERS,
  DEFAULT_WEB_VITALS_THRESHOLDS,
  type ResolvedWebVitalsThresholds,
  type WebVitalsBufferConfig,
  type WebVitalsMetrics,
  type WebVitalsThresholds,
} from './webVitals';

export {
  exportTrace,
  formatTraceForExport,
  generateTraceOutputPath,
  resolveTraceExportConfig,
  startTraceCapture,
  writeTraceFile,
  type ResolvedTraceExportConfig,
  type TraceCaptureResult,
  type TraceEventData,
  type TraceExportConfig,
  type TraceFormat,
  type TraceHandle,
  type TraceMetadata,
} from './trace';

export { runLighthouseAudit, type RunLighthouseOptions } from './lighthouse';

export {
  resolveLighthouseBuffer,
  resolveLighthouseConfig,
  resolveLighthouseThresholds,
} from './config/configResolver';

export type {
  LighthouseCategoryId,
  LighthouseConfig,
  LighthouseMetrics,
  LighthouseScore,
  LighthouseThresholds,
  ResolvedLighthouseConfig,
  ResolvedLighthouseThresholds,
} from './types';
