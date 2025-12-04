import type { CDPSession, Page } from '@playwright/test';

import { logger } from '../../utils';

import { featureRegistry } from './registry';
import type { CDPFeature, CDPFeatureHandle, CDPFeatureState } from './types';
import { createFeatureHandle, isCdpUnsupportedError, safeCDPSend } from './utils';

/**
 * Bandwidth in bytes per second.
 * Use -1 to disable throttling for that direction.
 */
export type BytesPerSecond = number;

/**
 * Latency in milliseconds.
 */
export type LatencyMs = number;

/**
 * Custom network condition configuration.
 * Maps to CDP Network.emulateNetworkConditions parameters.
 */
export interface NetworkConditions {
  /** Added latency in milliseconds */
  latency: LatencyMs;
  /** Download speed in bytes per second. Use -1 for no limit. */
  downloadThroughput: BytesPerSecond;
  /** Upload speed in bytes per second. Use -1 for no limit. */
  uploadThroughput: BytesPerSecond;
  /** Whether to simulate being offline */
  offline?: boolean;
}

/**
 * Preset network profile names.
 */
export type NetworkPreset = 'slow-3g' | 'fast-3g' | 'offline' | 'slow-4g' | 'fast-4g';

/**
 * Network throttling configuration.
 * Can be a preset name or custom conditions.
 */
export type NetworkThrottlingConfig = NetworkPreset | NetworkConditions;

/**
 * Resolved network conditions after preset expansion.
 * Offline is always defined (defaulted to false).
 */
export interface ResolvedNetworkConditions extends Omit<NetworkConditions, 'offline'> {
  /** Whether to simulate being offline (always defined) */
  offline: boolean;
  /** The original config (preset name or custom conditions) */
  source: NetworkThrottlingConfig;
}

/**
 * Preset network profiles based on Chrome DevTools presets.
 * Values match Chrome's built-in throttling profiles.
 */
export const NETWORK_PRESETS: Record<NetworkPreset, NetworkConditions> = {
  'slow-3g': {
    latency: 400,
    downloadThroughput: (500 * 1024) / 8, // 500 Kbps = 64 KB/s
    uploadThroughput: (500 * 1024) / 8,
    offline: false,
  },
  'fast-3g': {
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps = 200 KB/s
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps = ~94 KB/s
    offline: false,
  },
  'slow-4g': {
    latency: 100,
    downloadThroughput: (3 * 1024 * 1024) / 8, // 3 Mbps = 375 KB/s
    uploadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps = ~188 KB/s
    offline: false,
  },
  'fast-4g': {
    latency: 20,
    downloadThroughput: (10 * 1024 * 1024) / 8, // 10 Mbps = 1.25 MB/s
    uploadThroughput: (5 * 1024 * 1024) / 8, // 5 Mbps = 625 KB/s
    offline: false,
  },
  offline: {
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    offline: true,
  },
};

/**
 * Checks if a config is a preset name.
 */
export const isNetworkPreset = (config: NetworkThrottlingConfig): config is NetworkPreset =>
  typeof config === 'string' && config in NETWORK_PRESETS;

/**
 * Resolves network throttling config to actual conditions.
 * Expands preset names to their full configuration.
 */
export const resolveNetworkConditions = (
  config: NetworkThrottlingConfig,
): ResolvedNetworkConditions => {
  if (isNetworkPreset(config)) {
    const preset = NETWORK_PRESETS[config];
    return {
      latency: preset.latency,
      downloadThroughput: preset.downloadThroughput,
      uploadThroughput: preset.uploadThroughput,
      offline: preset.offline ?? false,
      source: config,
    };
  }

  return {
    latency: config.latency,
    downloadThroughput: config.downloadThroughput,
    uploadThroughput: config.uploadThroughput,
    offline: config.offline ?? false,
    source: config,
  };
};

/**
 * Formats throughput for logging.
 */
const formatThroughput = (bytesPerSecond: number, direction: 'up' | 'down'): string => {
  if (bytesPerSecond < 0) {
    return `${direction}=unlimited`;
  }

  // Convert bytes/s to Kbps for readability
  const kbps = (bytesPerSecond * 8) / 1024;

  if (kbps >= 1024) {
    return `${direction}=${(kbps / 1024).toFixed(1)} Mbps`;
  }

  return `${direction}=${Math.round(kbps)} Kbps`;
};

/**
 * Formats network conditions for logging.
 */
export const formatNetworkConditions = (conditions: ResolvedNetworkConditions): string => {
  if (conditions.offline) {
    return 'offline';
  }

  const source = isNetworkPreset(conditions.source) ? `${conditions.source}: ` : '';

  const latency = `${conditions.latency}ms latency`;
  const download = formatThroughput(conditions.downloadThroughput, 'down');
  const upload = formatThroughput(conditions.uploadThroughput, 'up');

  return `${source}${latency}, ${download}, ${upload}`;
};

/**
 * Handle for network throttling feature.
 */
export interface NetworkThrottlingHandle extends CDPFeatureHandle {
  /** Get the current network conditions */
  getConditions(): ResolvedNetworkConditions;
}

/**
 * Internal state for network throttling.
 */
interface NetworkThrottlingState extends CDPFeatureState {
  conditions: ResolvedNetworkConditions;
}

/**
 * Network Throttling feature implementation.
 * Uses CDP Network.emulateNetworkConditions to simulate slow networks.
 */
class NetworkThrottlingFeature implements CDPFeature<NetworkThrottlingConfig> {
  readonly name = 'network-throttling' as const;
  readonly requiresChromium = true as const;

  async start(
    page: Page,
    config: NetworkThrottlingConfig,
  ): Promise<NetworkThrottlingHandle | null> {
    const conditions = resolveNetworkConditions(config);

    try {
      const cdpSession = await page.context().newCDPSession(page);

      await cdpSession.send('Network.emulateNetworkConditions', {
        offline: conditions.offline,
        latency: conditions.latency,
        downloadThroughput: conditions.downloadThroughput,
        uploadThroughput: conditions.uploadThroughput,
      });

      logger.info(`Network throttling enabled (${formatNetworkConditions(conditions)})`);

      const state: NetworkThrottlingState = {
        cdpSession,
        page,
        active: true,
        conditions,
      };

      return this.createHandle(state);
    } catch (error) {
      if (isCdpUnsupportedError(error)) {
        logger.warn('Network throttling not supported on this browser (CDP not available)');
        return null;
      }
      logger.error('Unexpected error enabling network throttling:', error);
      throw error;
    }
  }

  private createHandle(state: NetworkThrottlingState): NetworkThrottlingHandle {
    const baseHandle = createFeatureHandle(state, {
      onStop: async (s) => {
        await this.resetThrottling(s.cdpSession);
        return null;
      },
    });

    return {
      ...baseHandle,
      getConditions: () => state.conditions,
    };
  }

  private async resetThrottling(session: CDPSession): Promise<void> {
    // Reset to no throttling (-1 means unlimited)
    await safeCDPSend(session, 'Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
}

/**
 * Network throttling feature instance.
 */
export const networkThrottlingFeature = new NetworkThrottlingFeature();

featureRegistry.register(networkThrottlingFeature);
