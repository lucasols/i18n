import { beforeEach, expect, test } from 'vitest';
import { resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
});

test('onChange notifies on locale change with locale id', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
      },
      {
        id: 'pt',
        loader: () => Promise.resolve({ default: { hello: 'olá' } }),
      },
    ],
  });

  const receivedLocales: string[] = [];
  controller.onChange((localeId) => {
    receivedLocales.push(localeId);
  });

  await controller.setLocale('pt');

  expect(receivedLocales).toContain('pt');
  expect(controller.getLoadedLocale()).toBe('pt');
});

test('onChange does not call callback immediately when subscribing', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
      },
    ],
  });

  await controller.setLocale('en');

  const receivedLocales: string[] = [];
  controller.onChange((localeId) => {
    receivedLocales.push(localeId);
  });

  expect(receivedLocales).toEqual([]);
});
