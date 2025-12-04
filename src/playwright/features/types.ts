import type { CDPSession, Page } from '@playwright/test';

/**
 * Base handle interface for all CDP-based features.
 * Provides a consistent API for lifecycle management.
 *
 * @template TMetrics - The type of metrics returned on stop (void for non-metrics features)
 */
export interface CDPFeatureHandle<TMetrics = void> {
  /** Stop the feature and return collected metrics (if any) */
  stop(): Promise<TMetrics | null>;
  /** Check if the feature is still active */
  isActive(): boolean;
}

/**
 * Extended handle interface for features that support reset.
 * Used by tracking features (FPS, Memory) that can restart measurement.
 */
export interface ResettableCDPFeatureHandle<TMetrics = void> extends CDPFeatureHandle<TMetrics> {
  /** Reset tracking state and start fresh measurement */
  reset(): Promise<void>;
}

/**
 * Feature definition interface.
 * All CDP-based features implement this interface.
 *
 * @template TConfig - Configuration type for the feature (use void for no config)
 * @template TMetrics - Metrics type returned on stop (use void for no metrics)
 */
export interface CDPFeature<TConfig = void, TMetrics = void> {
  /** Unique name identifying this feature */
  readonly name: string;
  /** All CDP features require Chromium */
  readonly requiresChromium: true;
  /**
   * Start the feature with the given configuration.
   * @returns Handle for controlling the feature, or null if not supported
   */
  start(page: Page, config: TConfig): Promise<CDPFeatureHandle<TMetrics> | null>;
}

/**
 * Internal state tracking for CDP features.
 * Used by feature implementations to manage their CDP session.
 */
export interface CDPFeatureState {
  /** Active CDP session */
  cdpSession: CDPSession;
  /** Playwright page instance */
  page: Page;
  /** Whether the feature is currently active */
  active: boolean;
}

/**
 * Collection of active feature handles.
 * Used by the runner to track and cleanup features.
 */
export type ActiveFeatureHandles = Map<string, CDPFeatureHandle<unknown>>;

/**
 * Result of stopping all features.
 * Maps feature name to its returned metrics (or null).
 */
export type FeatureStopResults = Map<string, unknown>;

/**
 * Feature names for type-safe registry access.
 */
export type FeatureName =
  | 'cpu-throttling'
  | 'network-throttling'
  | 'fps-tracking'
  | 'memory-tracking';
