import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('translation loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  describe('loading states', () => {
    test('isLoaded is false before loading', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'en',
            loader: () => Promise.resolve({ default: {} }),
          },
        ],
      });

      expect(controller.isLoaded()).toBe(false);
    });

    test('isLoaded is true after loading', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'en',
            loader: () => Promise.resolve({ default: {} }),
          },
        ],
      });

      await controller.setLocale('en');

      expect(controller.isLoaded()).toBe(true);
    });

    test('getActiveLocale is set immediately when setLocale called', async () => {
      const { i18nitialize } = await import('../src/main');

      let resolveLoader: (value: { default: Record<string, never> }) => void;
      const loaderPromise = new Promise<{ default: Record<string, never> }>((resolve) => {
        resolveLoader = resolve;
      });

      const controller = i18nitialize({
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

      expect(controller.getActiveLocale()).toBe('pt');
      expect(controller.isLoaded()).toBe(false);

      resolveLoader!({ default: {} });
      await setLocalePromise;

      expect(controller.isLoaded()).toBe(true);
    });

    test('getActiveLocale returns locale id after loading', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'en',
            loader: () => Promise.resolve({ default: {} }),
          },
        ],
      });

      await controller.setLocale('en');

      expect(controller.getActiveLocale()).toBe('en');
    });
  });

  describe('locale switching', () => {
    test('can switch between locales', async () => {
      const { __, i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
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
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
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
      expect(controller.getActiveLocale()).toBe('en');

      await controller.setLocale('pt');
      expect(controller.getActiveLocale()).toBe('pt');
    });
  });

  describe('error handling', () => {
    test('throws error for unknown locale', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
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

    test('throws error when loader fails after retries', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
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
      const { i18nitialize } = await import('../src/main');

      let attempts = 0;
      const controller = i18nitialize({
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
      expect(controller.isLoaded()).toBe(true);
    });

    test('respects retryDelay between attempts', async () => {
      vi.useFakeTimers();
      const { i18nitialize } = await import('../src/main');

      const timestamps: number[] = [];
      let attempts = 0;

      const controller = i18nitialize({
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

  describe('regionLocale', () => {
    test('getRegionLocale returns regionLocale from config', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
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

    test('getRegionLocale falls back to locale id', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'en',
            loader: () => Promise.resolve({ default: {} }),
          },
        ],
      });

      await controller.setLocale('en');

      expect(controller.getRegionLocale()).toBe('en');
    });

    test('getRegionLocale uses locale id during auto-load', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'fr',
            loader: () => Promise.resolve({ default: {} }),
          },
        ],
      });

      expect(controller.getRegionLocale()).toBe('fr');
    });
  });
});
