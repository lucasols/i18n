import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'core',
      root: './packages/core',
      include: ['tests/**/*.test.ts'],
      testTimeout: 2_000,
    },
  },
  {
    test: {
      name: 'server',
      root: './packages/server',
      include: ['tests/**/*.test.ts'],
      testTimeout: 10_000,
    },
  },
  {
    test: {
      name: 'browser',
      root: './packages/browser',
      include: ['tests/**/*.test.ts'],
      testTimeout: 2_000,
    },
  },
]);
