import { logger } from '../../utils';
import { NETWORK_PRESETS, type NetworkThrottlingConfig } from '../features';
import type { LighthouseMetrics, ResolvedLighthouseConfig } from '../types';

// ============================================
// Types
// ============================================

type LighthouseThrottlingSettings = {
  cpuSlowdownMultiplier: number;
  requestLatencyMs: number;
  downloadThroughputKbps: number;
  uploadThroughputKbps: number;
  rttMs: number;
};

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

type ChromeLauncherModule = {
  launch: (options?: { chromeFlags?: string[] }) => Promise<{ port: number; kill: () => void }>;
};

// ============================================
// Cached Imports (loaded once, reused)
// ============================================

let cachedLighthouse: LighthouseFunction | null = null;
let cachedChromeLauncher: ChromeLauncherModule | null = null;

async function loadDependencies(): Promise<{
  lighthouse: LighthouseFunction;
  chromeLauncher: ChromeLauncherModule;
}> {
  if (cachedLighthouse && cachedChromeLauncher) {
    return { lighthouse: cachedLighthouse, chromeLauncher: cachedChromeLauncher };
  }

  const results = await Promise.allSettled([
    import(/* @vite-ignore */ 'lighthouse'),
    import(/* @vite-ignore */ 'chrome-launcher'),
  ]);

  const [lighthouseResult, chromeLauncherResult] = results;

  const missing: string[] = [];
  if (lighthouseResult.status === 'rejected') missing.push('lighthouse');
  if (chromeLauncherResult.status === 'rejected') missing.push('chrome-launcher');

  if (missing.length > 0) {
    throw new Error(
      `Missing Lighthouse dependencies: ${missing.join(', ')}. ` +
        `Install with: npm install -D ${missing.join(' ')}`,
    );
  }

  cachedLighthouse = (lighthouseResult as PromiseFulfilledResult<{ default: LighthouseFunction }>)
    .value.default;
  cachedChromeLauncher = (chromeLauncherResult as PromiseFulfilledResult<ChromeLauncherModule>)
    .value;

  return { lighthouse: cachedLighthouse, chromeLauncher: cachedChromeLauncher };
}

// ============================================
// Network Throttling Mapping
// ============================================

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

  if (typeof network === 'string' && network in NETWORK_PRESETS) {
    const preset = NETWORK_PRESETS[network];
    return {
      cpuSlowdownMultiplier: cpuRate,
      requestLatencyMs: preset.latency,
      downloadThroughputKbps: (preset.downloadThroughput * 8) / 1024,
      uploadThroughputKbps: (preset.uploadThroughput * 8) / 1024,
      rttMs: preset.latency,
    };
  }

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

// ============================================
// Timeout Wrapper
// ============================================

const DEFAULT_TIMEOUT_MS = 120_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// ============================================
// Main Export
// ============================================

export type RunLighthouseOptions = {
  url: string;
  config: ResolvedLighthouseConfig;
  throttleRate: number;
  networkThrottling?: NetworkThrottlingConfig;
  /** Timeout in ms for the Lighthouse audit. Default: 120000 (2 minutes) */
  timeoutMs?: number;
};

/**
 * Runs a Lighthouse audit using chrome-launcher for a dedicated Chrome instance.
 * Each test gets its own Chrome instance, enabling parallel execution.
 */
export async function runLighthouseAudit({
  url,
  config,
  throttleRate,
  networkThrottling,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RunLighthouseOptions): Promise<LighthouseMetrics | null> {
  if (!config.enabled) {
    return null;
  }

  logger.info(`Running Lighthouse audit on ${url}...`);

  const { lighthouse, chromeLauncher } = await loadDependencies();

  const chromeFlags = config.chromeFlags ?? ['--headless', '--no-sandbox', '--disable-gpu'];
  const chrome = await chromeLauncher.launch({ chromeFlags });

  const throttling = mapNetworkToLighthouse(networkThrottling, throttleRate);
  const startTime = Date.now();

  try {
    const isMobile = config.formFactor === 'mobile';

    const auditPromise = lighthouse(url, {
      port: chrome.port,
      output: 'html',
      onlyCategories: config.categories,
      skipAudits: config.skipAudits.length > 0 ? config.skipAudits : undefined,
      formFactor: config.formFactor,
      screenEmulation: { mobile: isMobile },
      throttling,
      disableStorageReset: config.disableStorageReset ?? true,
    });

    const result = await withTimeout(auditPromise, timeoutMs, 'Lighthouse audit');

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
    chrome.kill();
  }
}
