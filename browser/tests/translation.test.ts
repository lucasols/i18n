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
});
