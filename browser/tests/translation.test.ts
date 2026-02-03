import { beforeEach, describe, expect, test } from 'vitest';
import { __, __date, __num, __p, resetState } from '../src/main';
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

  test('hash-only translation', async () => {
    const longTranslation =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

    const controller = createTestController({
      locales: {
        en: { 'long text hash': longTranslation },
      },
    });

    await controller.setLocale('en');

    expect(__`long text hash`).toBe(longTranslation);
  });

  test('after loading, falls back to hash when missing', async () => {
    const controller = createTestController({
      locales: {
        pt: { hello: 'olá' },
      },
    });

    await controller.setLocale('pt');

    expect(__`missing translation`).toBe('missing translation');
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

  test('multiple interpolations', async () => {
    const controller = createTestController({
      locales: {
        en: {
          'my name is {1} and i am {2} years old':
            'name: {1}, age: {2}',
        },
      },
    });

    await controller.setLocale('en');

    expect(__`my name is ${'lucas'} and i am ${24} years old`).toBe(
      'name: lucas, age: 24',
    );
  });

  test('fallback to hash with interpolation when missing', async () => {
    const controller = createTestController({
      locales: {
        en: {},
      },
    });

    await controller.setLocale('en');

    expect(__`not found ${'lucas'} ${24}`).toBe('not found lucas 24');
  });
});

describe('formatted values in translations', () => {
  test('formatted date interpolation', async () => {
    const controller = createTestController({
      locales: {
        'en-GB': {
          'Hoje é {1}': 'Today is {1}',
        },
      },
    });

    await controller.setLocale('en-GB');

    expect(
      __`Hoje é ${__date('2019-01-25', {
        day: 'numeric',
        month: '2-digit',
        year: 'numeric',
      })}`,
    ).toBe('Today is 25/01/2019');

    expect(
      __`Hoje é ${__date(new Date(2021, 1, 26), {
        day: 'numeric',
        month: '2-digit',
        year: 'numeric',
      })}`,
    ).toBe('Today is 26/02/2021');
  });

  test('formatted number interpolation', async () => {
    const controller = createTestController({
      locales: {
        'en-GB': {
          'O valor é {1} somado a {2}': 'The value is {1} added to {2}',
        },
      },
    });

    await controller.setLocale('en-GB');

    expect(
      __`O valor é ${__num(100_000_000)} somado a ${__num(1.99)}`,
    ).toBe('The value is 100,000,000 added to 1.99');
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

  test('uses +2 translation when many/zero are missing', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# comments': {
            one: '1 Comment',
            '+2': '# Comments',
          },
        },
      },
    });

    await controller.setLocale('en');

    expect(__p(1)`# comments`).toBe('1 Comment');
    expect(__p(100)`# comments`).toBe('100 Comments');
  });

  test('plural translations with interpolation', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# comments of {1}': {
            one: '1 Comment of {1}',
            '+2': '# Comments of {1}',
          },
        },
      },
    });

    await controller.setLocale('en');

    expect(__p(1)`# comments of ${'Lucas'}`).toBe('1 Comment of Lucas');
    expect(__p(100)`# comments of ${'Lucas'}`).toBe('100 Comments of Lucas');
  });

  test('falls back to hash when plural form is missing', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# selected': {
            one: '1 Selected',
          },
        },
      },
    });

    await controller.setLocale('en');

    expect(__p(100)`# selected`).toBe('# selected');
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
