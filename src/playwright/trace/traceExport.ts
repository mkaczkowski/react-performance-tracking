import type { CDPSession, Page, TestInfo } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

import { logger } from '../../utils';
import { createCDPSession, detachCDPSession, isCdpUnsupportedError } from '../features/utils';

import type {
  ResolvedTraceExportConfig,
  TraceCaptureResult,
  TraceEventData,
  TraceFormat,
  TraceMetadata,
} from './types';

/**
 * CDP tracing categories for comprehensive flamegraph capture.
 * Includes devtools.timeline for rendering events and v8 categories for JavaScript profiling.
 */
const FLAMEGRAPH_TRACING_CATEGORIES = [
  'devtools.timeline',
  'v8.execute',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-v8.cpu_profiler',
].join(',');

/** Sampling frequency for trace capture (10000 Hz = 0.1ms intervals) */
const SAMPLING_FREQUENCY_HZ = 10000;

/** Timeout for trace data collection */
const TRACE_COLLECTION_TIMEOUT_MS = 30000;

/**
 * Raw trace event from CDP before parsing.
 */
interface RawTraceEvent {
  name?: string;
  cat?: string;
  ph?: string;
  ts?: number | string;
  dur?: number | string;
  pid?: number | string;
  tid?: number | string;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Converts raw CDP trace event to typed TraceEventData.
 */
const parseTraceEvent = (raw: RawTraceEvent): TraceEventData => ({
  name: raw.name ?? '',
  cat: raw.cat ?? '',
  ph: raw.ph ?? '',
  ts: Number(raw.ts) || 0,
  dur: raw.dur !== undefined ? Number(raw.dur) : undefined,
  pid: Number(raw.pid) || 0,
  tid: Number(raw.tid) || 0,
  args: raw.args,
});

/**
 * Internal state for trace capture.
 */
interface TraceState {
  cdpSession: CDPSession;
  active: boolean;
  startTime: number;
}

/**
 * Handle for controlling active trace capture.
 */
export interface TraceHandle {
  /** Stop tracing and return captured events */
  stop(): Promise<TraceCaptureResult | null>;
  /** Check if tracing is active */
  isActive(): boolean;
}

/**
 * Collects trace data from CDP session with timeout protection.
 */
const collectTraceData = async (cdpSession: CDPSession): Promise<TraceEventData[]> => {
  return new Promise((resolve, reject) => {
    const rawEvents: RawTraceEvent[] = [];
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cdpSession.off('Tracing.dataCollected', onDataCollected);
        reject(new Error(`Trace data collection timed out after ${TRACE_COLLECTION_TIMEOUT_MS}ms`));
      }
    }, TRACE_COLLECTION_TIMEOUT_MS);

    const onDataCollected = (params: { value: RawTraceEvent[] }) => {
      rawEvents.push(...params.value);
    };

    cdpSession.on('Tracing.dataCollected', onDataCollected);

    cdpSession.once('Tracing.tracingComplete', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cdpSession.off('Tracing.dataCollected', onDataCollected);
        resolve(rawEvents.map(parseTraceEvent));
      }
    });

    cdpSession.send('Tracing.end').catch((err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cdpSession.off('Tracing.dataCollected', onDataCollected);
        reject(err);
      }
    });
  });
};

/**
 * Starts trace capture for flamegraph export.
 *
 * @param page - Playwright page instance
 * @returns TraceHandle for controlling the trace, or null if CDP not available
 */
export const startTraceCapture = async (page: Page): Promise<TraceHandle | null> => {
  try {
    const cdpSession = await createCDPSession(page);
    if (!cdpSession) {
      logger.warn('Trace capture not supported (CDP not available)');
      return null;
    }

    await cdpSession.send('Tracing.start', {
      categories: FLAMEGRAPH_TRACING_CATEGORIES,
      options: `sampling-frequency=${SAMPLING_FREQUENCY_HZ}`,
    });

    const state: TraceState = {
      cdpSession,
      active: true,
      startTime: Date.now(),
    };

    const stop = async (): Promise<TraceCaptureResult | null> => {
      if (!state.active) {
        return null;
      }

      state.active = false;
      const traceDurationMs = Date.now() - state.startTime;

      try {
        const events = await collectTraceData(state.cdpSession);
        return {
          events,
          eventCount: events.length,
          traceDurationMs,
        };
      } catch (error) {
        logger.error('Failed to collect trace data:', error);
        return null;
      } finally {
        await detachCDPSession(state.cdpSession);
      }
    };

    const isActive = (): boolean => state.active;

    return { stop, isActive };
  } catch (error) {
    if (isCdpUnsupportedError(error)) {
      logger.warn('Trace capture not supported on this browser');
    } else {
      logger.warn('Failed to start trace capture:', error);
    }
    return null;
  }
};

/**
 * Formats trace events into Chrome DevTools compatible format.
 */
export const formatTraceForExport = (events: TraceEventData[], testName: string): TraceFormat => {
  const metadata: TraceMetadata = {
    capturedAt: new Date().toISOString(),
    testName,
    source: 'react-performance-tracking',
  };

  return {
    traceEvents: events,
    metadata,
  };
};

/**
 * Generates output path for trace file.
 */
export const generateTraceOutputPath = (
  testInfo: TestInfo,
  config: ResolvedTraceExportConfig,
): string => {
  if (config.outputPath) {
    return config.outputPath;
  }

  // Generate path based on test name in the test output directory
  const sanitizedName = testInfo.title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return path.join(testInfo.outputDir, `${sanitizedName}-trace.json`);
};

/**
 * Writes trace data to file.
 */
export const writeTraceFile = async (outputPath: string, traceData: TraceFormat): Promise<void> => {
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Write trace file
  await fs.writeFile(outputPath, JSON.stringify(traceData, null, 2), 'utf-8');
};

/**
 * Exports captured trace to a file compatible with Chrome DevTools.
 *
 * @param result - Captured trace result
 * @param testInfo - Playwright TestInfo for path generation
 * @param config - Resolved trace export configuration
 * @returns Path to the exported file, or null on failure
 */
export const exportTrace = async (
  result: TraceCaptureResult,
  testInfo: TestInfo,
  config: ResolvedTraceExportConfig,
): Promise<string | null> => {
  if (!config.enabled || result.eventCount === 0) {
    return null;
  }

  try {
    const outputPath = generateTraceOutputPath(testInfo, config);
    const traceData = formatTraceForExport(result.events, testInfo.title);

    await writeTraceFile(outputPath, traceData);

    logger.info(`Trace exported: ${outputPath} (${result.eventCount} events)`);

    // Attach trace file to test report
    await testInfo.attach('performance-trace', {
      path: outputPath,
      contentType: 'application/json',
    });

    return outputPath;
  } catch (error) {
    logger.error('Failed to export trace:', error);
    return null;
  }
};

/**
 * Resolves trace export configuration from user config.
 */
export const resolveTraceExportConfig = (
  config: boolean | string | undefined,
): ResolvedTraceExportConfig => {
  if (config === undefined || config === false) {
    return { enabled: false };
  }

  if (config === true) {
    return { enabled: true };
  }

  // String path provided
  return {
    enabled: true,
    outputPath: config,
  };
};
