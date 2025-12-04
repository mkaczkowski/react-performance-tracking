import type { CDPSession, Page } from '@playwright/test';
import { vi } from 'vitest';

import type { ConfiguredTestInfo, PerformanceInstance } from '@lib/playwright/types';
import type { CapturedProfilerState } from '@/playwright/profiler/profilerState';

/**
 * Mock implementation of Playwright Page for testing.
 */
type MockPage = {
  evaluate: ReturnType<typeof vi.fn>;
  waitForFunction: ReturnType<typeof vi.fn>;
  goto: ReturnType<typeof vi.fn>;
  context: ReturnType<typeof vi.fn>;
  addInitScript: ReturnType<typeof vi.fn>;
};

/**
 * Creates a mock Playwright Page object.
 * @param profilerState - Mock profiler state to return from evaluate
 * @param cdpSession - Optional custom CDP session mock
 */
export const createMockPage = (
  profilerState: CapturedProfilerState | null = null,
  cdpSession?: CDPSession,
): Page => {
  const mockPage: MockPage = {
    evaluate: vi.fn().mockResolvedValue(profilerState),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    context: vi.fn().mockReturnValue({
      newCDPSession: vi.fn().mockResolvedValue(cdpSession ?? createMockCDPSession()),
    }),
  };

  return mockPage as unknown as Page;
};

/**
 * Mock implementation of CDP Session for testing.
 */
type MockCDPSession = {
  send: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};

/**
 * Creates event handler management functions for CDP session mocks.
 */
const createEventHandlerManager = () => {
  const eventHandlers = new Map<string, ((...args: unknown[]) => void)[]>();

  return {
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
    }),
    once: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
    }),
    off: vi.fn().mockImplementation((event: string, handler?: (...args: unknown[]) => void) => {
      if (handler) {
        const handlers = eventHandlers.get(event) || [];
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        eventHandlers.set(event, handlers);
      } else {
        eventHandlers.set(event, []);
      }
    }),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = eventHandlers.get(event) || [];
      for (const handler of handlers) {
        handler(...args);
      }
    },
  };
};

/**
 * Creates a mock CDP Session with tracing support.
 * @param traceEvents - Trace events to return when tracing is stopped
 * @param overrides - Optional overrides for mock methods
 */
export const createMockCDPSession = (
  traceEvents: unknown[] = [],
  overrides: Partial<MockCDPSession> = {},
): CDPSession => {
  const { on, once, off, emit } = createEventHandlerManager();

  const session: MockCDPSession = {
    send: vi.fn().mockImplementation(async (method: string) => {
      if (method === 'Tracing.end') {
        // Simulate async trace data collection
        setTimeout(() => {
          emit('Tracing.dataCollected', { value: traceEvents });
          emit('Tracing.tracingComplete');
        }, 0);
      }
      return undefined;
    }),
    detach: vi.fn().mockResolvedValue(undefined),
    on,
    once,
    off,
    ...overrides,
  };

  return session as unknown as CDPSession;
};

/**
 * Creates a mock CDP Session that fails on specific operations.
 * @param failOn - Which operation should fail ('start', 'end', or 'detach')
 * @param error - Error to throw
 */
export const createFailingCDPSession = (
  failOn: 'start' | 'end' | 'detach' = 'end',
  error: Error = new Error('CDP operation failed'),
): CDPSession => {
  const { on, once, off, emit } = createEventHandlerManager();

  const session: MockCDPSession = {
    send: vi.fn().mockImplementation(async (method: string) => {
      if (method === 'Tracing.start' && failOn === 'start') {
        throw error;
      }
      if (method === 'Tracing.end' && failOn === 'end') {
        throw error;
      }
      if (method === 'Tracing.end') {
        setTimeout(() => emit('Tracing.tracingComplete'), 0);
      }
      return undefined;
    }),
    detach: vi.fn().mockImplementation(async () => {
      if (failOn === 'detach') {
        throw error;
      }
      return undefined;
    }),
    on,
    once,
    off,
  };

  return session as unknown as CDPSession;
};

/**
 * Default values for mock ConfiguredTestInfo.
 */
const DEFAULT_PERFORMANCE_CONFIG = {
  throttleRate: 4,
  warmup: false,
  thresholds: { duration: 500, rerenders: 20, avg: 60 },
  buffers: { duration: 20, rerenders: 20, avg: 20 },
  name: 'test-performance-data',
  trackFps: false,
  exportTrace: { enabled: false },
} as const;

/**
 * Creates a mock TestInfo object with performance configuration.
 */
export const createMockTestInfo = (
  overrides: Partial<ConfiguredTestInfo> = {},
): ConfiguredTestInfo => {
  return {
    ...DEFAULT_PERFORMANCE_CONFIG,
    annotations: [],
    attach: vi.fn().mockResolvedValue(undefined),
    title: 'Test Title',
    titlePath: ['Test Suite', 'Test Title'],
    ...overrides,
  } as ConfiguredTestInfo;
};

/**
 * Default values for mock CapturedProfilerState.
 */
const DEFAULT_PROFILER_STATE: CapturedProfilerState = {
  sampleCount: 10,
  totalActualDuration: 100,
  totalBaseDuration: 150,
  phaseBreakdown: { mount: 1, update: 9 },
  components: {},
};

/**
 * Creates a mock profiler state.
 */
export const createMockProfilerState = (
  overrides: Partial<CapturedProfilerState> = {},
): CapturedProfilerState => {
  return {
    ...DEFAULT_PROFILER_STATE,
    ...overrides,
  };
};

/**
 * Creates a mock performance fixture instance.
 */
export const createMockPerformance = (): PerformanceInstance => {
  return {
    waitForInitialization: vi.fn().mockResolvedValue(undefined),
    waitUntilStable: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
    setTrackingHandle: vi.fn(),
    mark: vi.fn(),
    measure: vi.fn().mockReturnValue(0),
    getCustomMetrics: vi.fn().mockReturnValue({ marks: [], measures: [] }),
  };
};

/**
 * Creates trace events for testing FPS calculations.
 * @param count - Number of frame events to create
 * @param eventType - Type of frame event
 * @param intervalUs - Interval between events in microseconds (default: 16666 = ~60fps)
 */
export const createMockTraceEvents = (
  count: number,
  eventType: 'DrawFrame' | 'BeginMainThreadFrame' | 'BeginFrame' = 'DrawFrame',
  intervalUs: number = 16666,
): unknown[] => {
  return Array.from({ length: count }, (_, i) => ({
    name: eventType,
    cat: 'devtools.timeline',
    ph: 'I',
    ts: i * intervalUs,
    pid: 1,
    tid: 1,
  }));
};
