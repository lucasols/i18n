import { beforeEach, describe, expect, test, vi } from 'vitest';
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
          'my name is {1} and i am {2} years old': 'name: {1}, age: {2}',
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

  test('missing plural translation falls back with # replacement', async () => {
    const controller = createTestController({
      locales: {
        pt: {},
      },
    });

    await controller.setLocale('pt');

    expect(__p(2)`# apples`).toBe('2 apples');
  });

  test('missing plural form falls back with # replacement and logs error', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          '# apples': {
            one: 'uma maçã',
          },
        },
      },
    });

    await controller.setLocale('pt');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(__p(2)`# apples`).toBe('2 apples');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
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

  test('returns actual translation when $ prefix translation exists', async () => {
    const controller = createTestController({
      locales: {
        en: {
          $terms_of_service: 'These are the terms of service...',
          '$welcome {1}': 'Welcome to our platform, {1}!',
        },
      },
    });

    await controller.setLocale('en');

    expect(__`$terms_of_service`).toBe('These are the terms of service...');
    expect(__`$welcome ${'John'}`).toBe('Welcome to our platform, John!');
  });

  test('returns ellipsis for $ prefix with plurals when missing', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(__p(5)`$# large_items`).toBe('…');
  });

  test('returns actual plural translation when $ prefix translation exists', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '$# large_items': {
            zero: 'No items in your collection',
            one: 'One item in your collection',
            '+2': '# items in your collection',
          },
        },
      },
    });

    await controller.setLocale('en');

    expect(__p(0)`$# large_items`).toBe('No items in your collection');
    expect(__p(1)`$# large_items`).toBe('One item in your collection');
    expect(__p(5)`$# large_items`).toBe('5 items in your collection');
  });
});

describe('translation variants (~~)', () => {
  test('returns variant translation when found', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          'hello {1}': 'olá {1}',
          'hello {1}~~formal': 'olá {1}, como vai?',
        },
      },
    });

    await controller.setLocale('pt');

    expect(__`hello ${'Lucas'}`).toBe('olá Lucas');
    expect(__`hello ${'Lucas'}~~formal`).toBe('olá Lucas, como vai?');
  });

  test('falls back to source string when variant missing', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          'hello {1}': 'olá {1}',
        },
      },
    });

    await controller.setLocale('pt');

    // Falls back to source string (hash) without variant suffix, not the base translation
    expect(__`hello ${'Lucas'}~~formal`).toBe('hello Lucas');
  });

  test('falls back to hash when base translation also missing', async () => {
    const controller = createTestController({
      locales: {
        en: {},
      },
    });

    await controller.setLocale('en');

    expect(__`hello ${'Lucas'}~~formal`).toBe('hello Lucas');
  });

  test('variant with simple string (no interpolation)', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          hello: 'olá',
          'hello~~casual': 'oi',
          'hello~~formal': 'bom dia',
        },
      },
    });

    await controller.setLocale('pt');

    expect(__`hello`).toBe('olá');
    expect(__`hello~~casual`).toBe('oi');
    expect(__`hello~~formal`).toBe('bom dia');
  });

  test('variant with plurals', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# items': {
            one: '1 item',
            '+2': '# items',
          },
          '# items~~verbose': {
            one: 'You have exactly 1 item',
            '+2': 'You have exactly # items',
          },
        },
      },
    });

    await controller.setLocale('en');

    expect(__p(1)`# items`).toBe('1 item');
    expect(__p(5)`# items`).toBe('5 items');
    expect(__p(1)`# items~~verbose`).toBe('You have exactly 1 item');
    expect(__p(5)`# items~~verbose`).toBe('You have exactly 5 items');
  });

  test('variant plural falls back to base plural when variant missing', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# items': {
            one: '1 item',
            '+2': '# items',
          },
        },
      },
    });

    await controller.setLocale('en');

    expect(__p(5)`# items~~verbose`).toBe('5 items');
  });
});
