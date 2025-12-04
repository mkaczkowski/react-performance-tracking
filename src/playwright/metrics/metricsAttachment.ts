import { PERFORMANCE_CONFIG } from '../config/performanceConfig';
import type { ConfiguredTestInfo } from '../types';
import type { CapturedProfilerState } from '../profiler/profilerState';

/**
 * Attachment data structure for test results.
 */
type AttachmentData = {
  metrics: CapturedProfilerState;
  throttle: number;
  trackFps: boolean;
  trackMemory: boolean;
  thresholds: ConfiguredTestInfo['thresholds'];
  buffers: ConfiguredTestInfo['buffers'];
  warmup: boolean;
  environment: 'ci' | 'local';
  iterations: number;
};

/**
 * Attaches performance test results as JSON artifact to test report.
 */
export const attachTestResults = async ({
  testInfo,
  metrics,
}: {
  testInfo: ConfiguredTestInfo;
  metrics: CapturedProfilerState;
}): Promise<void> => {
  const { throttleRate, name, trackFps, trackMemory, thresholds, buffers, warmup, iterations } =
    testInfo;

  const attachmentData: AttachmentData = {
    metrics,
    throttle: throttleRate,
    trackFps,
    trackMemory,
    thresholds,
    buffers,
    warmup,
    environment: PERFORMANCE_CONFIG.isCI ? 'ci' : 'local',
    iterations,
  };

  await testInfo.attach(name, {
    body: JSON.stringify(attachmentData, null, 2),
    contentType: 'application/json',
  });
};
