import type { Browser, Page } from '@playwright/test';

import { createLogger } from '../utils';

import { assertLighthouseThresholds, attachLighthouseResults } from './lighthouseAssertions';
import { formatThrottling, mapToLighthouseThrottling } from './lighthouseConfig';
import type {
  ConfiguredLighthouseTestInfo,
  LighthouseMetrics,
  LighthouseTestFixtures,
  LighthouseTestFunction,
} from './types';

const logger = createLogger('Lighthouse');

async function isLighthouseAvailable(): Promise<boolean> {
  try {
    await import('lighthouse');
    return true;
  } catch {
    return false;
  }
}

/**
 * Extended Browser type that includes wsEndpoint() method.
 * The wsEndpoint is available at runtime when using chromium.launch()
 * but TypeScript's public API doesn't expose it.
 */
type BrowserWithWsEndpoint = Browser & {
  wsEndpoint(): string;
};

/**
 * Orchestrates Lighthouse test execution.
 * Simpler than PerformanceTestRunner - single audit, no iterations.
 */
export class LighthouseTestRunner {
  constructor(
    private readonly page: Page,
    private readonly fixtures: LighthouseTestFixtures,
    private readonly testInfo: ConfiguredLighthouseTestInfo,
  ) {}

  async execute(testFn: LighthouseTestFunction): Promise<void> {
    this.validateBrowser();

    if (!(await isLighthouseAvailable())) {
      throw new Error('Lighthouse is not installed. Run: npm install -D lighthouse');
    }

    // Execute test function (user navigates to page)
    await testFn(this.fixtures, this.testInfo);

    // Warmup audit if enabled
    if (this.testInfo.warmup) {
      logger.info('Running warmup audit...');
      try {
        await this.runAudit();
      } catch (e) {
        logger.warn('Warmup failed, continuing:', e);
      }
    }

    // Actual audit
    const metrics = await this.runAudit();

    // Assert and attach
    let error: Error | null = null;
    try {
      assertLighthouseThresholds({ metrics, testInfo: this.testInfo });
    } catch (e) {
      error = e as Error;
    }

    try {
      await attachLighthouseResults(this.testInfo, metrics);
    } catch (e) {
      logger.warn('Failed to attach results:', e);
    }

    if (error) throw error;
  }

  private validateBrowser(): void {
    const browserName = this.page.context().browser()?.browserType().name();
    if (browserName !== 'chromium') {
      throw new Error(`Lighthouse requires Chromium. Current: ${browserName ?? 'unknown'}`);
    }
  }

  private async runAudit(): Promise<LighthouseMetrics> {
    const { throttling, categories, formFactor, skipAudits } = this.testInfo;
    const url = this.page.url();

    logger.info(`Auditing ${url}...`);
    logger.info(`Throttling: ${formatThrottling(throttling.cpu, throttling.network)}`);

    const lighthouse = (await import('lighthouse')).default;
    const browser = this.page.context().browser() as BrowserWithWsEndpoint | null;

    if (!browser || typeof browser.wsEndpoint !== 'function') {
      throw new Error(
        'Cannot get browser WebSocket endpoint. ' +
          'Ensure the browser is launched with Playwright (not connected to a remote browser).',
      );
    }

    const port = parseInt(new URL(browser.wsEndpoint()).port, 10);

    const lhThrottling = mapToLighthouseThrottling(throttling.cpu, throttling.network);

    const startTime = Date.now();
    const result = await lighthouse(url, {
      port,
      output: 'json',
      onlyCategories: categories,
      skipAudits: skipAudits.length > 0 ? skipAudits : undefined,
      formFactor,
      throttling: lhThrottling,
      disableStorageReset: true,
    });

    if (!result?.lhr) {
      throw new Error('Lighthouse returned no results');
    }

    const { categories: cats } = result.lhr;
    const metrics: LighthouseMetrics = {
      performance: this.extractScore(cats.performance),
      accessibility: this.extractScore(cats.accessibility),
      bestPractices: this.extractScore(cats['best-practices']),
      seo: this.extractScore(cats.seo),
      pwa: this.extractScore(cats.pwa),
      auditDurationMs: Date.now() - startTime,
      url: result.lhr.finalDisplayedUrl || url,
      timestamp: new Date().toISOString(),
    };

    logger.info(
      `Completed in ${(metrics.auditDurationMs / 1000).toFixed(1)}s: ` +
        `Perf=${metrics.performance ?? 'N/A'}, A11y=${metrics.accessibility ?? 'N/A'}`,
    );

    return metrics;
  }

  private extractScore(category?: { score: number | null }): number | null {
    return category?.score !== null && category?.score !== undefined
      ? Math.round(category.score * 100)
      : null;
  }
}
