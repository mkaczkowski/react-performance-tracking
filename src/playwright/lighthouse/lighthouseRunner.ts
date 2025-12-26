import type { Browser, Page } from '@playwright/test';

import { logger } from '../../utils';
import { NETWORK_PRESETS, type NetworkThrottlingConfig } from '../features';
import type { LighthouseMetrics, ResolvedLighthouseConfig } from '../types';

/**
 * Lighthouse throttling settings passed to lighthouse()
 */
type LighthouseThrottlingSettings = {
  cpuSlowdownMultiplier: number;
  requestLatencyMs: number;
  downloadThroughputKbps: number;
  uploadThroughputKbps: number;
  rttMs: number;
};

/**
 * Lighthouse run result type (simplified from lighthouse package)
 */
type LighthouseResult = {
  lhr: {
    categories: {
      performance?: { score: number | null };
      accessibility?: { score: number | null };
      'best-practices'?: { score: number | null };
      seo?: { score: number | null };
      pwa?: { score: number | null };
    };
    finalDisplayedUrl?: string;
  };
};

/**
 * Lighthouse function type for dynamic import
 */
type LighthouseFunction = (
  url: string,
  options: {
    port: number;
    output: string;
    onlyCategories?: string[];
    skipAudits?: string[];
    formFactor?: string;
    throttling?: LighthouseThrottlingSettings;
    disableStorageReset?: boolean;
  },
) => Promise<LighthouseResult | undefined>;

/**
 * Extended Browser type with wsEndpoint method (available in Chromium)
 */
type BrowserWithWsEndpoint = Browser & {
  wsEndpoint(): string;
};

/**
 * Maps our network throttling config to Lighthouse throttling settings.
 * Reuses NETWORK_PRESETS for consistent behavior with network throttling feature.
 */
function mapNetworkToLighthouse(
  network: NetworkThrottlingConfig | undefined,
  cpuRate: number,
): LighthouseThrottlingSettings {
  const baseThrottling: LighthouseThrottlingSettings = {
    cpuSlowdownMultiplier: cpuRate,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
    rttMs: 0,
  };

  if (!network) return baseThrottling;

  // Handle preset names (e.g., 'slow-3g', 'fast-3g', 'fast-4g')
  if (typeof network === 'string' && network in NETWORK_PRESETS) {
    const preset = NETWORK_PRESETS[network];
    return {
      cpuSlowdownMultiplier: cpuRate,
      requestLatencyMs: preset.latency,
      // Convert bytes/sec to Kbps (bytes * 8 / 1024)
      downloadThroughputKbps: (preset.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (preset.uploadThroughput * 8) / 1024,
      rttMs: preset.latency,
    };
  }

  // Handle custom network conditions
  if (typeof network === 'object' && 'downloadThroughput' in network) {
    return {
      cpuSlowdownMultiplier: cpuRate,
      requestLatencyMs: network.latency ?? 0,
      downloadThroughputKbps: (network.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (network.uploadThroughput * 8) / 1024,
      rttMs: network.latency ?? 0,
    };
  }

  return baseThrottling;
}

/**
 * Checks if Lighthouse is available as a dependency.
 * Lighthouse is an optional peer dependency.
 */
async function isLighthouseAvailable(): Promise<boolean> {
  try {
    // Use variable to prevent TypeScript from trying to resolve optional peer dependency
    const moduleName = 'lighthouse';
    await import(/* @vite-ignore */ moduleName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates browser is Chromium (required for Lighthouse).
 * Throws with helpful error message for non-Chromium browsers.
 */
function validateBrowser(page: Page): void {
  const browserName = page.context().browser()?.browserType().name();
  if (browserName !== 'chromium') {
    throw new Error(
      `Lighthouse requires Chromium browser. Current: ${browserName ?? 'unknown'}. ` +
        `Run tests with --project=chromium or remove lighthouse thresholds.`,
    );
  }
}

/**
 * Options for running a Lighthouse audit.
 */
export type RunLighthouseOptions = {
  page: Page;
  config: ResolvedLighthouseConfig;
  throttleRate: number;
  networkThrottling?: NetworkThrottlingConfig;
};

/**
 * Runs a Lighthouse audit on the current page.
 * Returns null if Lighthouse is disabled.
 * Throws if Lighthouse is not installed or browser is not Chromium.
 */
export async function runLighthouseAudit({
  page,
  config,
  throttleRate,
  networkThrottling,
}: RunLighthouseOptions): Promise<LighthouseMetrics | null> {
  if (!config.enabled) {
    return null;
  }

  validateBrowser(page);

  if (!(await isLighthouseAvailable())) {
    throw new Error('Lighthouse is not installed. Install it with: npm install -D lighthouse');
  }

  const url = page.url();
  logger.info(`Running Lighthouse audit on ${url}...`);

  // Dynamic import to avoid bundling lighthouse when not used
  // Use variable to prevent TypeScript from trying to resolve optional peer dependency
  const moduleName = 'lighthouse';
  const lighthouseModule = (await import(/* @vite-ignore */ moduleName)) as {
    default: LighthouseFunction;
  };
  const lighthouse = lighthouseModule.default;
  const browser = page.context().browser() as BrowserWithWsEndpoint;
  const port = parseInt(new URL(browser.wsEndpoint()).port, 10);

  const throttling = mapNetworkToLighthouse(networkThrottling, throttleRate);

  const startTime = Date.now();

  const result = await lighthouse(url, {
    port,
    output: 'json',
    onlyCategories: config.categories,
    skipAudits: config.skipAudits.length > 0 ? config.skipAudits : undefined,
    formFactor: config.formFactor,
    throttling,
    disableStorageReset: true, // Preserve page state (cookies, localStorage, etc.)
  });

  if (!result?.lhr) {
    throw new Error('Lighthouse returned no results');
  }

  const extractScore = (cat?: { score: number | null }): number | null =>
    cat?.score != null ? Math.round(cat.score * 100) : null;

  const { categories } = result.lhr;
  const metrics: LighthouseMetrics = {
    performance: extractScore(categories.performance),
    accessibility: extractScore(categories.accessibility),
    bestPractices: extractScore(categories['best-practices']),
    seo: extractScore(categories.seo),
    pwa: extractScore(categories.pwa),
    auditDurationMs: Date.now() - startTime,
    url: result.lhr.finalDisplayedUrl || url,
  };

  logger.info(
    `Lighthouse completed in ${(metrics.auditDurationMs / 1000).toFixed(1)}s: ` +
      `Performance=${metrics.performance ?? 'N/A'}, ` +
      `Accessibility=${metrics.accessibility ?? 'N/A'}`,
  );

  return metrics;
}
