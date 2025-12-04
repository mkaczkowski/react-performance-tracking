import type { CDPSession, Page } from '@playwright/test';

import { logger } from '../../utils';

import type { CDPFeatureHandle, CDPFeatureState, ResettableCDPFeatureHandle } from './types';

/**
 * Checks if an error indicates CDP is not supported.
 * Non-Chromium browsers don't support CDP.
 */
export const isCdpUnsupportedError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : '';
  return (
    !!message &&
    /CDP|not available|Protocol error|Target\.setAutoAttach|does not support/i.test(message)
  );
};

/**
 * Safely detaches a CDP session.
 * Silently ignores errors if session is already detached or page is closed.
 */
export const detachCDPSession = async (session: CDPSession): Promise<void> => {
  try {
    await session.detach();
  } catch {
    // Silently ignore - session may already be detached
  }
};

/**
 * Creates a new CDP session for the given page.
 * Returns null if CDP is not supported (non-Chromium browsers).
 *
 * @param page - Playwright page instance
 * @returns CDP session or null if not supported
 */
export const createCDPSession = async (page: Page): Promise<CDPSession | null> => {
  try {
    return await page.context().newCDPSession(page);
  } catch (error) {
    if (isCdpUnsupportedError(error)) {
      return null;
    }
    throw error;
  }
};

/**
 * Options for creating a feature handle.
 */
export interface CreateHandleOptions<TState extends CDPFeatureState, TMetrics> {
  /** Callback to execute when stopping the feature */
  onStop: (state: TState) => Promise<TMetrics | null>;
  /** Optional callback for reset functionality */
  onReset?: (state: TState) => Promise<void>;
}

/**
 * Creates a standard feature handle with consistent lifecycle management.
 * Handles state tracking, CDP session cleanup, and error handling.
 *
 * @param state - Feature state object (must include cdpSession, page, active)
 * @param options - Callbacks for stop and optional reset
 * @returns Feature handle
 */
export function createFeatureHandle<TState extends CDPFeatureState, TMetrics>(
  state: TState,
  options: CreateHandleOptions<TState, TMetrics>,
): CDPFeatureHandle<TMetrics> {
  const { onStop } = options;

  const stop = async (): Promise<TMetrics | null> => {
    if (!state.active) {
      return null;
    }

    try {
      const result = await onStop(state);
      state.active = false;
      await detachCDPSession(state.cdpSession);
      return result;
    } catch (error) {
      logger.error('Feature stop failed:', error);
      state.active = false;
      await detachCDPSession(state.cdpSession);
      return null;
    }
  };

  const isActive = (): boolean => state.active;

  return { stop, isActive };
}

/**
 * Creates a resettable feature handle with reset functionality.
 *
 * @param state - Feature state object
 * @param options - Callbacks for stop and reset
 * @returns Resettable feature handle
 */
export function createResettableFeatureHandle<TState extends CDPFeatureState, TMetrics>(
  state: TState,
  options: Required<CreateHandleOptions<TState, TMetrics>>,
): ResettableCDPFeatureHandle<TMetrics> {
  const baseHandle = createFeatureHandle(state, options);
  const { onReset } = options;

  const reset = async (): Promise<void> => {
    if (!state.active) {
      return;
    }

    try {
      await onReset(state);
    } catch (error) {
      logger.warn('Feature reset failed:', error);
      state.active = false;
      await detachCDPSession(state.cdpSession);
    }
  };

  return { ...baseHandle, reset };
}

/**
 * Wraps a CDP operation with error handling for unsupported browsers.
 * Logs a warning and returns null if CDP is not available.
 *
 * @param page - Playwright page instance
 * @param featureName - Name of the feature for logging
 * @param operation - Async function that uses the CDP session
 * @returns Result of operation or null if CDP unavailable
 */
export async function withCDPSession<T>(
  page: Page,
  featureName: string,
  operation: (session: CDPSession) => Promise<T>,
): Promise<T | null> {
  try {
    const session = await page.context().newCDPSession(page);
    return await operation(session);
  } catch (error) {
    if (isCdpUnsupportedError(error)) {
      logger.warn(`${featureName} not supported on this browser (CDP not available)`);
      return null;
    }
    logger.error(`${featureName}: unexpected error:`, error);
    throw error;
  }
}

/**
 * Safely sends a CDP command, ignoring errors.
 * Useful for cleanup operations where the session may already be closed.
 *
 * @param session - CDP session
 * @param method - CDP method name
 * @param params - Optional parameters for the method
 * @returns true if successful, false if failed
 */
export async function safeCDPSend(
  session: CDPSession,
  method: string,
  params?: Record<string, unknown>,
): Promise<boolean> {
  try {
    await session.send(method as Parameters<CDPSession['send']>[0], params);
    return true;
  } catch {
    // Silently ignore - page/browser may already be closed
    return false;
  }
}
