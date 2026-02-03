/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { __jsx, __pjsx, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
});

afterEach(() => {
  cleanup();
});

describe('__jsx basic translation', () => {
  test('before loading, returns fallback as ReactNode', () => {
    createTestController({
      locales: {
        pt: { hello: 'olá' },
      },
    });

    render(<div data-testid="result">{__jsx`hello`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('hello');
  });

  test('after loading, returns translation as ReactNode', async () => {
    const controller = createTestController({
      locales: {
        pt: { hello: 'olá' },
      },
    });

    await controller.setLocale('pt');

    render(<div data-testid="result">{__jsx`hello`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('olá');
  });

  test('missing translation falls back to hash', async () => {
    const controller = createTestController({
      locales: {
        pt: { hello: 'olá' },
      },
    });

    await controller.setLocale('pt');

    render(<div data-testid="result">{__jsx`missing translation`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('missing translation');
  });
});

describe('__jsx interpolation', () => {
  test('string interpolation', async () => {
    const controller = createTestController({
      locales: {
        pt: { 'hello {1}': 'olá {1}' },
      },
    });

    await controller.setLocale('pt');

    render(<div data-testid="result">{__jsx`hello ${'world'}`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('olá world');
  });

  test('number interpolation', async () => {
    const controller = createTestController({
      locales: {
        en: { 'count: {1}': 'total: {1}' },
      },
    });

    await controller.setLocale('en');

    render(<div data-testid="result">{__jsx`count: ${42}`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('total: 42');
  });

  test('ReactNode interpolation', async () => {
    const controller = createTestController({
      locales: {
        pt: { 'click {1} to continue': 'clique {1} para continuar' },
      },
    });

    await controller.setLocale('pt');

    render(
      <div data-testid="result">
        {__jsx`click ${<strong>here</strong>} to continue`}
      </div>,
    );

    expect(screen.getByTestId('result').textContent).toBe(
      'clique here para continuar',
    );
    expect(screen.getByText('here').tagName).toBe('STRONG');
  });

  test('multiple ReactNode interpolations', async () => {
    const controller = createTestController({
      locales: {
        en: { '{1} and {2} are friends': '{1} e {2} são amigos' },
      },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">
        {__jsx`${<strong>Alice</strong>} and ${<em>Bob</em>} are friends`}
      </div>,
    );

    expect(screen.getByTestId('result').textContent).toBe('Alice e Bob são amigos');
    expect(screen.getByText('Alice').tagName).toBe('STRONG');
    expect(screen.getByText('Bob').tagName).toBe('EM');
  });

  test('mixed string, number, and ReactNode interpolations', async () => {
    const controller = createTestController({
      locales: {
        en: { '{1} has {2} {3}': '{1} possui {2} {3}' },
      },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">
        {__jsx`${<strong>Lucas</strong>} has ${5} ${'apples'}`}
      </div>,
    );

    expect(screen.getByTestId('result').textContent).toBe('Lucas possui 5 apples');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
  });

  test('fallback to hash with ReactNode interpolation when missing', async () => {
    const controller = createTestController({
      locales: {
        en: {},
      },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">{__jsx`not found ${<strong>bold</strong>}`}</div>,
    );

    expect(screen.getByTestId('result').textContent).toBe('not found bold');
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });
});

describe('__jsx $ prefix handling', () => {
  test('returns ellipsis for translations starting with $', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    render(<div data-testid="result">{__jsx`$placeholder_text`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('…');
  });

  test('returns ellipsis for $ prefix even with ReactNode interpolation', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">
        {__jsx`$pending ${<strong>value</strong>}`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('…');
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

    const { unmount } = render(
      <div data-testid="result">{__jsx`$terms_of_service`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'These are the terms of service...',
    );
    unmount();

    render(
      <div data-testid="result">
        {__jsx`$welcome ${<strong>John</strong>}`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'Welcome to our platform, John!',
    );
    expect(screen.getByText('John').tagName).toBe('STRONG');
  });
});

describe('__jsx translation variants (~~)', () => {
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

    const { unmount } = render(
      <div data-testid="result">{__jsx`hello ${<strong>Lucas</strong>}`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('olá Lucas');
    unmount();

    render(
      <div data-testid="result">
        {__jsx`hello ${<strong>Lucas</strong>}~~formal`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('olá Lucas, como vai?');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
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
    render(
      <div data-testid="result">
        {__jsx`hello ${<strong>Lucas</strong>}~~formal`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('hello Lucas');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
  });

  test('falls back to hash when base translation also missing', async () => {
    const controller = createTestController({
      locales: {
        en: {},
      },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">
        {__jsx`hello ${<strong>Lucas</strong>}~~formal`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('hello Lucas');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
  });
});

describe('__jsx error handling', () => {
  test('logs error when plural translation used with __jsx', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          '# apples': {
            one: 'uma maçã',
            '+2': '# maçãs',
          },
        },
      },
    });

    await controller.setLocale('pt');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<div data-testid="result">{__jsx`# apples`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('# apples');
    expect(errorSpy).toHaveBeenCalledWith(
      'Invalid translation, this translation should use the plural `__pjsx` method',
    );

    errorSpy.mockRestore();
  });
});

describe('__pjsx basic plural translation', () => {
  test('before loading, returns fallback with # replacement', () => {
    createTestController({
      locales: {
        pt: {
          '# items': {
            one: 'um item',
            '+2': '# itens',
          },
        },
      },
    });

    render(<div data-testid="result">{__pjsx(5)`# items`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('5 items');
  });

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

    const { unmount: unmount1 } = render(
      <div data-testid="result">{__pjsx(1)`# apples`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('uma maçã');
    unmount1();

    const { unmount: unmount0 } = render(
      <div data-testid="result">{__pjsx(0)`# apples`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('nenhuma maçã');
    unmount0();

    const { unmount: unmount11 } = render(
      <div data-testid="result">{__pjsx(11)`# apples`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('muitas maçãs');
    unmount11();

    render(<div data-testid="result">{__pjsx(2)`# apples`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('2 maçãs');
  });

  test('missing plural translation falls back with # replacement', async () => {
    const controller = createTestController({
      locales: {
        pt: {},
      },
    });

    await controller.setLocale('pt');

    render(<div data-testid="result">{__pjsx(3)`# items`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('3 items');
  });
});

describe('__pjsx with ReactNode interpolation', () => {
  test('plural with ReactNode interpolation', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# comments by {1}': {
            one: '1 comment by {1}',
            '+2': '# comments by {1}',
          },
        },
      },
    });

    await controller.setLocale('en');

    const { unmount } = render(
      <div data-testid="result">
        {__pjsx(1)`# comments by ${<strong>Lucas</strong>}`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('1 comment by Lucas');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
    unmount();

    render(
      <div data-testid="result">
        {__pjsx(5)`# comments by ${<strong>Lucas</strong>}`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('5 comments by Lucas');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
  });

  test('plural fallback with ReactNode interpolation', async () => {
    const controller = createTestController({
      locales: {
        en: {},
      },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">
        {__pjsx(3)`# items for ${<strong>Lucas</strong>}`}
      </div>,
    );

    expect(screen.getByTestId('result').textContent).toBe('3 items for Lucas');
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
  });
});

describe('__pjsx $ prefix handling', () => {
  test('returns ellipsis for translations starting with $', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    render(<div data-testid="result">{__pjsx(5)`$placeholder`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('…');
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

    const { unmount: unmount0 } = render(
      <div data-testid="result">{__pjsx(0)`$# large_items`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'No items in your collection',
    );
    unmount0();

    const { unmount: unmount1 } = render(
      <div data-testid="result">{__pjsx(1)`$# large_items`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'One item in your collection',
    );
    unmount1();

    render(<div data-testid="result">{__pjsx(5)`$# large_items`}</div>);
    expect(screen.getByTestId('result').textContent).toBe(
      '5 items in your collection',
    );
  });
});

describe('__pjsx translation variants (~~)', () => {
  test('returns variant plural translation when found', async () => {
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

    const { unmount: unmount1 } = render(
      <div data-testid="result">{__pjsx(1)`# items`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('1 item');
    unmount1();

    const { unmount: unmount5 } = render(
      <div data-testid="result">{__pjsx(5)`# items`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('5 items');
    unmount5();

    const { unmount: unmountV1 } = render(
      <div data-testid="result">{__pjsx(1)`# items~~verbose`}</div>,
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'You have exactly 1 item',
    );
    unmountV1();

    render(<div data-testid="result">{__pjsx(5)`# items~~verbose`}</div>);
    expect(screen.getByTestId('result').textContent).toBe(
      'You have exactly 5 items',
    );
  });

  test('variant plural with ReactNode interpolation', async () => {
    const controller = createTestController({
      locales: {
        en: {
          '# items for {1}': {
            one: '1 item for {1}',
            '+2': '# items for {1}',
          },
          '# items for {1}~~verbose': {
            one: 'You have exactly 1 item for {1}',
            '+2': 'You have exactly # items for {1}',
          },
        },
      },
    });

    await controller.setLocale('en');

    render(
      <div data-testid="result">
        {__pjsx(5)`# items for ${<strong>Lucas</strong>}~~verbose`}
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'You have exactly 5 items for Lucas',
    );
    expect(screen.getByText('Lucas').tagName).toBe('STRONG');
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

    render(<div data-testid="result">{__pjsx(5)`# items~~verbose`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('5 items');
  });
});

describe('__pjsx error handling', () => {
  test('logs error when missing plural form', async () => {
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

    render(<div data-testid="result">{__pjsx(2)`# apples`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('2 apples');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  test('logs error when non-plural translation used with __pjsx', async () => {
    const controller = createTestController({
      locales: {
        pt: {
          hello: 'olá',
        },
      },
    });

    await controller.setLocale('pt');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<div data-testid="result">{__pjsx(1)`hello`}</div>);
    expect(screen.getByTestId('result').textContent).toBe('hello');
    expect(errorSpy).toHaveBeenCalledWith(
      'Invalid translation, this translation should use the `__jsx` method',
    );

    errorSpy.mockRestore();
  });
});
