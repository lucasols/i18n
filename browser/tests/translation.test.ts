import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('browser translation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('basic translation with async loading', () => {
    test('before loading, returns fallback', async () => {
      const { __, i18nitialize } = await import('../src/main');

      i18nitialize({
        locales: [
          {
            id: 'pt',
            loader: () =>
              Promise.resolve({
                default: {
                  hello: 'olá',
                },
              }),
          },
        ],
      });

      expect(__`hello`).toBe('hello');
    });

    test('after loading, returns translation', async () => {
      const { __, i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'pt',
            loader: () =>
              Promise.resolve({
                default: {
                  hello: 'olá',
                },
              }),
          },
        ],
      });

      await controller.setLocale('pt');

      expect(__`hello`).toBe('olá');
    });
  });

  describe('interpolation', () => {
    test('simple interpolation', async () => {
      const { __, i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'pt',
            loader: () =>
              Promise.resolve({
                default: {
                  'hello {1}': 'olá {1}',
                },
              }),
          },
        ],
      });

      await controller.setLocale('pt');

      expect(__`hello ${'world'}`).toBe('olá world');
    });
  });

  describe('pluralization', () => {
    test('plural translations work after loading', async () => {
      const { __p, i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
        locales: [
          {
            id: 'pt',
            loader: () =>
              Promise.resolve({
                default: {
                  '# apples': {
                    one: 'uma maçã',
                    '+2': '# maçãs',
                    zero: 'nenhuma maçã',
                    many: 'muitas maçãs',
                    manyLimit: 10,
                  },
                },
              }),
          },
        ],
      });

      await controller.setLocale('pt');

      expect(__p(1)`# apples`).toBe('uma maçã');
      expect(__p(2)`# apples`).toBe('2 maçãs');
      expect(__p(0)`# apples`).toBe('nenhuma maçã');
      expect(__p(11)`# apples`).toBe('muitas maçãs');
    });
  });

  describe('controller', () => {
    test('onChange notifies on locale change', async () => {
      const { i18nitialize } = await import('../src/main');

      const controller = i18nitialize({
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

      let callCount = 0;
      controller.onChange(() => {
        callCount++;
      });

      await controller.setLocale('pt');

      expect(callCount).toBeGreaterThan(0);
      expect(controller.getActiveLocale()).toBe('pt');
      expect(controller.isLoaded()).toBe(true);
    });
  });
});

describe('formatters', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('__date formats dates', async () => {
    const { __date, i18nitialize } = await import('../src/main');

    const controller = i18nitialize({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
          regionLocale: 'en-US',
          currencyCode: 'USD',
        },
      ],
    });
    await controller.setLocale('en');

    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = __date(date, { dateStyle: 'short' });
    expect(formatted).toMatch(/1\/15\/24/);
  });

  test('__num formats numbers', async () => {
    const { __num, i18nitialize } = await import('../src/main');

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

    const formatted = __num(1234.56);
    expect(formatted).toBe('1,234.56');
  });

  test('__currency formats currency', async () => {
    const { __currency, i18nitialize } = await import('../src/main');

    const controller = i18nitialize({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
          regionLocale: 'en-US',
          currencyCode: 'USD',
        },
      ],
    });
    await controller.setLocale('en');

    const formatted = __currency(1234.56);
    expect(formatted).toMatch(/\$1,234\.56/);
  });

  test('__relativeTime formats relative time', async () => {
    const { __relativeTime, i18nitialize } = await import('../src/main');

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

    const formatted = __relativeTime(-1, 'day');
    expect(formatted).toBe('1 day ago');
  });

  test('__list formats lists', async () => {
    const { __list, i18nitialize } = await import('../src/main');

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

    const formatted = __list(['apple', 'banana', 'cherry']);
    expect(formatted).toBe('apple, banana, and cherry');
  });

  test('__formattedTimeDuration formats duration', async () => {
    const { __formattedTimeDuration } = await import('../src/main');

    const duration = 3661000; // 1 hour, 1 minute, 1 second
    const formatted = __formattedTimeDuration(duration);
    expect(formatted).toBe('01:01:01');
  });

  test('__formattedTimeDuration with days', async () => {
    const { __formattedTimeDuration } = await import('../src/main');

    const duration = 90061000; // 1 day, 1 hour, 1 minute, 1 second
    const formatted = __formattedTimeDuration(duration);
    expect(formatted).toBe('1d 01:01:01');
  });
});
