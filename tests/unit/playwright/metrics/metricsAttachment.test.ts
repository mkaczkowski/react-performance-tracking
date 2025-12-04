import { describe, expect, it, vi } from 'vitest';

import { attachTestResults } from '@lib/playwright/metrics/metricsAttachment';

import { createMockProfilerState, createMockTestInfo } from '../../../mocks/playwrightMocks';

describe('attachTestResults', () => {
  it('should attach metrics as JSON to test info', async () => {
    const testInfo = createMockTestInfo({ name: 'my-test' });
    const metrics = createMockProfilerState();

    await attachTestResults({ testInfo, metrics });

    expect(testInfo.attach).toHaveBeenCalledWith('my-test', {
      body: expect.any(String),
      contentType: 'application/json',
    });
  });

  it('should include metrics in attachment body', async () => {
    vi.stubEnv('CI', '');
    const testInfo = createMockTestInfo();
    const metrics = createMockProfilerState({
      sampleCount: 15,
      totalActualDuration: 200,
    });

    await attachTestResults({ testInfo, metrics });

    const attachCall = (testInfo.attach as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(attachCall[1].body);

    expect(body.metrics).toEqual(metrics);
    expect(body.thresholds).toEqual(testInfo.thresholds);
    expect(body.buffers).toEqual(testInfo.buffers);
    expect(body.warmup).toBe(testInfo.warmup);
    expect(body.environment).toBe('local');
    vi.unstubAllEnvs();
  });

  it('should detect CI environment', async () => {
    vi.stubEnv('CI', 'true');
    const testInfo = createMockTestInfo();
    const metrics = createMockProfilerState();

    await attachTestResults({ testInfo, metrics });

    const attachCall = (testInfo.attach as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(attachCall[1].body);

    expect(body.environment).toBe('ci');
    vi.unstubAllEnvs();
  });

  it('should include throttle rate in attachment', async () => {
    const testInfo = createMockTestInfo({ throttleRate: 6 });
    const metrics = createMockProfilerState();

    await attachTestResults({ testInfo, metrics });

    const attachCall = (testInfo.attach as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(attachCall[1].body);

    expect(body.throttle).toBe(6);
  });

  it('should include trackFps flag in attachment', async () => {
    const testInfo = createMockTestInfo({ trackFps: true });
    const metrics = createMockProfilerState();

    await attachTestResults({ testInfo, metrics });

    const attachCall = (testInfo.attach as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(attachCall[1].body);

    expect(body.trackFps).toBe(true);
  });

  it('should use test name from config for attachment name', async () => {
    const testInfo = createMockTestInfo({ name: 'custom-attachment-name' });
    const metrics = createMockProfilerState();

    await attachTestResults({ testInfo, metrics });

    expect(testInfo.attach).toHaveBeenCalledWith('custom-attachment-name', expect.any(Object));
  });

  it('should format JSON with indentation', async () => {
    const testInfo = createMockTestInfo();
    const metrics = createMockProfilerState();

    await attachTestResults({ testInfo, metrics });

    const attachCall = (testInfo.attach as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = attachCall[1].body;

    // Check that JSON is formatted with indentation (contains newlines)
    expect(body).toContain('\n');
    expect(body).toContain('  '); // 2-space indentation
  });

  it('should include FPS metrics when available', async () => {
    const testInfo = createMockTestInfo({ trackFps: true });
    const metrics = createMockProfilerState({
      fps: {
        avg: 60,
        frameCount: 120,
        trackingDurationMs: 2000,
      },
    });

    await attachTestResults({ testInfo, metrics });

    const attachCall = (testInfo.attach as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(attachCall[1].body);

    expect(body.metrics.fps).toEqual({
      avg: 60,
      frameCount: 120,
      trackingDurationMs: 2000,
    });
  });
});
