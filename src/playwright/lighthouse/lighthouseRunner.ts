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
    screenEmulation?: { mobile: boolean };
    throttling?: LighthouseThrottlingSettings;
    disableStorageReset?: boolean;
  },
) => Promise<LighthouseResult | undefined>;

/**
 * Chrome launcher type for dynamic import
 */
type ChromeLauncherModule = {
  launch: (options?: { chromeFlags?: string[] }) => Promise<{ port: number; kill: () => void }>;
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
 * Checks if Lighthouse and chrome-launcher are available.
 * Both are optional peer dependencies.
 */
export async function areLighthouseDependenciesAvailable(): Promise<{
  available: boolean;
  missing: string[];
}> {
  const missing: string[] = [];

  try {
    await import(/* @vite-ignore */ 'lighthouse');
  } catch {
    missing.push('lighthouse');
  }

  try {
    await import(/* @vite-ignore */ 'chrome-launcher');
  } catch {
    missing.push('chrome-launcher');
  }

  return { available: missing.length === 0, missing };
}

/**
 * Options for running a Lighthouse audit.
 */
export type RunLighthouseOptions = {
  url: string;
  config: ResolvedLighthouseConfig;
  throttleRate: number;
  networkThrottling?: NetworkThrottlingConfig;
};

/**
 * Runs a Lighthouse audit using chrome-launcher for a dedicated Chrome instance.
 * This approach allows parallel test execution since each test gets its own Chrome.
 *
 * Best practice from Lighthouse docs: Launch Chrome with chrome-launcher,
 * then run Lighthouse with the port. This ensures clean, isolated audits.
 */
export async function runLighthouseAudit({
  url,
  config,
  throttleRate,
  networkThrottling,
}: RunLighthouseOptions): Promise<LighthouseMetrics | null> {
  if (!config.enabled) {
    return null;
  }

  const { available, missing } = await areLighthouseDependenciesAvailable();
  if (!available) {
    throw new Error(
      `Missing Lighthouse dependencies: ${missing.join(', ')}. ` +
        `Install with: npm install -D ${missing.join(' ')}`,
    );
  }

  logger.info(`Running Lighthouse audit on ${url}...`);

  // Dynamic imports for optional dependencies
  const [lighthouseModule, chromeLauncherModule] = await Promise.all([
    import(/* @vite-ignore */ 'lighthouse') as Promise<{ default: LighthouseFunction }>,
    import(/* @vite-ignore */ 'chrome-launcher') as Promise<ChromeLauncherModule>,
  ]);

  const lighthouse = lighthouseModule.default;

  // Launch a dedicated Chrome instance for Lighthouse
  // This ensures clean audits and allows parallel test execution
  const chrome = await chromeLauncherModule.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });

  const throttling = mapNetworkToLighthouse(networkThrottling, throttleRate);
  const startTime = Date.now();

  try {
    // Screen emulation must match formFactor setting
    const isMobile = config.formFactor === 'mobile';

    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: config.categories,
      skipAudits: config.skipAudits.length > 0 ? config.skipAudits : undefined,
      formFactor: config.formFactor,
      screenEmulation: { mobile: isMobile },
      throttling,
      disableStorageReset: true,
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
  } finally {
    // Always clean up the Chrome instance
    chrome.kill();
  }
}
