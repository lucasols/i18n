import { beforeEach, describe, expect, test, vi } from 'vitest';
import { __, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
  vi.useRealTimers();
});

describe('loading states', () => {
  test('getLoadedLocale is null before loading', () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    expect(controller.getLoadedLocale()).toBe(null);
  });

  test('getLoadedLocale returns locale after loading', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    await controller.setLocale('en');

    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('getLoadedLocale returns null while loading, locale after loaded', async () => {
    let resolveLoader: (value: { default: Record<string, never> }) => void;
    const loaderPromise = new Promise<{ default: Record<string, never> }>(
      (resolve) => {
        resolveLoader = resolve;
      },
    );

    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => loaderPromise,
        },
        {
          id: 'pt',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    const setLocalePromise = controller.setLocale('pt');

    expect(controller.getLoadedLocale()).toBe(null);

    resolveLoader!({ default: {} });
    await setLocalePromise;

    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('getLoadedLocale returns locale id after loading', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    await controller.setLocale('en');

    expect(controller.getLoadedLocale()).toBe('en');
  });
});

describe('locale switching', () => {
  test('can switch between locales', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: { hello: 'hello' } }),
        },
        {
          id: 'pt',
          loader: () => Promise.resolve({ default: { hello: 'olá' } }),
        },
      ],
    });

    await controller.setLocale('en');
    expect(__`hello`).toBe('hello');

    await controller.setLocale('pt');
    expect(__`hello`).toBe('olá');
  });

  test('switching locales updates activeLocale', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
        {
          id: 'pt',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    await controller.setLocale('en');
    expect(controller.getLoadedLocale()).toBe('en');

    await controller.setLocale('pt');
    expect(controller.getLoadedLocale()).toBe('pt');
  });
});

describe('error handling', () => {
  test('throws error for unknown locale without fallback', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    await expect(controller.setLocale('unknown' as 'en')).rejects.toThrow(
      'Locale "unknown" not found',
    );
  });

  test('uses fallbackLocale for unknown locale', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
      fallbackLocale: 'en',
    });

    await controller.setLocale('unknown' as 'en');
    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('throws error when loader fails after retries', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.reject(new Error('Network error')),
        },
      ],
      retryAttempts: 1,
      retryDelay: 0,
    });

    await expect(controller.setLocale('en')).rejects.toThrow('Network error');
  });
});

describe('retry logic', () => {
  test('retries on failure before succeeding', async () => {
    vi.useFakeTimers();

    let attempts = 0;
    const controller = createTestController({
      locales: [
        {
          id: 'dummy',
          loader: () => Promise.resolve({ default: {} }),
        },
        {
          id: 'en',
          loader: () => {
            attempts++;
            if (attempts < 3) {
              return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({ default: { hello: 'hello' } });
          },
        },
      ],
      retryAttempts: 3,
      retryDelay: 100,
    });

    await controller.setLocale('dummy');

    const loadPromise = controller.setLocale('en');

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    await loadPromise;

    expect(attempts).toBe(3);
    expect(controller.getLoadedLocale()).toBe('en');
  });

  test('respects retryDelay between attempts', async () => {
    vi.useFakeTimers();

    const timestamps: number[] = [];
    let attempts = 0;

    const controller = createTestController({
      locales: [
        {
          id: 'dummy',
          loader: () => Promise.resolve({ default: {} }),
        },
        {
          id: 'en',
          loader: () => {
            timestamps.push(Date.now());
            attempts++;
            if (attempts < 2) {
              return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({ default: {} });
          },
        },
      ],
      retryAttempts: 2,
      retryDelay: 500,
    });

    await controller.setLocale('dummy');

    const loadPromise = controller.setLocale('en');

    await vi.advanceTimersByTimeAsync(500);

    await loadPromise;

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1]! - timestamps[0]!).toBe(500);
  });
});

describe('loading guard', () => {
  test('duplicate setLocale calls are no-ops', async () => {
    let loadCount = 0;
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => {
            loadCount++;
            return Promise.resolve({ default: {} });
          },
        },
      ],
    });

    const promise1 = controller.setLocale('en');
    const promise2 = controller.setLocale('en');

    await Promise.all([promise1, promise2]);

    expect(loadCount).toBe(1);
  });
});

describe('regionLocale', () => {
  test('getRegionLocale returns regionLocale from config', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
          regionLocale: 'en-US',
        },
      ],
    });

    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en-US');
  });

  test('getRegionLocale infers region from navigator.languages or falls back to locale id', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    await controller.setLocale('en');

    const regionLocale = controller.getRegionLocale();
    expect(regionLocale.startsWith('en')).toBe(true);
  });

  test('__mockRegionLocale overrides region locale', async () => {
    const controller = createTestController({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
      ],
    });

    await controller.setLocale('en');
    controller.__mockRegionLocale('en-GB');

    expect(controller.getRegionLocale()).toBe('en-GB');
  });
});

describe('onLoad', () => {
  test('notifies when locale is fully loaded', async () => {
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
    controller.onLoad((localeId) => {
      receivedLocales.push(localeId);
    });

    await controller.setLocale('pt');

    expect(receivedLocales).toContain('pt');
    expect(controller.getLoadedLocale()).toBe('pt');
  });

  test('does not call callback immediately when subscribing', async () => {
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
    controller.onLoad((localeId) => {
      receivedLocales.push(localeId);
    });

    expect(receivedLocales).toEqual([]);
  });
});
