import type { CDPSession, Page } from '@playwright/test';

import { logger } from '../../utils';
import { PERFORMANCE_CONFIG } from '../config/performanceConfig';

import { featureRegistry } from './registry';
import type { CDPFeature, CDPFeatureHandle, CDPFeatureState } from './types';
import { createFeatureHandle, isCdpUnsupportedError, safeCDPSend } from './utils';

/**
 * Configuration for CPU throttling.
 */
export interface CPUThrottlingConfig {
  /** CPU throttle rate (1 = no throttling, 4 = 4x slower) */
  rate: number;
}

/**
 * Handle for CPU throttling feature.
 */
export interface CPUThrottlingHandle extends CDPFeatureHandle {
  /** Get the current throttle rate */
  getRate(): number;
  /** Re-apply the throttle rate (useful after navigation) */
  reapply(): Promise<boolean>;
}

/**
 * Internal state for CPU throttling.
 */
interface CPUThrottlingState extends CDPFeatureState {
  rate: number;
}

/**
 * CPU Throttling feature implementation.
 * Uses CDP Emulation.setCPUThrottlingRate to simulate slower CPUs.
 */
class CPUThrottlingFeature implements CDPFeature<CPUThrottlingConfig> {
  readonly name = 'cpu-throttling' as const;
  readonly requiresChromium = true as const;

  async start(page: Page, config: CPUThrottlingConfig): Promise<CPUThrottlingHandle | null> {
    const rate = config.rate ?? PERFORMANCE_CONFIG.throttling.defaultRate;

    // Rate 1 = no throttling, < 1 is invalid
    if (rate <= 1) {
      return null;
    }

    try {
      const cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send('Emulation.setCPUThrottlingRate', { rate });

      const state: CPUThrottlingState = {
        cdpSession,
        page,
        active: true,
        rate,
      };

      return this.createHandle(state);
    } catch (error) {
      if (isCdpUnsupportedError(error)) {
        logger.warn('CPU throttling not supported on this browser (CDP not available)');
        return null;
      }
      logger.error('Unexpected error enabling CPU throttling:', error);
      throw error;
    }
  }

  private createHandle(state: CPUThrottlingState): CPUThrottlingHandle {
    const baseHandle = createFeatureHandle(state, {
      onStop: async (s) => {
        await this.setThrottleRate(s.cdpSession, 1);
        return null;
      },
    });

    return {
      ...baseHandle,
      getRate: () => state.rate,
      reapply: async () => {
        if (!state.active) {
          return false;
        }
        return this.setThrottleRate(state.cdpSession, state.rate);
      },
    };
  }

  private setThrottleRate(session: CDPSession, rate: number): Promise<boolean> {
    return safeCDPSend(session, 'Emulation.setCPUThrottlingRate', { rate });
  }
}

/**
 * CPU throttling feature instance.
 */
export const cpuThrottlingFeature = new CPUThrottlingFeature();

featureRegistry.register(cpuThrottlingFeature);
