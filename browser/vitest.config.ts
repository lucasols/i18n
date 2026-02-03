import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 2_000,
    pool: 'forks',
    execArgv: ['--no-webstorage'],
  },
});
