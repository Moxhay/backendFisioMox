import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      COOKIE_SECRET: 'test-secret-key-for-signed-cookies',
    },
  },
});
