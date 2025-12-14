import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@lib/react': path.resolve(__dirname, 'src/react'),
      '@lib/playwright': path.resolve(__dirname, 'src/playwright'),
    },
  },
  test: {
    // Test file patterns
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Environment - jsdom for React component tests
    environment: 'jsdom',

    // Enable global test APIs (describe, it, expect)
    globals: true,

    // Setup files for test utilities
    setupFiles: ['./tests/setup.ts'],

    // Mock behavior
    clearMocks: true,
    restoreMocks: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        // Test files
        '**/*.test.ts',
        '**/*.test.tsx',
        // Re-export index files
        '**/index.ts',
        // Type definition files (no runtime code)
        '**/*.types.ts',
        '**/types.ts',
        '**/types/**/*.ts',
        '**/*.d.ts',
        // Browser-side code that runs via page.evaluate()/addInitScript()
        // These files contain PerformanceObserver/window code that can only be covered by E2E tests
        '**/webVitals/webVitalsTracking.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        // Lower threshold for branches due to browser-side code in page.evaluate() callbacks
        // that cannot be unit tested (e.g., profilerState.ts:146-183, profilerOperations.ts)
        branches: 75,
        statements: 80,
      },
    },

    // Reporters
    reporters: ['default'],
  },
});
