import { defineConfig } from 'vocs';

export default defineConfig({
  title: 'React Performance Tracking',
  description:
    'Automate React render performance checks in Playwright. Capture React Profiler metrics, apply CPU throttling, run warmups, enforce budgets.',
  rootDir: 'site',
  baseUrl: process.env.VITE_BASE_URL,
  iconUrl: '/icon.svg',
  ogImageUrl: '/og-image.svg',

  theme: {
    accentColor: '#10b981',
  },

  topNav: [
    { text: 'Guide', link: '/docs', match: '/docs' },
    { text: 'Examples', link: '/docs/examples/basic', match: '/docs/examples' },
    {
      text: 'GitHub',
      link: 'https://github.com/mkaczkowski/react-performance-tracking',
    },
    {
      text: 'LinkedIn',
      link: 'https://www.linkedin.com/in/mkaczkowski/',
    },
  ],

  sidebar: {
    '/docs': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/docs' },
          { text: 'Installation', link: '/docs/installation' },
          { text: 'Quick Start', link: '/docs/quick-start' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'React Setup', link: '/docs/guides/react-setup' },
          { text: 'Playwright Setup', link: '/docs/guides/playwright-setup' },
          { text: 'Configuring Thresholds', link: '/docs/guides/thresholds' },
          {
            text: 'CPU & Network Throttling',
            link: '/docs/guides/throttling',
          },
          { text: 'Custom Metrics', link: '/docs/guides/custom-metrics' },
          { text: 'Config Builder', link: '/docs/guides/config-builder' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'React API', link: '/docs/api/react' },
          { text: 'Playwright API', link: '/docs/api/playwright' },
          { text: 'Configuration', link: '/docs/api/configuration' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Basic Usage', link: '/docs/examples/basic' },
          { text: 'E-Commerce', link: '/docs/examples/e-commerce' },
          { text: 'Dashboard', link: '/docs/examples/dashboard' },
          { text: 'SPA Navigation', link: '/docs/examples/spa-navigation' },
        ],
      },
      {
        text: 'Advanced',
        collapsed: true,
        items: [
          { text: 'Architecture', link: '/docs/advanced/architecture' },
          { text: 'Custom Fixtures', link: '/docs/advanced/custom-fixtures' },
          { text: 'Testing Guidelines', link: '/docs/advanced/testing' },
        ],
      },
    ],
  },
});
