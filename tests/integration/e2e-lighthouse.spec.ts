import { test as base } from '@playwright/test';

import { createPerformanceTest } from '@lib/playwright';

const test = createPerformanceTest(base);
const scenario = (name: string) => `/?scenario=${name}`;

test.describe('E2E Lighthouse Tests', () => {
  test.performance({
    warmup: false,
    throttleRate: 1,
    thresholds: {
      base: {
        lighthouse: { performance: 50, accessibility: 50 },
      },
    },
  })('basic audit with performance and accessibility', async ({ page }) => {
    await page.goto(scenario('lighthouse'));
  });

  test.performance({
    warmup: false,
    throttleRate: 1,
    thresholds: {
      base: {
        lighthouse: { performance: 40, accessibility: 40, bestPractices: 40, seo: 40 },
      },
    },
  })('all categories', async ({ page }) => {
    await page.goto(scenario('lighthouse'));
  });

  test.performance({
    warmup: false,
    throttleRate: 1,
    thresholds: {
      base: { lighthouse: { performance: 50 } },
    },
    lighthouse: { formFactor: 'desktop' },
  })('desktop form factor', async ({ page }) => {
    await page.goto(scenario('lighthouse'));
  });

  test.performance({
    warmup: false,
    throttleRate: 1,
    thresholds: {
      base: { lighthouse: { performance: 40 } },
    },
    lighthouse: { formFactor: 'mobile' },
  })('mobile form factor', async ({ page }) => {
    await page.goto(scenario('lighthouse'));
  });

  test.performance({
    warmup: false,
    throttleRate: 1,
    thresholds: {
      base: { lighthouse: { accessibility: 50 } },
    },
    lighthouse: { categories: ['accessibility'] },
  })('selected categories only', async ({ page }) => {
    await page.goto(scenario('lighthouse'));
  });

  test.performance({
    warmup: false,
    throttleRate: 1,
    thresholds: {
      base: { lighthouse: { performance: 50 } },
    },
    lighthouse: { skipAudits: ['uses-http2', 'uses-long-cache-ttl'] },
  })('with skipped audits', async ({ page }) => {
    await page.goto(scenario('lighthouse'));
  });
});
