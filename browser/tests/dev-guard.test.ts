import { beforeEach, expect, test } from 'vitest';
import { __, __date, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
});

test('dev scope guard blocks until devEnvIsReady is called', async () => {
  const controller = createTestController({
    locales: { en: {} },
    dev: true,
  });

  await controller.setLocale('en');

  expect(() => __`hello`).toThrowError(/Invalid usage/i);
  expect(() => __date(new Date('2024-01-01T00:00:00Z'))).toThrowError(
    /Invalid usage/i,
  );

  controller.devEnvIsReady();

  expect(__`hello`).toBe('hello');
  expect(__date(new Date('2024-01-01T00:00:00Z'))).toBeTruthy();
});
