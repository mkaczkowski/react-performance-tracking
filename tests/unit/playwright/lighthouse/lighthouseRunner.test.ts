import { describe, expect, it } from 'vitest';

import { runLighthouseAudit, type RunLighthouseOptions } from '@lib/playwright/lighthouse';

describe('lighthouseRunner', () => {
  describe('runLighthouseAudit', () => {
    it('should return null when lighthouse is disabled', async () => {
      const options: RunLighthouseOptions = {
        url: 'http://localhost:3000',
        config: {
          enabled: false,
          formFactor: 'mobile',
          categories: ['performance'],
          skipAudits: [],
          chromeFlags: ['--headless'],
          disableStorageReset: true,
        },
        throttleRate: 1,
      };

      const result = await runLighthouseAudit(options);

      expect(result).toBeNull();
    });

    it('should throw helpful error when lighthouse is not installed', async () => {
      const options: RunLighthouseOptions = {
        url: 'http://localhost:3000',
        config: {
          enabled: true,
          formFactor: 'mobile',
          categories: ['performance'],
          skipAudits: [],
          chromeFlags: ['--headless'],
          disableStorageReset: true,
        },
        throttleRate: 1,
      };

      // Since lighthouse is not installed in dev dependencies,
      // this should throw the "not installed" error
      await expect(runLighthouseAudit(options)).rejects.toThrow(
        'Lighthouse is not installed. Install it with: npm install -D lighthouse',
      );
    });
  });
});
