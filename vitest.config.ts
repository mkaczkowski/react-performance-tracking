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
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },

    // Reporters
    reporters: ['default'],
  },
});
