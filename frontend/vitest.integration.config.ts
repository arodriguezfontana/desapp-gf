import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/setup/global-setup.ts'],
    include: ['test/**/*.spec.ts'],
    testTimeout: 60000,
  },
});

