import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../src'),
      '@lib/react': path.resolve(__dirname, '../../../src/react'),
      '@lib/playwright': path.resolve(__dirname, '../../../src/playwright'),
    },
  },
});
