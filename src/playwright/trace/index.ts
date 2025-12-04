// Main functionality
export {
  exportTrace,
  formatTraceForExport,
  generateTraceOutputPath,
  resolveTraceExportConfig,
  startTraceCapture,
  writeTraceFile,
  type TraceHandle,
} from './traceExport';

// Types
export type {
  ResolvedTraceExportConfig,
  TraceCaptureResult,
  TraceEventData,
  TraceExportConfig,
  TraceFormat,
  TraceMetadata,
} from './types';
