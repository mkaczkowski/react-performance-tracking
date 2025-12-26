import type { Browser, BrowserContext, BrowserType, Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import { runLighthouseAudit, type RunLighthouseOptions } from '@lib/playwright/lighthouse';

/**
 * Creates a mock page with configurable browser type for Lighthouse tests.
 */
const createMockPageForLighthouse = (browserName: string = 'chromium'): Page => {
  const mockBrowserType = {
    name: vi.fn().mockReturnValue(browserName),
  } as unknown as BrowserType;

  const mockBrowser = {
    browserType: vi.fn().mockReturnValue(mockBrowserType),
    wsEndpoint: vi.fn().mockReturnValue('ws://localhost:9222/devtools/browser/abc123'),
  } as unknown as Browser;

  const mockContext = {
    browser: vi.fn().mockReturnValue(mockBrowser),
  } as unknown as BrowserContext;

  const mockPage = {
    url: vi.fn().mockReturnValue('http://localhost:3000'),
    context: vi.fn().mockReturnValue(mockContext),
  } as unknown as Page;

  return mockPage;
};

describe('lighthouseRunner', () => {
  describe('runLighthouseAudit', () => {
    it('should return null when lighthouse is disabled', async () => {
      const page = createMockPageForLighthouse();
      const options: RunLighthouseOptions = {
        page,
        config: {
          enabled: false,
          formFactor: 'mobile',
          categories: ['performance'],
          skipAudits: [],
        },
        throttleRate: 1,
      };

      const result = await runLighthouseAudit(options);

      expect(result).toBeNull();
    });

    it('should throw error for non-Chromium browsers', async () => {
      const page = createMockPageForLighthouse('firefox');
      const options: RunLighthouseOptions = {
        page,
        config: {
          enabled: true,
          formFactor: 'mobile',
          categories: ['performance'],
          skipAudits: [],
        },
        throttleRate: 1,
      };

      await expect(runLighthouseAudit(options)).rejects.toThrow(
        'Lighthouse requires Chromium browser. Current: firefox',
      );
    });

    it('should throw error when browser is null', async () => {
      const mockContext = {
        browser: vi.fn().mockReturnValue(null),
      } as unknown as BrowserContext;

      const mockPage = {
        url: vi.fn().mockReturnValue('http://localhost:3000'),
        context: vi.fn().mockReturnValue(mockContext),
      } as unknown as Page;

      const options: RunLighthouseOptions = {
        page: mockPage,
        config: {
          enabled: true,
          formFactor: 'mobile',
          categories: ['performance'],
          skipAudits: [],
        },
        throttleRate: 1,
      };

      await expect(runLighthouseAudit(options)).rejects.toThrow(
        'Lighthouse requires Chromium browser. Current: unknown',
      );
    });

    it('should throw helpful error when lighthouse is not installed', async () => {
      const page = createMockPageForLighthouse('chromium');
      const options: RunLighthouseOptions = {
        page,
        config: {
          enabled: true,
          formFactor: 'mobile',
          categories: ['performance'],
          skipAudits: [],
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
