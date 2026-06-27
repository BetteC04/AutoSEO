import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@lib': path.resolve(__dirname, 'lib'),
      '@components': path.resolve(__dirname, 'entrypoints/sidepanel/components'),
      '@pages': path.resolve(__dirname, 'entrypoints/sidepanel/pages'),
      '@hooks': path.resolve(__dirname, 'entrypoints/sidepanel/hooks'),
    },
  },
});
