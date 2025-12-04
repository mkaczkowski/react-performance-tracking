import { defineConfig } from 'tsup';

export default defineConfig({
  // Multiple named entry points for subpath exports
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'playwright/index': 'src/playwright/index.ts',
  },
  // Generate both ESM and CJS formats
  format: ['esm', 'cjs'],
  // Generate declaration files (.d.ts)
  dts: true,
  // Clean dist directory before build
  clean: true,
  // Generate sourcemaps for debugging
  sourcemap: true,
  // Target modern environments
  target: 'es2020',
  // Inject shims for __dirname in ESM, import.meta.url in CJS
  shims: true,
  // Don't split chunks (simpler for library consumers)
  splitting: false,
  // External packages (peer deps)
  external: ['react', 'react-dom', '@playwright/test', 'playwright-core'],
});
