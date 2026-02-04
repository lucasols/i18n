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
  test('getLoadedLocale is null before loading', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { en: {} },
    });

    expect(controller.getLoadedLocale()).toBe(null);

    // Flush initial load to avoid cross-test leakage
    await vi.advanceTimersByTimeAsync(100);
    await controller.setLocale('en');
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

    void controller.setLocale('pt');

    expect(controller.getLoadedLocale()).toBe(null);

    await vi.advanceTimersByTimeAsync(100);

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

  test('getLoadedLocale stays on previous locale while new locale loads', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { en: {}, pt: {} },
    });

    // Wait for initial load of fallback locale
    await vi.advanceTimersByTimeAsync(100);

    void controller.setLocale('pt');

    expect(controller.getLoadedLocale()).toBe('en');

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('calling setLocale with current locale does not re-invoke loader', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');
    await controller.setLocale('en');

    expect(controller.getLoadedLocale()).toBe('en');
    expect(controller.invokedLoaderIds).toEqual(['en']);
  });

  test('switching between locales invokes each loader', async () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
    });

    await controller.setLocale('en');
    await controller.setLocale('pt');
    await controller.setLocale('en');

    expect(controller.getLoadedLocale()).toBe('en');
    expect(controller.invokedLoaderIds).toEqual(['en', 'pt', 'en']);
  });

  test('calling setLocale while loading supersedes previous load', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { en: {}, pt: {}, fr: {} },
      loadingTimes: { en: 200, fr: 50 },
    });

    void controller.setLocale('en');
    void controller.setLocale('fr');

    await vi.advanceTimersByTimeAsync(50);
    expect(controller.getLoadedLocale()).toBe('fr');

    await vi.advanceTimersByTimeAsync(150);

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
    expect(controller.invokedLoaderIds).toEqual(['en']);
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

  test('keeps previous locale after failed load', async () => {
    vi.useFakeTimers();

    const controller = createTestController({
      locales: { en: {}, pt: new Error('Network error') },
      retryAttempts: 1,
      retryDelay: 0,
    });

    // Wait for initial load of fallback locale
    await vi.advanceTimersByTimeAsync(100);

    let caughtError: Error | undefined;
    const loadPromise = controller.setLocale('pt').catch((e: Error) => {
      caughtError = e;
    });

    // First attempt (100ms) + 1 retry (100ms) = 200ms
    await vi.advanceTimersByTimeAsync(200);
    await loadPromise;

    expect(caughtError).toBeDefined();
    expect(caughtError?.message).toBe('Network error');
    expect(controller.getLoadedLocale()).toBe('en');
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

    void controller.setLocale('en');

    // First attempt (100ms) fails + retry delay (100ms) + second attempt (100ms) succeeds
    await vi.advanceTimersByTimeAsync(300);

    expect(attempts).toBe(2);
    expect(controller.getLoadedLocale()).toBe('en');
    expect(__`hello`).toBe('Hello');
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

describe('initialLocale', () => {
  test('returns fallback locale when no persisted locale', () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    expect(controller.initialLocale).toBe('en');
  });

  test('returns persisted locale when available', () => {
    const key = 'test-initial-locale';
    localStorage.setItem(key, 'pt');

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    expect(controller.initialLocale).toBe('pt');
  });

  test('ignores persisted locale when not configured', () => {
    const key = 'test-initial-invalid';
    localStorage.setItem(key, 'fr');
    vi.stubGlobal('navigator', { languages: ['en-US'] });

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    expect(controller.initialLocale).toBe('en');
    expect(controller.getInitialRegionLocale()).toBe('en-US');
    expect(controller.getRegionLocale()).toBe('en-US');
  });

  test('returns same value regardless of when called', async () => {
    const key = 'test-initial-stable';
    localStorage.setItem(key, 'pt');

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    expect(controller.initialLocale).toBe('pt');

    await controller.setLocale('en');

    expect(controller.initialLocale).toBe('pt');
  });

  test('returns fallback when using auto fallback and no browser match', () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: ['auto', 'en'],
    });

    expect(controller.initialLocale).toBe('en');
  });

  test('returns auto-detected browser locale when using auto fallback', () => {
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'en-US'] });

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: ['auto', 'en'],
    });

    expect(controller.initialLocale).toBe('pt');
  });
});

describe('getInitialRegionLocale', () => {
  test('returns regional locale when initial locale is base', () => {
    vi.stubGlobal('navigator', { languages: ['en-US', 'pt-BR'] });

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    expect(controller.getInitialRegionLocale()).toBe('en-US');
  });

  test('returns locale as-is when already regional', () => {
    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: 'en-US',
    });

    expect(controller.getInitialRegionLocale()).toBe('en-US');
  });

  test('returns base locale when no matching regional in navigator', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'] });

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    expect(controller.getInitialRegionLocale()).toBe('en');
  });

  test('returns regional locale for persisted base locale', () => {
    const key = 'test-initial-region-persisted';
    localStorage.setItem(key, 'pt');
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'en-US'] });

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: key,
    });

    expect(controller.initialLocale).toBe('pt');
    expect(controller.getInitialRegionLocale()).toBe('pt-BR');
  });

  test('returns same value regardless of when called', async () => {
    vi.stubGlobal('navigator', { languages: ['en-US', 'pt-BR'] });

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    expect(controller.getInitialRegionLocale()).toBe('en-US');

    await controller.setLocale('pt');

    expect(controller.getInitialRegionLocale()).toBe('en-US');
  });
});

describe('setNearestLocale', () => {
  test('exact match sets locale and returns true', async () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    await controller.setLocale('en');

    const result = await controller.setNearestLocale('pt');

    expect(result).toBe(true);
    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('regional input matches base locale', async () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    await controller.setLocale('en');

    const result = await controller.setNearestLocale('pt-BR');

    expect(result).toBe(true);
    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('base input matches regional locale', async () => {
    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: 'en-US',
    });

    await controller.setLocale('en-US');

    const result = await controller.setNearestLocale('pt');

    expect(result).toBe(true);
    expect(controller.getLoadedLocale()).toBe('pt-BR');
  });

  test('no match returns false', async () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    await controller.setLocale('en');

    const result = await controller.setNearestLocale('fr');

    expect(result).toBe(false);
  });

  test('no match does not change locale', async () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
    });

    await controller.setLocale('pt');

    await controller.setNearestLocale('fr');

    expect(controller.getLoadedLocale()).toBe('pt');
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

  test('does not persist locale when persistenceKey is false', async () => {
    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: false,
    });

    await controller.setLocale('pt');

    expect(localStorage.length).toBe(0);
  });

  test('does not read persisted locale when persistenceKey is false', async () => {
    vi.useFakeTimers();

    localStorage.setItem('some-key', 'pt');

    const controller = createTestController({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'en',
      persistenceKey: false,
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en');
    expect(controller.initialLocale).toBe('en');
  });
});
