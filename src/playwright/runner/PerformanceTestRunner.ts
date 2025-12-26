import type { Page } from '@playwright/test';

import { logger } from '../../utils';
import { assertPerformanceThresholds } from '../assertions/performanceAssertions';
import { type CustomMetrics, hasCustomMetrics } from '../customMetrics';
import { runLighthouseAudit } from '../lighthouse';
import {
  type ActiveFeatureHandles,
  type CDPFeatureHandle,
  cpuThrottlingFeature,
  type CPUThrottlingHandle,
  featureRegistry,
  formatBytes,
  type FPSMetrics,
  fpsTrackingFeature,
  type FPSTrackingHandle,
  type MemoryMetrics,
  memoryTrackingFeature,
  type MemoryTrackingHandle,
  networkThrottlingFeature,
} from '../features';
import {
  aggregateIterationResults,
  type ComponentIterationData,
  type IterationMetrics,
  type IterationResult,
} from '../iterations';
import { attachTestResults } from '../metrics/metricsAttachment';
import {
  type CapturedProfilerState,
  captureProfilerState,
  EMPTY_PROFILER_STATE,
} from '../profiler/profilerState';
import { exportTrace, startTraceCapture, type TraceHandle } from '../trace';
import type {
  BasePerformanceFixtures,
  ConfiguredTestInfo,
  LighthouseMetrics,
  PerformanceTestFixtures,
  PerformanceTestFunction,
} from '../types';
import {
  captureWebVitals,
  injectWebVitalsObserver,
  resetWebVitals,
  type WebVitalsMetrics,
} from '../webVitals';

/**
 * Combined metrics that includes both profiler state and optional iteration data.
 */
export type CombinedMetrics = CapturedProfilerState & {
  iterationMetrics?: IterationMetrics;
  lighthouse?: LighthouseMetrics;
};

/**
 * Orchestrates performance test execution with feature management,
 * warmup runs, metrics collection, iterations, and assertions.
 */
export class PerformanceTestRunner<T extends BasePerformanceFixtures = BasePerformanceFixtures> {
  private handles: ActiveFeatureHandles = new Map();
  private fpsHandle: FPSTrackingHandle | null = null;
  private memoryHandle: MemoryTrackingHandle | null = null;
  private traceHandle: TraceHandle | null = null;
  private lighthouseMetrics: LighthouseMetrics | null = null;
  private capturedMetrics: CombinedMetrics | null = null;
  private testError: unknown | null = null;
  private readonly page: Page;
  private readonly fixtures: PerformanceTestFixtures<T>;
  private readonly testInfo: ConfiguredTestInfo;

  constructor(page: Page, fixtures: PerformanceTestFixtures<T>, testInfo: ConfiguredTestInfo) {
    this.page = page;
    this.fixtures = fixtures;
    this.testInfo = testInfo;
  }

  /** Returns true if profiler thresholds are configured (i.e., profiler samples are required) */
  private hasProfilerThresholds(): boolean {
    return Object.keys(this.testInfo.thresholds.profiler).length > 0;
  }

  /**
   * Executes the complete performance test flow.
   *
   * Warmup behavior:
   * - iterations=1 + warmup=true: Separate warmup run before the actual test
   * - iterations>1 + warmup=true: First iteration is warmup (discarded from averages)
   * - warmup=false: No warmup at all
   */
  async execute(testFn: PerformanceTestFunction<T>): Promise<void> {
    try {
      await this.setup();

      // Run test iterations and capture metrics
      if (this.testInfo.iterations > 1) {
        await this.runMultipleIterations(testFn);
      } else {
        const warmupResult = await this.runWarmupIfEnabled(testFn);
        await this.runSingleIteration(testFn, warmupResult);
      }

      // Run Lighthouse after test completes (if configured)
      await this.runLighthouseIfEnabled();

      // Add Lighthouse metrics to captured metrics
      if (this.capturedMetrics && this.lighthouseMetrics) {
        this.capturedMetrics = {
          ...this.capturedMetrics,
          lighthouse: this.lighthouseMetrics,
        };
      }

      // Run assertions after all metrics are collected
      await this.runAssertionsAndAttach();
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Runs performance assertions and attaches results to test report.
   * Called after all metrics (including Lighthouse) are collected.
   */
  private async runAssertionsAndAttach(): Promise<void> {
    if (!this.capturedMetrics) {
      return;
    }

    let assertionError: unknown | null = null;

    try {
      assertPerformanceThresholds({
        metrics: this.capturedMetrics,
        testInfo: this.testInfo,
      });
    } catch (error) {
      assertionError = error;
    }

    // Always attach results, even if assertions fail
    try {
      await attachTestResults({
        testInfo: this.testInfo,
        metrics: this.capturedMetrics,
      });
    } catch (attachmentError) {
      logger.warn('Failed to attach profiler results:', attachmentError);
    }

    // Throw test error first (from test execution), then assertion error
    if (this.testError) {
      throw this.testError;
    }
    if (assertionError) {
      throw assertionError;
    }
  }

  private async setup(): Promise<void> {
    // Start CPU throttling if configured
    if (this.testInfo.throttleRate > 1) {
      const handle = await cpuThrottlingFeature.start(this.page, {
        rate: this.testInfo.throttleRate,
      });
      if (handle) {
        this.handles.set('cpu-throttling', handle as CDPFeatureHandle<unknown>);
      }
    }

    // Start network throttling if configured
    if (this.testInfo.networkThrottling) {
      const handle = await networkThrottlingFeature.start(
        this.page,
        this.testInfo.networkThrottling,
      );
      if (handle) {
        this.handles.set('network-throttling', handle as CDPFeatureHandle<unknown>);
      }
    }

    // Inject web vitals observer if configured (works in all browsers)
    if (this.testInfo.trackWebVitals) {
      await injectWebVitalsObserver(this.page);
      logger.debug('Web vitals tracking enabled');
    }

    // Start trace capture if configured (Chromium only)
    if (this.testInfo.exportTrace.enabled) {
      this.traceHandle = await startTraceCapture(this.page);
      if (this.traceHandle) {
        logger.debug('Trace capture enabled for flamegraph export');
      }
    }
  }

  /**
   * Executes warmup run if enabled and captures metrics for reference.
   * Returns warmup metrics if warmup was run successfully.
   */
  private async runWarmupIfEnabled(
    testFn: PerformanceTestFunction<T>,
  ): Promise<IterationResult | null> {
    if (!this.testInfo.warmup) {
      return null;
    }

    logger.debug('Starting warmup run...');

    let fpsMetrics: FPSMetrics | null = null;
    let memoryMetrics: MemoryMetrics | null = null;

    await this.startTrackingFeatures();

    try {
      await testFn(this.fixtures, this.testInfo);
      logger.debug('Warmup run completed successfully');
    } catch (error) {
      logger.warn('Warmup run failed (continuing with actual test):', error);
      // Stop tracking but don't capture metrics on failure
      await this.stopFpsTracking();
      await this.stopMemoryTracking();
      this.fixtures.performance.setTrackingHandle('fps-tracking', null);
      this.fixtures.performance.setTrackingHandle('memory-tracking', null);
      await this.page.goto('about:blank').catch(() => {});
      // Re-apply CPU throttling after navigation (CDP session state resets on page navigation)
      await this.reapplyCpuThrottling();
      return null;
    }

    // Capture warmup metrics
    fpsMetrics = await this.stopFpsTracking();
    memoryMetrics = await this.stopMemoryTracking();
    this.fixtures.performance.setTrackingHandle('fps-tracking', null);
    this.fixtures.performance.setTrackingHandle('memory-tracking', null);

    // Skip profiler capture if no profiler thresholds are configured (e.g., Lighthouse-only tests)
    const profilerState = this.hasProfilerThresholds()
      ? await captureProfilerState(this.page)
      : EMPTY_PROFILER_STATE;

    // Convert component metrics to iteration-friendly format
    const components: Record<string, ComponentIterationData> = {};
    if (profilerState.components) {
      for (const [componentId, metrics] of Object.entries(profilerState.components)) {
        components[componentId] = {
          duration: metrics.totalActualDuration,
          rerenders: metrics.renderCount,
        };
      }
    }

    await this.page.goto('about:blank').catch(() => {});
    // Re-apply CPU throttling after navigation
    await this.reapplyCpuThrottling();

    return {
      duration: profilerState.totalActualDuration,
      rerenders: profilerState.sampleCount,
      avg: fpsMetrics?.avg,
      fpsMetrics: fpsMetrics ?? undefined,
      heapGrowth: memoryMetrics?.heapGrowth,
      memoryMetrics: memoryMetrics ?? undefined,
      components: Object.keys(components).length > 0 ? components : undefined,
    };
  }

  /**
   * Executes a single iteration of the test.
   * If warmup was run, includes warmup metrics in iteration data for reference.
   * Stores metrics in capturedMetrics for later assertion.
   */
  private async runSingleIteration(
    testFn: PerformanceTestFunction<T>,
    warmupResult: IterationResult | null,
  ): Promise<void> {
    let fpsMetrics: FPSMetrics | null = null;
    let memoryMetrics: MemoryMetrics | null = null;

    await this.startTrackingFeatures();

    try {
      await testFn(this.fixtures, this.testInfo);
    } catch (error) {
      this.testError = error;
    } finally {
      fpsMetrics = await this.stopFpsTracking();
      memoryMetrics = await this.stopMemoryTracking();
      this.fixtures.performance.setTrackingHandle('fps-tracking', null);
      this.fixtures.performance.setTrackingHandle('memory-tracking', null);
    }

    try {
      const profilerState = await this.captureMetricsWithOptionals(fpsMetrics, memoryMetrics);

      // Build iteration metrics if warmup was run (for reference display)
      if (warmupResult) {
        // Convert component metrics to iteration-friendly format
        const components: Record<string, ComponentIterationData> = {};
        if (profilerState.components) {
          for (const [componentId, compMetrics] of Object.entries(profilerState.components)) {
            components[componentId] = {
              duration: compMetrics.totalActualDuration,
              rerenders: compMetrics.renderCount,
            };
          }
        }

        const actualResult: IterationResult = {
          duration: profilerState.totalActualDuration,
          rerenders: profilerState.sampleCount,
          avg: fpsMetrics?.avg,
          fpsMetrics: fpsMetrics ?? undefined,
          heapGrowth: memoryMetrics?.heapGrowth,
          memoryMetrics: memoryMetrics ?? undefined,
          components: Object.keys(components).length > 0 ? components : undefined,
        };

        // Create iteration metrics with warmup + actual (warmup is discarded from averages)
        const iterationMetrics = aggregateIterationResults(
          [warmupResult, actualResult],
          true, // discardFirst = true (warmup)
        );

        this.capturedMetrics = {
          ...profilerState,
          iterationMetrics,
        };
      } else {
        this.capturedMetrics = profilerState;
      }
    } catch (error) {
      if (!this.testError) {
        this.testError = error;
      } else {
        logger.warn('Failed to capture metrics after prior error:', error);
      }
    }
  }

  /**
   * Executes the test multiple times and aggregates results.
   * When warmup=true, the first iteration is discarded from averages.
   * Stores metrics in capturedMetrics for later assertion.
   */
  private async runMultipleIterations(testFn: PerformanceTestFunction<T>): Promise<void> {
    const { iterations, warmup } = this.testInfo;
    const iterationResults: IterationResult[] = [];

    logger.debug(
      `Running ${iterations} iterations${warmup ? ' (first iteration is warmup)' : ''}...`,
    );

    for (let i = 0; i < iterations; i++) {
      const iterationNumber = i + 1;
      logger.debug(`Iteration ${iterationNumber}/${iterations}...`);

      try {
        const result = await this.runIterationAndCapture(testFn);
        iterationResults.push(result);
      } catch (error) {
        logger.error(`Iteration ${iterationNumber} failed:`, error);
        this.testError = error;
        break;
      }

      if (i < iterations - 1) {
        await this.page.goto('about:blank').catch(() => {});
        // Re-apply CPU throttling after navigation (it may be reset by navigation)
        await this.reapplyCpuThrottling();
        // Reset web vitals for next iteration
        if (this.testInfo.trackWebVitals) {
          await resetWebVitals(this.page).catch(() => {});
        }
      }
    }

    // Only build combined metrics if we have results
    if (iterationResults.length === 0) {
      return;
    }

    const aggregatedMetrics = aggregateIterationResults(iterationResults, warmup);

    const lastResult = iterationResults[iterationResults.length - 1];
    const customMetrics = this.captureCustomMetrics();
    const webVitals = await this.captureWebVitalsIfEnabled();
    this.capturedMetrics = {
      sampleCount: aggregatedMetrics.rerenders,
      totalActualDuration: aggregatedMetrics.duration,
      totalBaseDuration: aggregatedMetrics.duration,
      phaseBreakdown: {},
      components: {},
      fps:
        aggregatedMetrics.avg !== undefined && lastResult?.fpsMetrics
          ? {
              avg: aggregatedMetrics.avg,
              frameCount: lastResult.fpsMetrics.frameCount,
              trackingDurationMs: lastResult.fpsMetrics.trackingDurationMs,
            }
          : undefined,
      iterationMetrics: aggregatedMetrics,
      ...(webVitals && { webVitals }),
      ...(customMetrics && { customMetrics }),
    };
  }

  /**
   * Runs a single iteration and captures its metrics.
   */
  private async runIterationAndCapture(
    testFn: PerformanceTestFunction<T>,
  ): Promise<IterationResult> {
    let fpsMetrics: FPSMetrics | null = null;
    let memoryMetrics: MemoryMetrics | null = null;

    await this.startTrackingFeatures();

    try {
      await testFn(this.fixtures, this.testInfo);
    } finally {
      fpsMetrics = await this.stopFpsTracking();
      memoryMetrics = await this.stopMemoryTracking();
      this.fixtures.performance.setTrackingHandle('fps-tracking', null);
      this.fixtures.performance.setTrackingHandle('memory-tracking', null);
    }

    // Skip profiler capture if no profiler thresholds are configured (e.g., Lighthouse-only tests)
    const profilerState = this.hasProfilerThresholds()
      ? await captureProfilerState(this.page)
      : EMPTY_PROFILER_STATE;

    // Convert component metrics to iteration-friendly format
    const components: Record<string, ComponentIterationData> = {};
    if (profilerState.components) {
      for (const [componentId, metrics] of Object.entries(profilerState.components)) {
        components[componentId] = {
          duration: metrics.totalActualDuration,
          rerenders: metrics.renderCount,
        };
      }
    }

    return {
      duration: profilerState.totalActualDuration,
      rerenders: profilerState.sampleCount,
      avg: fpsMetrics?.avg,
      fpsMetrics: fpsMetrics ?? undefined,
      heapGrowth: memoryMetrics?.heapGrowth,
      memoryMetrics: memoryMetrics ?? undefined,
      components: Object.keys(components).length > 0 ? components : undefined,
    };
  }

  private async startTrackingFeatures(): Promise<void> {
    if (this.testInfo.trackFps) {
      this.fpsHandle = await fpsTrackingFeature.start(this.page);
      if (this.fpsHandle) {
        this.fixtures.performance.setTrackingHandle('fps-tracking', this.fpsHandle);
      }
    }

    if (this.testInfo.trackMemory) {
      this.memoryHandle = await memoryTrackingFeature.start(this.page);
      if (this.memoryHandle) {
        this.fixtures.performance.setTrackingHandle('memory-tracking', this.memoryHandle);
        const initial = this.memoryHandle.getInitialSnapshot();
        logger.debug(
          `Memory tracking enabled (initial heap: ${formatBytes(initial.jsHeapUsedSize)})`,
        );
      }
    }
  }

  private async stopFpsTracking(): Promise<FPSMetrics | null> {
    if (!this.fpsHandle) {
      return null;
    }
    const handle = this.fpsHandle;
    this.fpsHandle = null;
    try {
      return await handle.stop();
    } catch (err) {
      logger.warn('Failed to stop FPS tracking:', err);
      return null;
    }
  }

  private async stopMemoryTracking(): Promise<MemoryMetrics | null> {
    if (!this.memoryHandle) {
      return null;
    }
    const handle = this.memoryHandle;
    this.memoryHandle = null;
    try {
      return await handle.stop();
    } catch (err) {
      logger.warn('Failed to stop memory tracking:', err);
      return null;
    }
  }

  /**
   * Re-applies CPU throttling after page navigation.
   * Navigation may reset CDP emulation state, so throttling needs to be re-applied.
   */
  private async reapplyCpuThrottling(): Promise<void> {
    const cpuHandle = this.handles.get('cpu-throttling') as CPUThrottlingHandle | undefined;
    if (cpuHandle?.isActive()) {
      const success = await cpuHandle.reapply();
      if (!success) {
        logger.warn('Failed to re-apply CPU throttling after navigation');
      }
    }
  }

  private async captureMetricsWithOptionals(
    fpsMetrics: FPSMetrics | null,
    memoryMetrics: MemoryMetrics | null,
  ): Promise<CombinedMetrics> {
    // Skip profiler capture if no profiler thresholds are configured (e.g., Lighthouse-only tests)
    const profilerState = this.hasProfilerThresholds()
      ? await captureProfilerState(this.page)
      : EMPTY_PROFILER_STATE;
    const customMetrics = this.captureCustomMetrics();
    const webVitals = await this.captureWebVitalsIfEnabled();
    return {
      ...profilerState,
      ...(fpsMetrics && { fps: fpsMetrics }),
      ...(memoryMetrics && { memory: memoryMetrics }),
      ...(webVitals && { webVitals }),
      ...(customMetrics && { customMetrics }),
      // Note: lighthouse metrics are added later in execute() after runLighthouseIfEnabled()
    };
  }

  private async captureWebVitalsIfEnabled(): Promise<WebVitalsMetrics | null> {
    if (!this.testInfo.trackWebVitals) {
      return null;
    }
    try {
      return await captureWebVitals(this.page);
    } catch (err) {
      logger.warn('Failed to capture web vitals:', err);
      return null;
    }
  }

  private captureCustomMetrics(): CustomMetrics | null {
    const metrics = this.fixtures.performance.getCustomMetrics();
    return hasCustomMetrics(metrics) ? metrics : null;
  }

  /**
   * Runs Lighthouse audit if configured.
   * Includes optional warmup audit when warmup is enabled.
   */
  private async runLighthouseIfEnabled(): Promise<void> {
    if (!this.testInfo.lighthouse.enabled) {
      return;
    }

    // Run warmup audit if enabled (discarded)
    if (this.testInfo.warmup) {
      logger.debug('Running Lighthouse warmup audit...');
      try {
        await runLighthouseAudit({
          url: this.page.url(),
          config: this.testInfo.lighthouse,
          throttleRate: this.testInfo.throttleRate,
          networkThrottling: this.testInfo.networkThrottling,
        });
      } catch (error) {
        logger.warn('Lighthouse warmup failed, continuing:', error);
      }
    }

    // Run actual audit
    this.lighthouseMetrics = await runLighthouseAudit({
      url: this.page.url(),
      config: this.testInfo.lighthouse,
      throttleRate: this.testInfo.throttleRate,
      networkThrottling: this.testInfo.networkThrottling,
    });
  }

  private async attachIfPresent(metrics: CapturedProfilerState | null): Promise<void> {
    if (!metrics) {
      return;
    }
    try {
      await attachTestResults({
        testInfo: this.testInfo,
        metrics,
      });
    } catch (attachmentError) {
      logger.warn('Failed to attach profiler results:', attachmentError);
    }
  }

  private async cleanup(): Promise<void> {
    // Stop trace capture and export if enabled
    if (this.traceHandle?.isActive()) {
      try {
        const result = await this.traceHandle.stop();
        if (result && this.testInfo.exportTrace.enabled) {
          await exportTrace(result, this.testInfo, this.testInfo.exportTrace);
        }
      } catch (error) {
        logger.warn('Failed to export trace:', error);
      }
      this.traceHandle = null;
    }

    // Stop all throttling features using centralized registry cleanup
    await featureRegistry.stopAll(this.handles);
  }
}
