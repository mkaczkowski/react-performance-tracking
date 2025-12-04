import type { CDPSession, Page, TestInfo } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  exportTrace,
  formatTraceForExport,
  generateTraceOutputPath,
  type ResolvedTraceExportConfig,
  resolveTraceExportConfig,
  startTraceCapture,
  type TraceCaptureResult,
  type TraceEventData,
  writeTraceFile,
} from '@lib/playwright/trace';

import { createMockCDPSession } from '../../../mocks/playwrightMocks';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('traceExport', () => {
  let mockPage: Page;
  let mockCDPSession: CDPSession;
  let mockTestInfo: TestInfo;
  let newCDPSessionMock: Mock;

  beforeEach(() => {
    // Use factory for CDP session
    mockCDPSession = createMockCDPSession();

    newCDPSessionMock = vi.fn().mockResolvedValue(mockCDPSession);

    mockPage = {
      context: () => ({ newCDPSession: newCDPSessionMock }),
    } as unknown as Page;

    mockTestInfo = {
      title: 'Test Performance',
      outputDir: '/test/output',
      attach: vi.fn().mockResolvedValue(undefined),
    } as unknown as TestInfo;
  });

  describe('resolveTraceExportConfig', () => {
    it('should return disabled config when undefined', () => {
      const config = resolveTraceExportConfig(undefined);
      expect(config).toEqual({ enabled: false });
    });

    it('should return disabled config when false', () => {
      const config = resolveTraceExportConfig(false);
      expect(config).toEqual({ enabled: false });
    });

    it('should return enabled config when true', () => {
      const config = resolveTraceExportConfig(true);
      expect(config).toEqual({ enabled: true });
    });

    it('should return enabled config with custom path when string provided', () => {
      const config = resolveTraceExportConfig('/custom/path/trace.json');
      expect(config).toEqual({
        enabled: true,
        outputPath: '/custom/path/trace.json',
      });
    });
  });

  describe('generateTraceOutputPath', () => {
    it('should use custom path when provided', () => {
      const config: ResolvedTraceExportConfig = {
        enabled: true,
        outputPath: '/custom/output/trace.json',
      };

      const result = generateTraceOutputPath(mockTestInfo, config);

      expect(result).toBe('/custom/output/trace.json');
    });

    it('should generate path from test title when no custom path', () => {
      const config: ResolvedTraceExportConfig = { enabled: true };

      const result = generateTraceOutputPath(mockTestInfo, config);

      expect(result).toBe(path.join('/test/output', 'test-performance-trace.json'));
    });

    it('should sanitize test title for filename', () => {
      const testInfoWithSpecialChars = {
        ...mockTestInfo,
        title: 'My Test @#$ With Special Chars!',
        outputDir: '/test/output',
      } as TestInfo;
      const config: ResolvedTraceExportConfig = { enabled: true };

      const result = generateTraceOutputPath(testInfoWithSpecialChars, config);

      expect(result).toBe(path.join('/test/output', 'my-test--with-special-chars-trace.json'));
    });
  });

  describe('formatTraceForExport', () => {
    it('should format events with metadata', () => {
      const events: TraceEventData[] = [
        { name: 'Event1', cat: 'devtools.timeline', ph: 'X', ts: 1000, pid: 1, tid: 1 },
        { name: 'Event2', cat: 'devtools.timeline', ph: 'X', ts: 2000, pid: 1, tid: 1 },
      ];

      const result = formatTraceForExport(events, 'Test Name');

      expect(result.traceEvents).toEqual(events);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.testName).toBe('Test Name');
      expect(result.metadata?.source).toBe('react-performance-tracking');
      expect(result.metadata?.capturedAt).toBeDefined();
    });

    it('should handle empty events array', () => {
      const result = formatTraceForExport([], 'Empty Test');

      expect(result.traceEvents).toEqual([]);
      expect(result.metadata?.testName).toBe('Empty Test');
    });
  });

  describe('writeTraceFile', () => {
    it('should create directory and write file', async () => {
      const traceData = {
        traceEvents: [{ name: 'Event', cat: 'test', ph: 'X', ts: 1000, pid: 1, tid: 1 }],
        metadata: { capturedAt: '2025-01-01', testName: 'Test', source: 'test' },
      };

      await writeTraceFile('/output/dir/trace.json', traceData);

      expect(fs.mkdir).toHaveBeenCalledWith('/output/dir', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/output/dir/trace.json',
        JSON.stringify(traceData, null, 2),
        'utf-8',
      );
    });
  });

  describe('startTraceCapture', () => {
    it('should start tracing and return handle', async () => {
      const handle = await startTraceCapture(mockPage);

      expect(handle).not.toBeNull();
      expect(handle?.isActive()).toBe(true);
      expect(mockCDPSession.send).toHaveBeenCalledWith('Tracing.start', expect.any(Object));
    });

    it('should return null when CDP not available', async () => {
      newCDPSessionMock.mockRejectedValue(new Error('CDP not available'));

      const handle = await startTraceCapture(mockPage);

      expect(handle).toBeNull();
    });

    it('should include appropriate tracing categories', async () => {
      await startTraceCapture(mockPage);

      expect(mockCDPSession.send).toHaveBeenCalledWith(
        'Tracing.start',
        expect.objectContaining({
          categories: expect.stringContaining('devtools.timeline'),
        }),
      );
    });
  });

  describe('TraceHandle', () => {
    it('should stop tracing and return result', async () => {
      const mockEvents = [
        { name: 'Event1', cat: 'test', ph: 'X', ts: 1000, pid: 1, tid: 1 },
        { name: 'Event2', cat: 'test', ph: 'X', ts: 2000, pid: 1, tid: 1 },
      ];

      // Setup mock to trigger tracingComplete
      let tracingCompleteCallback: (() => void) | null = null;
      let dataCollectedCallback: ((params: { value: unknown[] }) => void) | null = null;

      mockCDPSession.on = vi.fn().mockImplementation((event, callback) => {
        if (event === 'Tracing.dataCollected') {
          dataCollectedCallback = callback;
        }
      });

      mockCDPSession.once = vi.fn().mockImplementation((event, callback) => {
        if (event === 'Tracing.tracingComplete') {
          tracingCompleteCallback = callback;
        }
      });

      mockCDPSession.send = vi.fn().mockImplementation((method) => {
        if (method === 'Tracing.end') {
          // Simulate data collection and completion
          setTimeout(() => {
            dataCollectedCallback?.({ value: mockEvents });
            tracingCompleteCallback?.();
          }, 10);
        }
        return Promise.resolve();
      });

      const handle = await startTraceCapture(mockPage);
      expect(handle).not.toBeNull();

      const result = await handle!.stop();

      expect(result).not.toBeNull();
      expect(result?.eventCount).toBe(2);
      expect(result?.events).toHaveLength(2);
    });

    it('should return null when stopped twice', async () => {
      // Setup mock for simple stop
      mockCDPSession.once = vi.fn().mockImplementation((event, callback) => {
        if (event === 'Tracing.tracingComplete') {
          setTimeout(callback, 10);
        }
      });

      const handle = await startTraceCapture(mockPage);
      expect(handle).not.toBeNull();

      await handle!.stop();
      const secondResult = await handle!.stop();

      expect(secondResult).toBeNull();
    });

    it('should report inactive after stop', async () => {
      mockCDPSession.once = vi.fn().mockImplementation((event, callback) => {
        if (event === 'Tracing.tracingComplete') {
          setTimeout(callback, 10);
        }
      });

      const handle = await startTraceCapture(mockPage);
      expect(handle?.isActive()).toBe(true);

      await handle!.stop();

      expect(handle?.isActive()).toBe(false);
    });
  });

  describe('exportTrace', () => {
    it('should export trace to file and attach to test', async () => {
      const result: TraceCaptureResult = {
        events: [{ name: 'Event', cat: 'test', ph: 'X', ts: 1000, pid: 1, tid: 1 }],
        eventCount: 1,
        traceDurationMs: 1000,
      };
      const config: ResolvedTraceExportConfig = { enabled: true };

      const outputPath = await exportTrace(result, mockTestInfo, config);

      expect(outputPath).not.toBeNull();
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockTestInfo.attach).toHaveBeenCalledWith('performance-trace', {
        path: expect.any(String),
        contentType: 'application/json',
      });
    });

    it('should return null when export is disabled', async () => {
      const result: TraceCaptureResult = {
        events: [{ name: 'Event', cat: 'test', ph: 'X', ts: 1000, pid: 1, tid: 1 }],
        eventCount: 1,
        traceDurationMs: 1000,
      };
      const config: ResolvedTraceExportConfig = { enabled: false };

      const outputPath = await exportTrace(result, mockTestInfo, config);

      expect(outputPath).toBeNull();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should return null when no events captured', async () => {
      const result: TraceCaptureResult = {
        events: [],
        eventCount: 0,
        traceDurationMs: 1000,
      };
      const config: ResolvedTraceExportConfig = { enabled: true };

      const outputPath = await exportTrace(result, mockTestInfo, config);

      expect(outputPath).toBeNull();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should use custom output path when provided', async () => {
      const result: TraceCaptureResult = {
        events: [{ name: 'Event', cat: 'test', ph: 'X', ts: 1000, pid: 1, tid: 1 }],
        eventCount: 1,
        traceDurationMs: 1000,
      };
      const config: ResolvedTraceExportConfig = {
        enabled: true,
        outputPath: '/custom/path/trace.json',
      };

      const outputPath = await exportTrace(result, mockTestInfo, config);

      expect(outputPath).toBe('/custom/path/trace.json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/custom/path/trace.json',
        expect.any(String),
        'utf-8',
      );
    });

    it('should handle write errors gracefully', async () => {
      const result: TraceCaptureResult = {
        events: [{ name: 'Event', cat: 'test', ph: 'X', ts: 1000, pid: 1, tid: 1 }],
        eventCount: 1,
        traceDurationMs: 1000,
      };
      const config: ResolvedTraceExportConfig = { enabled: true };

      (fs.writeFile as Mock).mockRejectedValue(new Error('Write failed'));

      const outputPath = await exportTrace(result, mockTestInfo, config);

      expect(outputPath).toBeNull();
    });
  });
});
