/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sleep } from '@ls-stack/utils/sleep';
import { __, i18nitialize, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
  vi.useRealTimers();
  localStorage.clear();
});

describe('loading states', () => {
  test('getLoadedLocale is null before loading', () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    expect(controller.getLoadedLocale()).toBe(null);
  });

  test('getLoadedLocale returns locale after loading', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('getLoadedLocale returns null while loading, locale after loaded', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { en: {}, pt: {} },
    });

    const setLocalePromise = controller.setLocale('pt');

    expect(controller.getLoadedLocale()).toBe(null);

    await vi.advanceTimersByTimeAsync(100);
    await setLocalePromise;

    expect(controller.getLoadedLocale()).toBe('pt');
  });

});

describe('locale switching', () => {
  test('can switch between locales', async () => {
    const controller = createTestController({
      locales: {
        en: { hello: 'hello' },
        pt: { hello: 'olá' },
      },
    });

    await controller.setLocale('en');
    expect(__`hello`).toBe('hello');

    await controller.setLocale('pt');
    expect(__`hello`).toBe('olá');
  });

  test('switching locales updates activeLocale', async () => {
    const controller = createTestController({
      locales: {
        en: {},
        pt: {},
      },
    });

    await controller.setLocale('en');
    expect(controller.getLoadedLocale()).toBe('en');

    await controller.setLocale('pt');
    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('calling setLocale with current locale is a no-op', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');
    await controller.setLocale('en');

    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('calling setLocale while loading supersedes previous load', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { en: {}, pt: {}, fr: {} },
    });

    const enPromise = controller.setLocale('en');
    const frPromise = controller.setLocale('fr');

    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([enPromise, frPromise]);

    expect(controller.getLoadedLocale()).toBe('fr');
  });
});

describe('error handling', () => {
  test('uses fallbackLocale for unknown locale', async () => {
    const controller = createTestController({
      locales: { en: {} },
      fallbackLocale: 'en',
    });

    await controller.setLocale('unknown' as 'en');
    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('throws error when loader fails after retries', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { dummy: {}, en: new Error('Network error') },
      retryAttempts: 1,
      retryDelay: 0,
    });

    // Wait for initial load of dummy locale (first in object = fallback)
    await vi.advanceTimersByTimeAsync(100);

    let caughtError: Error | undefined;
    const promise = controller.setLocale('en').catch((e: Error) => {
      caughtError = e;
    });

    // First attempt (100ms) + 1 retry (100ms) = 200ms
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(caughtError).toBeDefined();
    expect(caughtError?.message).toBe('Network error');
  });
});


describe('retry logic', () => {
  test('retries with configured delay before failing', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { dummy: {}, en: new Error('Network error') },
      retryAttempts: 3,
      retryDelay: 100,
    });

    // Wait for initial load of dummy locale (first in object = fallback)
    await vi.advanceTimersByTimeAsync(100);

    let caughtError: Error | undefined;
    const loadPromise = controller.setLocale('en').catch((e: Error) => {
      caughtError = e;
    });

    // First attempt (100ms) + 3 retries * (100ms delay + 100ms loading) = 700ms total
    await vi.advanceTimersByTimeAsync(800);
    await loadPromise;

    expect(caughtError).toBeDefined();
    expect(caughtError?.message).toBe('Network error');
  });

  test('succeeds after transient error on retry', async () => {
    vi.useFakeTimers();

    let attempts = 0;
    const controller = i18nitialize({
      persistenceKey: 'test-retry',
      fallbackLocale: 'en',
      retryAttempts: 3,
      retryDelay: 100,
      locales: [
        {
          id: 'en',
          loader: async () => {
            await sleep(100);
            attempts++;
            if (attempts === 1) {
              throw new Error('Network error');
            }
            return { default: { hello: 'Hello' } };
          },
        },
      ],
    });

    const loadPromise = controller.setLocale('en');

    // First attempt (100ms) fails + retry delay (100ms) + second attempt (100ms) succeeds
    await vi.advanceTimersByTimeAsync(300);
    await loadPromise;

    expect(attempts).toBe(2);
    expect(controller.getLoadedLocale()).toBe('en');
    expect(__`hello`).toBe('Hello');
  });
});

describe('regionLocale', () => {
  test('getRegionLocale infers region from navigator.languages or falls back to locale id', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    const regionLocale = controller.getRegionLocale();
    expect(regionLocale.startsWith('en')).toBe(true);
  });

  test('__mockRegionLocale overrides region locale', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');
    controller.__mockRegionLocale('en-GB');

    expect(controller.getRegionLocale()).toBe('en-GB');
  });
});

describe('onLoad', () => {
  test('notifies when locale is fully loaded', async () => {
    const controller = createTestController({
      locales: {
        en: {},
        pt: { hello: 'olá' },
      },
    });

    const receivedLocales: string[] = [];
    controller.onLoad((localeId) => {
      receivedLocales.push(localeId);
    });

    await controller.setLocale('pt');

    expect(receivedLocales).toContain('pt');
    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('does not call callback immediately when subscribing', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    const receivedLocales: string[] = [];
    controller.onLoad((localeId) => {
      receivedLocales.push(localeId);
    });

    expect(receivedLocales).toEqual([]);
  });
});

describe('persistenceKey', () => {
  test('persists locale to localStorage after successful load', async () => {
    const key = 'test-persistence-save';

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      persistenceKey: key,
    });

    await controller.setLocale('pt');

    expect(localStorage.getItem(key)).toBe('pt');
  });

  test('loads persisted locale on initialization', async () => {
    vi.useFakeTimers();

    const key = 'test-persistence-load';
    localStorage.setItem(key, 'pt');

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    // Wait for automatic initialization to complete
    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('falls back to fallbackLocale when no persisted locale', async () => {
    vi.useFakeTimers();

    const key = 'test-persistence-no-stored';

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    // Wait for automatic initialization to complete
    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('falls back to fallbackLocale when persisted locale is invalid', async () => {
    vi.useFakeTimers();

    const key = 'test-persistence-invalid';
    localStorage.setItem(key, 'invalid-locale');

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    // Wait for automatic initialization to complete (falls back to 'en')
    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en');
  });
});
