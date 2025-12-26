import type { Page, TestInfo } from '@playwright/test';

import type { CustomMetrics } from './customMetrics';
import type { NetworkThrottlingConfig, ResettableCDPFeatureHandle } from './features';
import type { ResolvedTraceExportConfig, TraceExportConfig } from './trace/types';
import type {
  ResolvedWebVitalsThresholds,
  WebVitalsBufferConfig,
  WebVitalsThresholds,
} from './webVitals/types';
import type { PerformanceSample } from '../react/PerformanceProvider.types';

export type Percentage = number; // 20 => 20%
export type Milliseconds = number;
export type ThrottleRate = number; // 1 = no throttling

export type BufferConfig = {
  duration: Percentage;
  rerenders: Percentage;
  fps: Percentage; // subtractive because higher FPS is better
  heapGrowth: Percentage; // additive: threshold + buffer = max allowed
  webVitals: WebVitalsBufferConfig; // additive buffers for LCP, INP, CLS
  lighthouse: Percentage; // subtractive because higher scores are better
};

export type PartialBufferConfig = Partial<BufferConfig>;

export type EffectiveThresholds = {
  duration: Milliseconds;
  sampleCount: number;
  durationBufferMs: Milliseconds;
};

export type FPS = number;

export type Bytes = number;

/**
 * Generic percentile threshold object configuration.
 * All fields are optional - only specified ones are validated.
 * Used as base for Duration and FPS threshold objects.
 */
export type PercentileThresholdObject<T extends number = number> = {
  /** Average threshold */
  avg?: T;
  /** Median (50th percentile) threshold */
  p50?: T;
  /** 95th percentile threshold */
  p95?: T;
  /** 99th percentile threshold */
  p99?: T;
};

/**
 * Resolved percentile thresholds with all values defaulted.
 * 0 means no validation for that metric.
 */
export type ResolvedPercentileThresholds<T extends number = number> = {
  avg: T;
  p50: T;
  p95: T;
  p99: T;
};

/** FPS threshold object - alias for generic percentile threshold */
export type FPSThresholdObject = PercentileThresholdObject<FPS>;

/**
 * FPS thresholds configuration.
 * Can be a simple number (treated as avg) or an object with detailed thresholds.
 */
export type FPSThresholds = FPS | FPSThresholdObject;

/** Resolved FPS thresholds - alias for generic resolved percentile threshold */
export type ResolvedFPSThresholds = ResolvedPercentileThresholds<FPS>;

/** Default component key used as fallback for components without explicit thresholds */
export const DEFAULT_COMPONENT_KEY = '*';

/** Duration threshold object - alias for generic percentile threshold */
export type DurationThresholdObject = PercentileThresholdObject<Milliseconds>;

/**
 * Duration thresholds configuration.
 * Can be a simple number (treated as avg) or an object with detailed thresholds.
 */
export type DurationThresholds = Milliseconds | DurationThresholdObject;

/** Resolved duration thresholds - alias for generic resolved percentile threshold */
export type ResolvedDurationThresholds = ResolvedPercentileThresholds<Milliseconds>;

/**
 * Per-component threshold configuration.
 * Each component can have its own duration and rerenders thresholds.
 */
export type ComponentThresholds = {
  duration: DurationThresholds;
  rerenders: number;
};

/**
 * Threshold values with per-component profiler thresholds.
 * Use "*" key as default fallback for components not explicitly defined.
 */
export type ThresholdValues = {
  profiler?: {
    [componentId: string]: ComponentThresholds;
  };
  fps?: FPSThresholds;
  memory?: {
    heapGrowth?: Bytes;
  };
  webVitals?: WebVitalsThresholds;
  lighthouse?: LighthouseThresholds;
};

/**
 * Partial threshold values for CI overrides.
 * Allows partial overrides at any level.
 */
export type PartialThresholdValues = {
  profiler?: {
    [componentId: string]: Partial<ComponentThresholds>;
  };
  fps?: FPSThresholds;
  memory?: {
    heapGrowth?: Bytes;
  };
  webVitals?: Partial<WebVitalsThresholds>;
  lighthouse?: Partial<LighthouseThresholds>;
};

export type ThresholdConfig = {
  base: ThresholdValues;
  ci?: PartialThresholdValues;
};

export type TestConfig = {
  throttleRate?: ThrottleRate;
  warmup?: boolean; // When iterations=1: separate warmup run; When iterations>1: first iteration is warmup
  thresholds: ThresholdConfig;
  buffers?: PartialBufferConfig;
  name?: string;
  // Removed: trackFps, trackMemory, trackWebVitals (now auto-enabled from threshold presence)
  iterations?: number; // Number of times to run the test (default: 1)
  networkThrottling?: NetworkThrottlingConfig; // Chromium only; preset name or custom conditions
  exportTrace?: TraceExportConfig; // Chromium only; export CDP trace for flamegraph visualization
  lighthouse?: LighthouseConfig; // Chromium only; Lighthouse-specific options
};

/**
 * Resolved per-component threshold configuration.
 * All optional values are resolved to defaults (0 = no validation).
 */
export type ResolvedComponentThresholds = {
  duration: ResolvedDurationThresholds;
  rerenders: number;
};

/**
 * Resolved threshold values with all defaults applied.
 * Per-component profiler thresholds are resolved dynamically during validation.
 */
export type ResolvedThresholdValues = {
  profiler: {
    [componentId: string]: ResolvedComponentThresholds;
  };
  fps: ResolvedFPSThresholds; // avg, p50, p95, p99 (0 = no validation)
  memory: {
    heapGrowth: Bytes; // 0 = no threshold, skip validation
  };
  webVitals: ResolvedWebVitalsThresholds; // lcp, inp, cls (0 = no validation)
  lighthouse: ResolvedLighthouseThresholds; // performance, accessibility, etc. (0 = no validation)
};

export type ResolvedTestConfig = {
  throttleRate: ThrottleRate;
  warmup: boolean;
  thresholds: ResolvedThresholdValues;
  buffers: BufferConfig;
  name: string;
  trackFps: boolean;
  trackMemory: boolean;
  trackWebVitals: boolean;
  iterations: number;
  networkThrottling?: NetworkThrottlingConfig; // undefined = no network throttling
  exportTrace: ResolvedTraceExportConfig; // Trace export configuration
  lighthouse: ResolvedLighthouseConfig; // Lighthouse audit configuration
};

export type ConfiguredTestInfo = TestInfo & ResolvedTestConfig;

export type WaitForStableOptions = {
  stabilityPeriodMs?: Milliseconds;
  checkIntervalMs?: Milliseconds;
  maxWaitMs?: Milliseconds;
  /** If false, allows zero samples (for Lighthouse-only tests). Default: true */
  requireSamples?: boolean;
};

export type PerformanceInstance = {
  waitForInitialization: (timeout?: Milliseconds) => Promise<void>;
  waitUntilStable: (options?: WaitForStableOptions) => Promise<void>;
  reset: () => Promise<void>;
  init: () => Promise<void>;
  /** Register a tracking handle for coordinated resets */
  setTrackingHandle: (name: string, handle: ResettableCDPFeatureHandle<unknown> | null) => void;
  /**
   * Records a performance mark at the current timestamp.
   * Marks can be used as start/end points for measures.
   *
   * @param name - Unique name for the mark
   */
  mark: (name: string) => void;
  /**
   * Creates a performance measure between two marks.
   *
   * @param name - Unique name for the measure
   * @param startMark - Name of the mark to use as start point
   * @param endMark - Name of the mark to use as end point
   * @returns The duration in milliseconds
   * @throws Error if either mark is not found
   */
  measure: (name: string, startMark: string, endMark: string) => number;
  /**
   * Returns all custom metrics (marks and measures) collected during the test.
   */
  getCustomMetrics: () => CustomMetrics;
};

export type PerformanceFixture = {
  performance: PerformanceInstance;
};

export type BasePerformanceFixtures = {
  page: Page;
};

export type PerformanceTestFixtures<T extends BasePerformanceFixtures = BasePerformanceFixtures> =
  T & PerformanceFixture;

export type PerformanceTestFunction<T extends BasePerformanceFixtures = BasePerformanceFixtures> = (
  fixtures: PerformanceTestFixtures<T>,
  testInfo: ConfiguredTestInfo,
) => Promise<void> | void;

export type ProfilerPhase = PerformanceSample['phase'];

export type PhaseBreakdown = Partial<Record<ProfilerPhase, number>>;

// ============================================
// Lighthouse Types
// ============================================

/** Lighthouse score (0-100) */
export type LighthouseScore = number;

/** Lighthouse category identifiers */
export type LighthouseCategoryId =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'pwa';

/** Lighthouse score thresholds (0 = skip validation) */
export type LighthouseThresholds = {
  performance?: LighthouseScore;
  accessibility?: LighthouseScore;
  bestPractices?: LighthouseScore;
  seo?: LighthouseScore;
  pwa?: LighthouseScore;
};

/** Resolved Lighthouse thresholds with defaults applied */
export type ResolvedLighthouseThresholds = Required<LighthouseThresholds>;

/** Lighthouse-specific configuration options */
export type LighthouseConfig = {
  formFactor?: 'mobile' | 'desktop';
  categories?: LighthouseCategoryId[];
  skipAudits?: string[];
};

/** Resolved Lighthouse configuration */
export type ResolvedLighthouseConfig = Required<LighthouseConfig> & {
  enabled: boolean;
};

/** Lighthouse audit results */
export type LighthouseMetrics = {
  performance: LighthouseScore | null;
  accessibility: LighthouseScore | null;
  bestPractices: LighthouseScore | null;
  seo: LighthouseScore | null;
  pwa: LighthouseScore | null;
  auditDurationMs: number;
  url: string;
};
