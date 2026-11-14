import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@webworld/shared': path.resolve(__dirname, 'shared/src/index.ts'),
    },
  },
  test: {
    include: [
      'shared/src/**/*.test.ts',
      'server/src/**/*.test.ts',
      'client/src/**/*.test.ts',
    ],
    environment: 'node',
  },
});
