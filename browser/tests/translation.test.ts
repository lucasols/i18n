import { beforeEach, describe, expect, test } from 'vitest';
import { __, __p, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
});

describe('basic translation with async loading', () => {
  test('before loading, returns fallback', () => {
    createTestController({
      locales: {
        pt: { hello: 'olá' },
      },
    });

    expect(__`hello`).toBe('hello');
  });

  test('after loading, returns translation', async () => {
    const controller = createTestController({
      locales: {
        pt: { hello: 'olá' },
      },
    });

    await controller.setLocale('pt');

    expect(__`hello`).toBe('olá');
  });
});

describe('interpolation', () => {
  test('simple interpolation', async () => {
    const controller = createTestController({
      locales: {
        pt: { 'hello {1}': 'olá {1}' },
      },
    });

    await controller.setLocale('pt');

    expect(__`hello ${'world'}`).toBe('olá world');
  });
});

describe('pluralization', () => {
  test('plural translations work after loading', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          '# apples': {
            one: 'uma maçã',
            '+2': '# maçãs',
            zero: 'nenhuma maçã',
            many: 'muitas maçãs',
            manyLimit: 10,
          },
        },
      },
    });

    await controller.setLocale('pt');

    expect(__p(1)`# apples`).toBe('uma maçã');
    expect(__p(2)`# apples`).toBe('2 maçãs');
    expect(__p(0)`# apples`).toBe('nenhuma maçã');
    expect(__p(11)`# apples`).toBe('muitas maçãs');
  });
});

describe('$ prefix handling', () => {
  test('returns ellipsis for translations starting with $', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(__`$placeholder_text`).toBe('…');
    expect(__`$pending_translation`).toBe('…');
  });

  test('returns ellipsis for $ prefix even with interpolation', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(__`$pending ${'value'}`).toBe('…');
  });
});
