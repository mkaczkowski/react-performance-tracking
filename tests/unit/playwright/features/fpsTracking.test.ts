import { describe, expect, it, vi } from 'vitest';

import {
  calculateMetricsFromEvents,
  extractFrameEvents,
  fpsTrackingFeature,
  parseTraceEvent,
  type RawTraceEvent,
  type TraceEvent,
} from '@/playwright/features/fpsTracking';
import {
  createMockCDPSession,
  createMockPage,
  createMockTraceEvents,
} from '../../../mocks/playwrightMocks';

describe('fpsTracking', () => {
  describe('parseTraceEvent', () => {
    it('should parse a complete raw trace event', () => {
      const raw: RawTraceEvent = {
        name: 'DrawFrame',
        cat: 'devtools.timeline',
        ph: 'I',
        ts: 1000000,
        dur: 500,
        pid: 123,
        tid: 456,
        args: { frameId: 'abc' },
      };

      const result = parseTraceEvent(raw);

      expect(result).toEqual({
        name: 'DrawFrame',
        cat: 'devtools.timeline',
        ph: 'I',
        ts: 1000000,
        dur: 500,
        pid: 123,
        tid: 456,
        args: { frameId: 'abc' },
      });
    });

    it('should handle missing fields with defaults', () => {
      const raw: RawTraceEvent = {};

      const result = parseTraceEvent(raw);

      expect(result).toEqual({
        name: '',
        cat: '',
        ph: '',
        ts: 0,
        dur: undefined,
        pid: 0,
        tid: 0,
        args: undefined,
      });
    });

    it('should convert string numbers to numbers', () => {
      const raw: RawTraceEvent = {
        ts: '1000000',
        dur: '500',
        pid: '123',
        tid: '456',
      };

      const result = parseTraceEvent(raw);

      expect(result.ts).toBe(1000000);
      expect(result.dur).toBe(500);
      expect(result.pid).toBe(123);
      expect(result.tid).toBe(456);
    });
  });

  describe('extractFrameEvents', () => {
    const createEvent = (name: string, ts: number): TraceEvent => ({
      name,
      cat: 'devtools.timeline',
      ph: 'I',
      ts,
      pid: 1,
      tid: 1,
    });

    it('should prioritize DrawFrame events', () => {
      const events: TraceEvent[] = [
        createEvent('DrawFrame', 1000),
        createEvent('DrawFrame', 2000),
        createEvent('BeginMainThreadFrame', 1500),
        createEvent('BeginFrame', 500),
      ];

      const result = extractFrameEvents(events);

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.name === 'DrawFrame')).toBe(true);
    });

    it('should fall back to BeginMainThreadFrame if no DrawFrame', () => {
      const events: TraceEvent[] = [
        createEvent('BeginMainThreadFrame', 1000),
        createEvent('BeginMainThreadFrame', 2000),
        createEvent('BeginFrame', 500),
      ];

      const result = extractFrameEvents(events);

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.name === 'BeginMainThreadFrame')).toBe(true);
    });

    it('should fall back to BeginFrame if no higher priority events', () => {
      const events: TraceEvent[] = [
        createEvent('BeginFrame', 1000),
        createEvent('BeginFrame', 2000),
        createEvent('SomeOtherEvent', 500),
      ];

      const result = extractFrameEvents(events);

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.name === 'BeginFrame')).toBe(true);
    });

    it('should return empty array if no frame events', () => {
      const events: TraceEvent[] = [
        createEvent('SomeOtherEvent', 1000),
        createEvent('AnotherEvent', 2000),
      ];

      const result = extractFrameEvents(events);

      expect(result).toEqual([]);
    });

    it('should filter out non-frame events', () => {
      const events: TraceEvent[] = [
        createEvent('DrawFrame', 1000),
        createEvent('Paint', 1100),
        createEvent('Layout', 1200),
        createEvent('DrawFrame', 2000),
      ];

      const result = extractFrameEvents(events);

      expect(result).toHaveLength(2);
    });
  });

  describe('calculateMetricsFromEvents', () => {
    const createEvent = (ts: number): TraceEvent => ({
      name: 'DrawFrame',
      cat: 'devtools.timeline',
      ph: 'I',
      ts,
      pid: 1,
      tid: 1,
    });

    it('should return zero metrics for empty array', () => {
      const result = calculateMetricsFromEvents([]);

      expect(result).toEqual({
        avg: 0,
        frameCount: 0,
        trackingDurationMs: 0,
      });
    });

    it('should return zero metrics for single frame', () => {
      const result = calculateMetricsFromEvents([createEvent(1000000)]);

      expect(result).toEqual({
        avg: 0,
        frameCount: 1,
        trackingDurationMs: 0,
      });
    });

    it('should calculate 60 FPS correctly', () => {
      // 60 FPS = ~16.67ms per frame = 16667 microseconds
      // For 60 FPS over 1 second: 61 frames, 60 intervals
      const events: TraceEvent[] = [];
      for (let i = 0; i < 61; i++) {
        events.push(createEvent(i * 16667)); // ~60 FPS timing
      }

      const result = calculateMetricsFromEvents(events);

      // Duration should be ~1000ms
      expect(result.trackingDurationMs).toBeCloseTo(1000, -1);
      // FPS should be ~60
      expect(result.avg).toBeCloseTo(60, 0);
      expect(result.frameCount).toBe(61);
    });

    it('should calculate 30 FPS correctly', () => {
      // 30 FPS = ~33.33ms per frame = 33333 microseconds
      const events: TraceEvent[] = [];
      for (let i = 0; i < 31; i++) {
        events.push(createEvent(i * 33333));
      }

      const result = calculateMetricsFromEvents(events);

      expect(result.avg).toBeCloseTo(30, 0);
      expect(result.frameCount).toBe(31);
    });

    it('should sort events by timestamp', () => {
      // Events provided out of order
      const events: TraceEvent[] = [
        createEvent(500000), // 500ms
        createEvent(0), // 0ms
        createEvent(250000), // 250ms
      ];

      const result = calculateMetricsFromEvents(events);

      // Duration should be 500ms (500000 / 1000)
      expect(result.trackingDurationMs).toBe(500);
      // 2 intervals over 0.5 seconds = 4 FPS
      expect(result.avg).toBe(4);
    });

    it('should round avg to 2 decimal places', () => {
      // Create events that would produce a non-round FPS
      const events: TraceEvent[] = [
        createEvent(0),
        createEvent(100000), // 100ms
        createEvent(200000), // 200ms
        createEvent(300000), // 300ms
      ];

      const result = calculateMetricsFromEvents(events);

      // 3 intervals over 0.3 seconds = 10 FPS
      expect(result.avg).toBe(10);
      // Check it's properly rounded (no floating point issues)
      expect(Number.isInteger(result.avg * 100)).toBe(true);
    });
  });

  describe('fpsTrackingFeature', () => {
    describe('start', () => {
      it('should return handle when CDP session is available', async () => {
        const traceEvents = createMockTraceEvents(60);
        const mockCDPSession = createMockCDPSession(traceEvents);
        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await fpsTrackingFeature.start(mockPage);

        expect(handle).not.toBeNull();
        expect(handle?.stop).toBeDefined();
        expect(handle?.reset).toBeDefined();
      });

      it('should call Tracing.start on initialization', async () => {
        const mockCDPSession = createMockCDPSession([]);
        const mockPage = createMockPage(null, mockCDPSession);

        await fpsTrackingFeature.start(mockPage);

        expect(mockCDPSession.send).toHaveBeenCalledWith(
          'Tracing.start',
          expect.objectContaining({
            categories: expect.stringContaining('devtools.timeline'),
          }),
        );
      });

      it('should return null when CDP is not available', async () => {
        const mockCDPSession = createMockCDPSession();
        // isCdpUnsupportedError checks for specific patterns in the message
        const cdpError = new Error('CDP session not available');
        vi.mocked(mockCDPSession.send).mockRejectedValue(cdpError);

        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await fpsTrackingFeature.start(mockPage);

        expect(handle).toBeNull();
      });

      it('should return null on unexpected error', async () => {
        const mockCDPSession = createMockCDPSession();
        vi.mocked(mockCDPSession.send).mockRejectedValue(new Error('Unexpected error'));

        const mockPage = createMockPage(null, mockCDPSession);

        const handle = await fpsTrackingFeature.start(mockPage);

        expect(handle).toBeNull();
      });
    });
  });
});
