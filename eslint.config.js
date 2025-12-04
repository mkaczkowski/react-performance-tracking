import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Main configuration for TypeScript files
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Allow console in logger implementation and structured logging output
  {
    files: ['src/utils/logger.ts', 'src/playwright/assertions/logging.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Test fixtures intentionally use anti-patterns to trigger re-renders for profiler data
  {
    files: ['tests/fixtures/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Unit tests may use variable capture patterns for testing context values
  {
    files: ['tests/unit/**/*.test.{ts,tsx}'],
    rules: {
      'react-hooks/globals': 'off',
    },
  },

  // Config files (JS/TS config files at root)
  {
    files: ['*.config.{js,ts,mjs,cjs}', 'tests/fixtures/**/vite.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Prettier config (must be last to override other formatting rules)
  eslintConfigPrettier,
);
