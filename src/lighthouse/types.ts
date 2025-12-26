import type { Page, TestInfo } from '@playwright/test';

import type { NetworkPreset } from '../playwright/features';

// ============================================
// Score & Metric Types
// ============================================

/** Lighthouse score (0-100) */
export type LighthouseScore = number;

/** Lighthouse audit category identifiers */
export type LighthouseCategoryId =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'pwa';

/** Lighthouse audit results */
export type LighthouseMetrics = {
  performance: LighthouseScore | null;
  accessibility: LighthouseScore | null;
  bestPractices: LighthouseScore | null;
  seo: LighthouseScore | null;
  pwa: LighthouseScore | null;
  auditDurationMs: number;
  url: string;
  timestamp: string;
};

// ============================================
// Throttling Types (Reuses NetworkPreset)
// ============================================

/** Custom network conditions for Lighthouse */
export type LighthouseNetworkConditions = {
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
};

/** Network throttling - reuses existing presets or custom */
export type LighthouseNetworkThrottling = NetworkPreset | LighthouseNetworkConditions;

/** Throttling configuration */
export type LighthouseThrottlingConfig = {
  cpu?: number;
  network?: LighthouseNetworkThrottling;
};

// ============================================
// Threshold Types
// ============================================

export type LighthouseThresholds = {
  performance?: LighthouseScore;
  accessibility?: LighthouseScore;
  bestPractices?: LighthouseScore;
  seo?: LighthouseScore;
  pwa?: LighthouseScore;
};

export type ResolvedLighthouseThresholds = Required<LighthouseThresholds>;

export type LighthouseThresholdConfig = {
  base: LighthouseThresholds;
  ci?: Partial<LighthouseThresholds>;
};

// ============================================
// Buffer Types
// ============================================

export type LighthouseBufferConfig = {
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  pwa?: number;
};

export type ResolvedLighthouseBufferConfig = Required<LighthouseBufferConfig>;

// ============================================
// Test Configuration
// ============================================

export type LighthouseTestConfig = {
  throttling?: LighthouseThrottlingConfig;
  thresholds: LighthouseThresholds | LighthouseThresholdConfig;
  buffers?: LighthouseBufferConfig;
  categories?: LighthouseCategoryId[];
  formFactor?: 'mobile' | 'desktop';
  warmup?: boolean;
  name?: string;
  skipAudits?: string[];
};

export type ResolvedLighthouseTestConfig = {
  throttling: Required<LighthouseThrottlingConfig>;
  thresholds: ResolvedLighthouseThresholds;
  buffers: ResolvedLighthouseBufferConfig;
  categories: LighthouseCategoryId[];
  formFactor: 'mobile' | 'desktop';
  warmup: boolean;
  name: string;
  skipAudits: string[];
};

// ============================================
// Test Function Types
// ============================================

export type LighthouseTestFixtures = {
  page: Page;
};

export type LighthouseTestFunction = (
  fixtures: LighthouseTestFixtures,
  testInfo: ConfiguredLighthouseTestInfo,
) => Promise<void> | void;

export type ConfiguredLighthouseTestInfo = TestInfo & ResolvedLighthouseTestConfig;
