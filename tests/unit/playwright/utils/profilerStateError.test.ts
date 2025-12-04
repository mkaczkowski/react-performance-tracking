import { describe, expect, it } from 'vitest';

import { ProfilerErrorPhase, ProfilerStateError } from '@/playwright/profiler/profilerStateError';

describe('ProfilerStateError', () => {
  it('should create error with message and phase', () => {
    const error = new ProfilerStateError('Test error', ProfilerErrorPhase.INITIALIZATION);

    expect(error.message).toBe('Test error');
    expect(error.phase).toBe(ProfilerErrorPhase.INITIALIZATION);
    expect(error.name).toBe('ProfilerStateError');
    expect(error.context).toBeUndefined();
  });

  it('should create error with context', () => {
    const context = { timeout: 5000, attempt: 3 };
    const error = new ProfilerStateError('Test error', ProfilerErrorPhase.STABILIZATION, context);

    expect(error.context).toEqual(context);
  });

  it('should be instanceof Error', () => {
    const error = new ProfilerStateError('Test', ProfilerErrorPhase.VALIDATION);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProfilerStateError);
  });

  describe('toDetailedString', () => {
    it('should format error without context', () => {
      const error = new ProfilerStateError(
        'Something went wrong',
        ProfilerErrorPhase.INITIALIZATION,
      );

      const detailed = error.toDetailedString();

      expect(detailed).toBe('ProfilerStateError [initialization]: Something went wrong');
    });

    it('should format error with context', () => {
      const error = new ProfilerStateError('Timeout', ProfilerErrorPhase.STABILIZATION, {
        maxWaitMs: 5000,
      });

      const detailed = error.toDetailedString();

      expect(detailed).toContain('ProfilerStateError [stabilization]: Timeout');
      expect(detailed).toContain('Context:');
      expect(detailed).toContain('"maxWaitMs": 5000');
    });
  });

  describe('ProfilerErrorPhase', () => {
    it('should have all expected phases', () => {
      expect(ProfilerErrorPhase.INITIALIZATION).toBe('initialization');
      expect(ProfilerErrorPhase.STABILIZATION).toBe('stabilization');
      expect(ProfilerErrorPhase.VALIDATION).toBe('validation');
    });
  });
});
