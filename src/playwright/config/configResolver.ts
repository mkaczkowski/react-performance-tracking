import type { TestInfo } from '@playwright/test';

import type { NetworkThrottlingConfig } from '../features';
import { type ResolvedTraceExportConfig, resolveTraceExportConfig } from '../trace';
import type {
  BufferConfig,
  ComponentThresholds,
  ConfiguredTestInfo,
  DurationThresholdObject,
  DurationThresholds,
  FPSThresholdObject,
  FPSThresholds,
  LighthouseCategoryId,
  PercentileThresholdObject,
  ResolvedComponentThresholds,
  ResolvedDurationThresholds,
  ResolvedFPSThresholds,
  ResolvedLighthouseConfig,
  ResolvedLighthouseThresholds,
  ResolvedPercentileThresholds,
  ResolvedThresholdValues,
  TestConfig,
} from '../types';
import type { ResolvedWebVitalsThresholds, WebVitalsBufferConfig } from '../webVitals/types';
import { PERFORMANCE_CONFIG } from './performanceConfig';

/**
 * Generates sanitized artifact name from test title
 */
export const generateArtifactName = (title: string): string => {
  return `${title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}-performance-data`;
};

/**
 * Check if FPS thresholds are configured in base or CI config
 */
const hasFpsThresholds = (config: TestConfig): boolean => {
  return !!(config.thresholds.base.fps || config.thresholds.ci?.fps);
};

/**
 * Check if memory thresholds are configured in base or CI config
 */
const hasMemoryThresholds = (config: TestConfig): boolean => {
  const baseHeapGrowth = config.thresholds.base.memory?.heapGrowth;
  const ciHeapGrowth = config.thresholds.ci?.memory?.heapGrowth;
  return baseHeapGrowth !== undefined || ciHeapGrowth !== undefined;
};

/**
 * Check if web vitals thresholds are configured in base or CI config
 */
const hasWebVitalsThresholds = (config: TestConfig): boolean => {
  return !!(config.thresholds.base.webVitals || config.thresholds.ci?.webVitals);
};

/**
 * Check if Lighthouse thresholds are configured in base or CI config
 */
const hasLighthouseThresholds = (config: TestConfig): boolean => {
  return !!(config.thresholds.base.lighthouse || config.thresholds.ci?.lighthouse);
};

/**
 * Resolves trackFps setting from config.
 * Auto-enables when FPS thresholds are configured.
 */
export const resolveTrackFps = (config: TestConfig): boolean => {
  return hasFpsThresholds(config);
};

/**
 * Resolves trackMemory setting from config.
 * Auto-enables when memory thresholds are configured.
 */
export const resolveTrackMemory = (config: TestConfig): boolean => {
  return hasMemoryThresholds(config);
};

/**
 * Resolves trackWebVitals setting from config.
 * Auto-enables when web vitals thresholds are configured.
 */
export const resolveTrackWebVitals = (config: TestConfig): boolean => {
  return hasWebVitalsThresholds(config);
};

/**
 * Resolves throttleRate setting from config
 */
export const resolveThrottleRate = (config: TestConfig): number =>
  config.throttleRate ?? PERFORMANCE_CONFIG.throttling.defaultRate;

/**
 * Resolves web vitals thresholds from config.
 * 0 means no validation for that metric.
 */
export const resolveWebVitalsThresholds = (
  config: TestConfig,
  isCI: boolean,
): ResolvedWebVitalsThresholds => {
  const thresholdConfig = config.thresholds;
  const baseWebVitals = thresholdConfig.base.webVitals ?? {};
  const ciWebVitals = thresholdConfig.ci?.webVitals ?? {};

  // Merge CI overrides when applicable
  const mergedWebVitals = isCI ? { ...baseWebVitals, ...ciWebVitals } : baseWebVitals;

  return {
    lcp: mergedWebVitals.lcp ?? 0,
    inp: mergedWebVitals.inp ?? 0,
    cls: mergedWebVitals.cls ?? 0,
    ttfb: mergedWebVitals.ttfb ?? 0,
    fcp: mergedWebVitals.fcp ?? 0,
  };
};

// ============================================
// Lighthouse Config Resolution
// ============================================

const DEFAULT_LIGHTHOUSE_BUFFER = 5;

const DEFAULT_LIGHTHOUSE_CATEGORIES: LighthouseCategoryId[] = [
  'performance',
  'accessibility',
  'best-practices',
  'seo',
];

/**
 * Resolves Lighthouse thresholds with CI overrides.
 * 0 means no validation for that category.
 */
export const resolveLighthouseThresholds = (
  config: TestConfig,
  isCI: boolean,
): ResolvedLighthouseThresholds => {
  const base = config.thresholds.base.lighthouse ?? {};
  const ci = config.thresholds.ci?.lighthouse ?? {};
  const merged = isCI ? { ...base, ...ci } : base;

  return {
    performance: merged.performance ?? 0,
    accessibility: merged.accessibility ?? 0,
    bestPractices: merged.bestPractices ?? 0,
    seo: merged.seo ?? 0,
    pwa: merged.pwa ?? 0,
  };
};

/**
 * Resolves Lighthouse configuration.
 * Auto-enabled when Lighthouse thresholds are configured.
 */
const DEFAULT_CHROME_FLAGS = ['--headless', '--no-sandbox', '--disable-gpu'];

export const resolveLighthouseConfig = (config: TestConfig): ResolvedLighthouseConfig => {
  const enabled = hasLighthouseThresholds(config);
  const userConfig = config.lighthouse ?? {};

  return {
    enabled,
    formFactor: userConfig.formFactor ?? 'mobile',
    categories: userConfig.categories ?? DEFAULT_LIGHTHOUSE_CATEGORIES,
    skipAudits: userConfig.skipAudits ?? [],
    chromeFlags: userConfig.chromeFlags ?? DEFAULT_CHROME_FLAGS,
    disableStorageReset: userConfig.disableStorageReset ?? true,
  };
};

/**
 * Resolves Lighthouse buffer (single value for all scores).
 */
export const resolveLighthouseBuffer = (config: TestConfig): number => {
  return config.buffers?.lighthouse ?? DEFAULT_LIGHTHOUSE_BUFFER;
};

/**
 * Generic threshold normalizer that converts number or object form to object form.
 * If a number is provided, it's treated as the avg threshold.
 * Works for any threshold type that extends PercentileThresholdObject.
 */
const normalizeThreshold = <T extends PercentileThresholdObject>(
  value: number | T | undefined,
): Partial<T> => {
  if (value === undefined) return {};
  if (typeof value === 'number') return { avg: value } as Partial<T>;
  return value;
};

/**
 * Generic percentile threshold resolver.
 * Normalizes, merges CI overrides, and applies defaults.
 * @param base - Base threshold value (number or object)
 * @param ci - CI override threshold value (number or object)
 * @param isCI - Whether running in CI environment
 * @param defaultAvg - Default value for avg when not specified (0 = no validation)
 */
const resolvePercentileThresholds = <T extends PercentileThresholdObject>(
  base: number | T | undefined,
  ci: number | T | undefined,
  isCI: boolean,
  defaultAvg: number = 0,
): ResolvedPercentileThresholds => {
  const baseObj = normalizeThreshold<T>(base);
  const ciObj = normalizeThreshold<T>(ci);
  const merged = isCI ? { ...baseObj, ...ciObj } : baseObj;

  return {
    avg: merged.avg ?? defaultAvg,
    p50: merged.p50 ?? 0,
    p95: merged.p95 ?? 0,
    p99: merged.p99 ?? 0,
  };
};

/**
 * Resolves duration thresholds for a component.
 * 0 means no validation for that metric.
 * Accepts both number (treated as avg) and object formats.
 */
export const resolveDurationThresholds = (
  baseDuration: DurationThresholds,
  ciDuration: DurationThresholds | undefined,
  isCI: boolean,
): ResolvedDurationThresholds =>
  resolvePercentileThresholds<DurationThresholdObject>(baseDuration, ciDuration, isCI, 0);

/**
 * Resolves FPS thresholds.
 * 0 means no validation for that metric.
 * Accepts both number (treated as avg) and object formats.
 */
export const resolveFPSThresholds = (
  baseFps: FPSThresholds | undefined,
  ciFps: FPSThresholds | undefined,
  isCI: boolean,
): ResolvedFPSThresholds =>
  resolvePercentileThresholds<FPSThresholdObject>(
    baseFps,
    ciFps,
    isCI,
    PERFORMANCE_CONFIG.fps.defaultThreshold,
  );

/**
 * Resolves a single component's thresholds with CI overrides.
 */
export const resolveComponentThresholds = (
  baseThreshold: ComponentThresholds,
  ciOverride: Partial<ComponentThresholds> | undefined,
  isCI: boolean,
): ResolvedComponentThresholds => {
  const rerenders =
    isCI && ciOverride?.rerenders !== undefined ? ciOverride.rerenders : baseThreshold.rerenders;

  return {
    duration: resolveDurationThresholds(baseThreshold.duration, ciOverride?.duration, isCI),
    rerenders,
  };
};

/**
 * Resolves all profiler thresholds, merging CI overrides per-component.
 */
export const resolveProfilerThresholds = (
  config: TestConfig,
  isCI: boolean,
): Record<string, ResolvedComponentThresholds> => {
  const baseProfiler = config.thresholds.base.profiler ?? {};
  const ciProfiler = config.thresholds.ci?.profiler ?? {};

  // Get all unique component keys from both base and CI
  const allComponentKeys = new Set([...Object.keys(baseProfiler), ...Object.keys(ciProfiler)]);

  const resolved: Record<string, ResolvedComponentThresholds> = {};

  for (const componentId of allComponentKeys) {
    const baseThreshold = baseProfiler[componentId];
    const ciOverride = ciProfiler[componentId];

    if (baseThreshold) {
      resolved[componentId] = resolveComponentThresholds(baseThreshold, ciOverride, isCI);
    }
    // Note: CI-only components without base are ignored (base is required)
  }

  return resolved;
};

/**
 * Resolves threshold values, merging CI overrides when applicable.
 * Per-component profiler thresholds use "*" as default fallback during validation.
 */
export const resolveThresholds = (config: TestConfig, isCI: boolean): ResolvedThresholdValues => {
  const thresholdConfig = config.thresholds;

  // Resolve memory threshold
  const baseHeapGrowth = thresholdConfig.base.memory?.heapGrowth;
  const ciHeapGrowth = thresholdConfig.ci?.memory?.heapGrowth;
  const heapGrowth =
    isCI && ciHeapGrowth !== undefined
      ? ciHeapGrowth
      : (baseHeapGrowth ?? PERFORMANCE_CONFIG.memory.defaultThreshold);

  return {
    profiler: resolveProfilerThresholds(config, isCI),
    fps: resolveFPSThresholds(thresholdConfig.base.fps, thresholdConfig.ci?.fps, isCI),
    memory: {
      heapGrowth,
    },
    webVitals: resolveWebVitalsThresholds(config, isCI),
    lighthouse: resolveLighthouseThresholds(config, isCI),
  };
};

/**
 * Resolves web vitals buffer configuration with defaults
 */
export const resolveWebVitalsBuffers = (config: TestConfig): WebVitalsBufferConfig => {
  const userBuffers = config.buffers?.webVitals;
  return {
    lcp: userBuffers?.lcp ?? PERFORMANCE_CONFIG.buffers.webVitals.lcp,
    inp: userBuffers?.inp ?? PERFORMANCE_CONFIG.buffers.webVitals.inp,
    cls: userBuffers?.cls ?? PERFORMANCE_CONFIG.buffers.webVitals.cls,
    ttfb: userBuffers?.ttfb ?? PERFORMANCE_CONFIG.buffers.webVitals.ttfb,
    fcp: userBuffers?.fcp ?? PERFORMANCE_CONFIG.buffers.webVitals.fcp,
  };
};

/**
 * Resolves buffer configuration with defaults
 */
export const resolveBuffers = (config: TestConfig): BufferConfig => ({
  duration: config.buffers?.duration ?? PERFORMANCE_CONFIG.buffers.duration,
  rerenders: config.buffers?.rerenders ?? PERFORMANCE_CONFIG.buffers.rerenders,
  fps: config.buffers?.fps ?? PERFORMANCE_CONFIG.buffers.fps,
  heapGrowth: config.buffers?.heapGrowth ?? PERFORMANCE_CONFIG.buffers.heapGrowth,
  webVitals: resolveWebVitalsBuffers(config),
  lighthouse: resolveLighthouseBuffer(config),
});

/**
 * Resolves iterations count from config
 */
export const resolveIterations = (config: TestConfig): number => {
  const iterations = config.iterations ?? PERFORMANCE_CONFIG.iterations.defaultCount;
  if (iterations < 1) {
    throw new Error(`iterations must be >= 1, got ${iterations}`);
  }
  return iterations;
};

/**
 * Resolves network throttling setting from config.
 * Returns undefined if no network throttling is configured.
 */
export const resolveNetworkThrottling = (config: TestConfig): NetworkThrottlingConfig | undefined =>
  config.networkThrottling;

/**
 * Resolves trace export setting from config.
 */
export const resolveExportTrace = (config: TestConfig): ResolvedTraceExportConfig =>
  resolveTraceExportConfig(config.exportTrace);

/**
 * Creates a resolved test configuration by extending TestInfo with performance settings.
 * Uses Object.create to preserve the prototype chain (including methods like attach).
 *
 * @param testInfo - Playwright's TestInfo object
 * @param testConfig - User-provided test configuration
 * @param title - Test title (used for artifact naming)
 * @returns ConfiguredTestInfo with all settings resolved
 */
export const createConfiguredTestInfo = (
  testInfo: TestInfo,
  testConfig: TestConfig,
  title: string,
): ConfiguredTestInfo => {
  const { isCI } = PERFORMANCE_CONFIG;
  const thresholds = resolveThresholds(testConfig, isCI);
  const buffers = resolveBuffers(testConfig);
  const trackFps = resolveTrackFps(testConfig);
  const trackMemory = resolveTrackMemory(testConfig);
  const trackWebVitals = resolveTrackWebVitals(testConfig);
  const throttleRate = resolveThrottleRate(testConfig);
  const name = testConfig.name ?? generateArtifactName(title);
  const warmup = testConfig.warmup ?? isCI;
  const iterations = resolveIterations(testConfig);
  const networkThrottling = resolveNetworkThrottling(testConfig);
  const exportTrace = resolveExportTrace(testConfig);
  const lighthouse = resolveLighthouseConfig(testConfig);

  // Create a new object with testInfo as prototype to preserve methods (like attach)
  // while adding performance configuration properties
  const configuredInfo = Object.create(testInfo) as ConfiguredTestInfo;
  configuredInfo.thresholds = thresholds;
  configuredInfo.buffers = buffers;
  configuredInfo.name = name;
  configuredInfo.warmup = warmup;
  configuredInfo.trackFps = trackFps;
  configuredInfo.trackMemory = trackMemory;
  configuredInfo.trackWebVitals = trackWebVitals;
  configuredInfo.throttleRate = throttleRate;
  configuredInfo.iterations = iterations;
  configuredInfo.networkThrottling = networkThrottling;
  configuredInfo.exportTrace = exportTrace;
  configuredInfo.lighthouse = lighthouse;

  return configuredInfo;
};

/**
 * Adds test configuration as annotation to test report
 */
export const addConfigurationAnnotation = (
  testInfo: TestInfo,
  configuredTestInfo: ConfiguredTestInfo,
): void => {
  const {
    throttleRate,
    warmup,
    buffers,
    trackFps,
    trackMemory,
    trackWebVitals,
    iterations,
    networkThrottling,
    exportTrace,
    lighthouse,
  } = configuredTestInfo;

  const throttleDescription = throttleRate > 1 ? `${throttleRate}x` : 'disabled';
  const warmupDescription = warmup ? 'enabled' : 'disabled';
  const fpsDescription = trackFps ? 'enabled' : 'disabled';
  const memoryDescription = trackMemory ? 'enabled' : 'disabled';
  const webVitalsDescription = trackWebVitals ? 'enabled' : 'disabled';
  const lighthouseDescription = lighthouse.enabled ? 'enabled' : 'disabled';
  const networkDescription = networkThrottling
    ? typeof networkThrottling === 'string'
      ? networkThrottling
      : 'custom'
    : 'disabled';
  const traceDescription = exportTrace.enabled ? 'enabled' : 'disabled';
  const bufferDescription = `duration=${buffers.duration}%, rerenders=${buffers.rerenders}%${trackFps ? `, fps=${buffers.fps}%` : ''}${trackMemory ? `, heapGrowth=${buffers.heapGrowth}%` : ''}${trackWebVitals ? `, webVitals.lcp=${buffers.webVitals.lcp}%` : ''}${lighthouse.enabled ? `, lighthouse=${buffers.lighthouse}%` : ''}`;
  const iterationsDescription =
    iterations > 1 ? `${iterations}x${warmup ? ' (first is warmup)' : ''}` : 'single';

  testInfo.annotations.push({
    type: 'config',
    description: `throttle=${throttleDescription}, warmup=${warmupDescription}, fps=${fpsDescription}, memory=${memoryDescription}, webVitals=${webVitalsDescription}, lighthouse=${lighthouseDescription}, network=${networkDescription}, trace=${traceDescription}, iterations=${iterationsDescription}, buffers=${bufferDescription}`,
  });
};
