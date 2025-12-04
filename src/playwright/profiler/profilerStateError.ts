/**
 * Phases during which profiler errors can occur.
 * Used for better error categorization and debugging.
 */
export const ProfilerErrorPhase = {
  INITIALIZATION: 'initialization',
  STABILIZATION: 'stabilization',
  VALIDATION: 'validation',
} as const;

export type ProfilerErrorPhase = (typeof ProfilerErrorPhase)[keyof typeof ProfilerErrorPhase];

/**
 * Custom error class for profiler-related failures.
 * Provides structured error information for better debugging and error handling.
 */
export class ProfilerStateError extends Error {
  readonly phase: ProfilerErrorPhase;
  readonly context?: Record<string, unknown>;

  constructor(message: string, phase: ProfilerErrorPhase, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ProfilerStateError';
    this.phase = phase;
    this.context = context;

    // Maintains proper stack trace for where error was thrown (V8 only)
    const ErrorWithCaptureStackTrace = Error as typeof Error & {
      captureStackTrace?: (
        targetObject: object,
        constructorOpt?: new (...args: unknown[]) => Error,
      ) => void;
    };
    if (ErrorWithCaptureStackTrace.captureStackTrace) {
      ErrorWithCaptureStackTrace.captureStackTrace(this, ProfilerStateError);
    }
  }

  toDetailedString(): string {
    const contextStr = this.context ? `\nContext: ${JSON.stringify(this.context, null, 2)}` : '';
    return `${this.name} [${this.phase}]: ${this.message}${contextStr}`;
  }
}
