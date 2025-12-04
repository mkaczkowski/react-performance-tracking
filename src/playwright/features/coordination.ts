import type { ResettableCDPFeatureHandle } from './types';

/**
 * Interface for coordinating feature handle resets.
 * Used to synchronize tracking feature resets with profiler resets.
 */
export interface FeatureCoordination {
  /**
   * Register a handle for a feature.
   * Pass null to unregister.
   */
  setHandle(name: string, handle: ResettableCDPFeatureHandle<unknown> | null): void;

  /**
   * Get a registered handle by name.
   */
  getHandle<T>(name: string): ResettableCDPFeatureHandle<T> | null;

  /**
   * Reset a specific feature if it's active.
   * @returns true if the feature was reset, false otherwise
   */
  resetIfActive(name: string): Promise<boolean>;

  /**
   * Reset all active features.
   * @returns Names of features that were reset
   */
  resetAllActive(): Promise<string[]>;

  /**
   * Clear all registered handles.
   */
  clear(): void;
}

/**
 * Creates a feature coordination instance.
 * Used to synchronize tracking feature resets with profiler resets.
 *
 * This replaces the FPS-specific coordination with a generic pattern
 * that supports all tracking features (FPS, Memory, future features).
 */
export const createFeatureCoordination = (): FeatureCoordination => {
  const handles = new Map<string, ResettableCDPFeatureHandle<unknown>>();

  const setHandle = (name: string, handle: ResettableCDPFeatureHandle<unknown> | null): void => {
    if (handle === null) {
      handles.delete(name);
    } else {
      handles.set(name, handle);
    }
  };

  const getHandle = <T>(name: string): ResettableCDPFeatureHandle<T> | null => {
    return (handles.get(name) as ResettableCDPFeatureHandle<T>) ?? null;
  };

  const resetIfActive = async (name: string): Promise<boolean> => {
    const handle = handles.get(name);
    if (handle?.isActive()) {
      await handle.reset();
      return true;
    }
    return false;
  };

  const resetAllActive = async (): Promise<string[]> => {
    const resetNames: string[] = [];

    const resetPromises = Array.from(handles.entries()).map(async ([name, handle]) => {
      if (handle.isActive()) {
        await handle.reset();
        resetNames.push(name);
      }
    });

    await Promise.all(resetPromises);
    return resetNames;
  };

  const clear = (): void => {
    handles.clear();
  };

  return {
    setHandle,
    getHandle,
    resetIfActive,
    resetAllActive,
    clear,
  };
};

export type { FeatureCoordination as FpsCoordination };
