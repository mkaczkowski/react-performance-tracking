import type { CDPSession, Page } from '@playwright/test';

import { logger } from '../../utils';

import { featureRegistry } from './registry';
import type { CDPFeatureState, ResettableCDPFeatureHandle } from './types';
import { createResettableFeatureHandle, isCdpUnsupportedError } from './utils';

/** CDP tracing categories for frame events */
const TRACING_CATEGORIES = 'devtools.timeline,disabled-by-default-devtools.timeline.frame';

/** CDP tracing sampling frequency in Hz (10000 = 0.1ms sampling interval) */
const SAMPLING_FREQUENCY_HZ = 10000;

/** Timeout for collecting trace data in milliseconds */
const TRACE_COLLECTION_TIMEOUT_MS = 10000;

/** Minimum duration in ms for reliable FPS metrics */
const MIN_RELIABLE_DURATION_MS = 100;

/**
 * Frame-related trace event names.
 */
const FRAME_EVENT_NAMES = ['BeginMainThreadFrame', 'DrawFrame', 'BeginFrame'] as const;

/**
 * Captured FPS metrics from CDP Tracing.
 */
export interface FPSMetrics {
  /** Average FPS over the tracking period */
  avg: number;
  /** Number of frames rendered during tracking */
  frameCount: number;
  /** Total tracking duration in milliseconds */
  trackingDurationMs: number;
}

/**
 * Raw trace event from CDP.
 */
export interface RawTraceEvent {
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
 * Typed trace event structure from Chrome DevTools Protocol.
 */
export interface TraceEvent {
  name: string;
  cat: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

/**
 * Handle for FPS tracking feature.
 * Inherits stop(), reset(), isActive() from ResettableCDPFeatureHandle.
 */
export type FPSTrackingHandle = ResettableCDPFeatureHandle<FPSMetrics>;

/**
 * Internal state for FPS tracking.
 */
type FPSTrackingState = CDPFeatureState;

/**
 * Converts raw CDP trace event to typed TraceEvent.
 */
export const parseTraceEvent = (raw: RawTraceEvent): TraceEvent => ({
  name: raw.name ?? '',
  cat: raw.cat ?? '',
  ph: raw.ph ?? '',
  ts: Number(raw.ts) || 0,
  dur: raw.dur !== undefined ? Number(raw.dur) : undefined,
  pid: Number(raw.pid) || 0,
  tid: Number(raw.tid) || 0,
  args: raw.args as unknown as Record<string, unknown> | undefined,
});

/**
 * Extracts frame events from trace data.
 * Prioritizes DrawFrame (Visual updates) over BeginMainThreadFrame (Main Thread Work).
 */
export const extractFrameEvents = (traceEvents: TraceEvent[]): TraceEvent[] => {
  const eventsByName = new Map<string, TraceEvent[]>();

  for (const event of traceEvents) {
    if (FRAME_EVENT_NAMES.includes(event.name as (typeof FRAME_EVENT_NAMES)[number])) {
      const existing = eventsByName.get(event.name) || [];
      existing.push(event);
      eventsByName.set(event.name, existing);
    }
  }

  // Priority order: DrawFrame > BeginMainThreadFrame > BeginFrame
  const drawFrames = eventsByName.get('DrawFrame');
  if (drawFrames && drawFrames.length > 0) {
    return drawFrames;
  }

  const mainThreadFrames = eventsByName.get('BeginMainThreadFrame');
  if (mainThreadFrames && mainThreadFrames.length > 0) {
    return mainThreadFrames;
  }

  const beginFrames = eventsByName.get('BeginFrame');
  if (beginFrames && beginFrames.length > 0) {
    logger.warn(
      'FPS tracking: Fell back to BeginFrame events (VSync). Results may not reflect actual rendering smoothness.',
    );
    return beginFrames;
  }

  return [];
};

/**
 * Calculates FPS metrics from frame events using trace timestamps.
 */
export const calculateMetricsFromEvents = (frameEvents: TraceEvent[]): FPSMetrics => {
  if (frameEvents.length < 2) {
    return { avg: 0, frameCount: frameEvents.length, trackingDurationMs: 0 };
  }

  const sortedEvents = [...frameEvents].sort((a, b) => a.ts - b.ts);
  const firstTs = sortedEvents[0].ts;
  const lastTs = sortedEvents[sortedEvents.length - 1].ts;

  // CDP timestamps are in microseconds, convert to milliseconds
  const durationMs = (lastTs - firstTs) / 1000;

  if (durationMs < MIN_RELIABLE_DURATION_MS) {
    logger.warn(
      `FPS tracking: Duration too short (${Math.round(durationMs)}ms) for reliable metrics`,
    );
  }

  const durationSeconds = durationMs / 1000;
  const frameCount = sortedEvents.length;

  // FPS = Intervals / Duration. N frames create N-1 intervals.
  const avg = durationSeconds > 0 ? (frameCount - 1) / durationSeconds : 0;

  return {
    avg: Math.round(avg * 100) / 100,
    frameCount,
    trackingDurationMs: Math.round(durationMs),
  };
};

/**
 * Collects trace data from CDP session with timeout protection.
 */
export const collectTraceData = async (cdpSession: CDPSession): Promise<TraceEvent[]> => {
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
 * Starts tracing on the CDP session.
 */
const startTracing = async (cdpSession: CDPSession): Promise<void> => {
  await cdpSession.send('Tracing.start', {
    categories: TRACING_CATEGORIES,
    options: `sampling-frequency=${SAMPLING_FREQUENCY_HZ}`,
  });
};

/**
 * FPS Tracking feature implementation.
 * Uses CDP Tracing API to track frame events and calculate FPS.
 */
class FPSTrackingFeature {
  readonly name = 'fps-tracking' as const;
  readonly requiresChromium = true as const;

  async start(page: Page): Promise<FPSTrackingHandle | null> {
    try {
      const cdpSession = await page.context().newCDPSession(page);
      await startTracing(cdpSession);

      const state: FPSTrackingState = {
        cdpSession,
        page,
        active: true,
      };

      return createResettableFeatureHandle(state, {
        onStop: async (s) => {
          const traceEvents = await collectTraceData(s.cdpSession);
          const frameEvents = extractFrameEvents(traceEvents);
          return calculateMetricsFromEvents(frameEvents);
        },
        onReset: async (s) => {
          // Stop current trace and discard results
          await collectTraceData(s.cdpSession);
          // Start new trace
          await startTracing(s.cdpSession);
        },
      });
    } catch (error) {
      if (isCdpUnsupportedError(error)) {
        logger.warn('FPS tracking not supported on this browser (CDP not available)');
      } else {
        logger.warn('FPS tracking: failed to start:', error);
      }
      return null;
    }
  }
}

/**
 * FPS tracking feature instance.
 */
export const fpsTrackingFeature = new FPSTrackingFeature();

featureRegistry.register(fpsTrackingFeature);
