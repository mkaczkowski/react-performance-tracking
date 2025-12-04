/**
 * Configuration for trace export.
 * Can be a boolean (auto-generated filename) or string (custom path).
 */
export type TraceExportConfig = boolean | string;

/**
 * Resolved trace export configuration.
 */
export type ResolvedTraceExportConfig = {
  /** Whether trace export is enabled */
  enabled: boolean;
  /** Output path for the trace file (undefined = auto-generate based on test name) */
  outputPath?: string;
};

/**
 * Chrome DevTools trace format for flamegraph visualization.
 * Compatible with Chrome DevTools Performance panel import.
 */
export interface TraceFormat {
  /** Trace events array */
  traceEvents: TraceEventData[];
  /** Metadata about the trace */
  metadata?: TraceMetadata;
}

/**
 * Metadata included in trace export.
 */
export interface TraceMetadata {
  /** Timestamp when trace was captured */
  capturedAt: string;
  /** Test name for identification */
  testName: string;
  /** Library identification */
  source: string;
}

/**
 * Individual trace event data structure.
 * Follows Chrome Trace Event Format specification.
 */
export interface TraceEventData {
  /** Event name */
  name: string;
  /** Category (comma-separated list) */
  cat: string;
  /** Phase: 'B' (begin), 'E' (end), 'X' (complete), 'I' (instant), etc. */
  ph: string;
  /** Timestamp in microseconds */
  ts: number;
  /** Duration in microseconds (for complete events) */
  dur?: number;
  /** Process ID */
  pid: number;
  /** Thread ID */
  tid: number;
  /** Additional arguments */
  args?: Record<string, unknown>;
}

/**
 * Result of trace capture.
 */
export interface TraceCaptureResult {
  /** Raw trace events captured from CDP */
  events: TraceEventData[];
  /** Number of events captured */
  eventCount: number;
  /** Duration of trace in milliseconds */
  traceDurationMs: number;
}
