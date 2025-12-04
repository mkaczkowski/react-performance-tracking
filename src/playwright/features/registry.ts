import type { Page } from '@playwright/test';

import { logger } from '../../utils';

import type {
  ActiveFeatureHandles,
  CDPFeature,
  CDPFeatureHandle,
  FeatureName,
  FeatureStopResults,
} from './types';

/**
 * Registry for CDP-based features.
 * Provides centralized feature management and discovery.
 */
export class CDPFeatureRegistry {
  private features = new Map<string, CDPFeature<unknown, unknown>>();

  /**
   * Register a feature with the registry.
   * @throws Error if a feature with the same name is already registered
   */
  register<TConfig, TMetrics>(feature: CDPFeature<TConfig, TMetrics>): void {
    if (this.features.has(feature.name)) {
      throw new Error(`Feature "${feature.name}" is already registered`);
    }
    this.features.set(feature.name, feature as CDPFeature<unknown, unknown>);
  }

  /**
   * Get a feature by name.
   * @returns The feature or undefined if not found
   */
  get<TConfig, TMetrics>(name: string): CDPFeature<TConfig, TMetrics> | undefined {
    return this.features.get(name) as CDPFeature<TConfig, TMetrics> | undefined;
  }

  /**
   * Check if a feature is registered.
   */
  has(name: string): boolean {
    return this.features.has(name);
  }

  /**
   * Get all registered feature names.
   */
  getNames(): string[] {
    return Array.from(this.features.keys());
  }

  /**
   * Start a feature by name.
   *
   * @param name - Feature name to start
   * @param page - Playwright page instance
   * @param config - Feature configuration
   * @returns Handle for the started feature, or null if not supported
   * @throws Error if feature is not registered
   */
  async startFeature<TConfig, TMetrics>(
    name: FeatureName | string,
    page: Page,
    config: TConfig,
  ): Promise<CDPFeatureHandle<TMetrics> | null> {
    const feature = this.features.get(name);
    if (!feature) {
      throw new Error(`Feature "${name}" is not registered`);
    }
    return (await feature.start(page, config)) as CDPFeatureHandle<TMetrics> | null;
  }

  /**
   * Stop all active handles and collect their results.
   *
   * @param handles - Map of active feature handles
   * @returns Map of feature names to their stop results
   */
  async stopAll(handles: ActiveFeatureHandles): Promise<FeatureStopResults> {
    const results: FeatureStopResults = new Map();

    const stopPromises = Array.from(handles.entries()).map(async ([name, handle]) => {
      try {
        const result = await handle.stop();
        results.set(name, result);
      } catch (error) {
        logger.warn(`Failed to stop feature "${name}":`, error);
        results.set(name, null);
      }
    });

    await Promise.all(stopPromises);
    handles.clear();

    return results;
  }
}

/**
 * Default feature registry instance.
 * Features are registered here during module initialization.
 */
export const featureRegistry = new CDPFeatureRegistry();
