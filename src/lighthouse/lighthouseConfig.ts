import type { TestInfo } from '@playwright/test';

import { PERFORMANCE_CONFIG } from '../playwright/config/performanceConfig';
import { NETWORK_PRESETS, type NetworkPreset } from '../playwright/features';

import type {
  ConfiguredLighthouseTestInfo,
  LighthouseBufferConfig,
  LighthouseCategoryId,
  LighthouseNetworkThrottling,
  LighthouseTestConfig,
  LighthouseThresholdConfig,
  LighthouseThresholds,
  ResolvedLighthouseBufferConfig,
  ResolvedLighthouseTestConfig,
  ResolvedLighthouseThresholds,
} from './types';

// ============================================
// Defaults
// ============================================

const DEFAULT_CPU_THROTTLE = 4;
const DEFAULT_NETWORK_PRESET: NetworkPreset = 'fast-4g';
const DEFAULT_BUFFER_PERCENT = 5;

const DEFAULT_CATEGORIES: LighthouseCategoryId[] = [
  'performance',
  'accessibility',
  'best-practices',
  'seo',
];

const DEFAULT_THRESHOLDS: ResolvedLighthouseThresholds = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  pwa: 0,
};

const DEFAULT_BUFFERS: ResolvedLighthouseBufferConfig = {
  performance: DEFAULT_BUFFER_PERCENT,
  accessibility: DEFAULT_BUFFER_PERCENT,
  bestPractices: DEFAULT_BUFFER_PERCENT,
  seo: DEFAULT_BUFFER_PERCENT,
  pwa: DEFAULT_BUFFER_PERCENT,
};

// ============================================
// Resolution Functions
// ============================================

function isShorthandThresholds(
  thresholds: LighthouseThresholds | LighthouseThresholdConfig,
): thresholds is LighthouseThresholds {
  return !('base' in thresholds);
}

export function resolveThresholds(
  config: LighthouseThresholds | LighthouseThresholdConfig,
): ResolvedLighthouseThresholds {
  const normalized = isShorthandThresholds(config) ? { base: config } : config;
  const merged = PERFORMANCE_CONFIG.isCI
    ? { ...normalized.base, ...normalized.ci }
    : normalized.base;

  return {
    performance: merged.performance ?? DEFAULT_THRESHOLDS.performance,
    accessibility: merged.accessibility ?? DEFAULT_THRESHOLDS.accessibility,
    bestPractices: merged.bestPractices ?? DEFAULT_THRESHOLDS.bestPractices,
    seo: merged.seo ?? DEFAULT_THRESHOLDS.seo,
    pwa: merged.pwa ?? DEFAULT_THRESHOLDS.pwa,
  };
}

export function resolveBuffers(buffers?: LighthouseBufferConfig): ResolvedLighthouseBufferConfig {
  return {
    performance: buffers?.performance ?? DEFAULT_BUFFERS.performance,
    accessibility: buffers?.accessibility ?? DEFAULT_BUFFERS.accessibility,
    bestPractices: buffers?.bestPractices ?? DEFAULT_BUFFERS.bestPractices,
    seo: buffers?.seo ?? DEFAULT_BUFFERS.seo,
    pwa: buffers?.pwa ?? DEFAULT_BUFFERS.pwa,
  };
}

function generateArtifactName(title: string): string {
  return `lighthouse-${title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}`;
}

export function resolveConfig(
  config: LighthouseTestConfig,
  testTitle: string,
): ResolvedLighthouseTestConfig {
  return {
    throttling: {
      cpu: config.throttling?.cpu ?? DEFAULT_CPU_THROTTLE,
      network: config.throttling?.network ?? DEFAULT_NETWORK_PRESET,
    },
    thresholds: resolveThresholds(config.thresholds),
    buffers: resolveBuffers(config.buffers),
    categories: config.categories ?? DEFAULT_CATEGORIES,
    formFactor: config.formFactor ?? 'mobile',
    warmup: config.warmup ?? PERFORMANCE_CONFIG.isCI,
    name: config.name ?? generateArtifactName(testTitle),
    skipAudits: config.skipAudits ?? [],
  };
}

export function createConfiguredTestInfo(
  testInfo: TestInfo,
  config: LighthouseTestConfig,
  testTitle: string,
): ConfiguredLighthouseTestInfo {
  const resolved = resolveConfig(config, testTitle);
  const configured = Object.create(testInfo) as ConfiguredLighthouseTestInfo;
  Object.assign(configured, resolved);
  return configured;
}

// ============================================
// Throttling Mapping (Reuses NETWORK_PRESETS)
// ============================================

export interface LighthouseThrottlingSettings {
  cpuSlowdownMultiplier: number;
  requestLatencyMs: number;
  downloadThroughputKbps: number;
  uploadThroughputKbps: number;
  rttMs: number;
}

function isNetworkPreset(network: LighthouseNetworkThrottling): network is NetworkPreset {
  return typeof network === 'string' && network in NETWORK_PRESETS;
}

export function mapToLighthouseThrottling(
  cpu: number,
  network: LighthouseNetworkThrottling,
): LighthouseThrottlingSettings {
  if (isNetworkPreset(network)) {
    const preset = NETWORK_PRESETS[network];
    return {
      cpuSlowdownMultiplier: cpu,
      requestLatencyMs: preset.latency,
      // Convert bytes/sec to Kbps: (bytes/s * 8) / 1024
      downloadThroughputKbps: (preset.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (preset.uploadThroughput * 8) / 1024,
      rttMs: preset.latency,
    };
  }

  // Custom network conditions (already in Kbps)
  return {
    cpuSlowdownMultiplier: cpu,
    requestLatencyMs: network.latencyMs,
    downloadThroughputKbps: network.downloadKbps,
    uploadThroughputKbps: network.uploadKbps,
    rttMs: network.latencyMs,
  };
}

export function formatThrottling(cpu: number, network: LighthouseNetworkThrottling): string {
  const networkStr = typeof network === 'string' ? network : `${network.downloadKbps}Kbps`;
  return `CPU ${cpu}x, Network: ${networkStr}`;
}
