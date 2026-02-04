import { createCliTestContext } from '@ls-stack/i18n-core/cli';
import { expect, test, describe } from 'vitest';

describe('constant-translation', () => {
  test('error when translation is identical across all locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`OK\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          OK: 'OK',
        }),
        'pt.json': JSON.stringify({
          OK: 'OK',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('constant translation "OK" has the same value in all locales'),
    );
  });

  test('no error when translations differ between locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          Hello: 'Hello',
        }),
        'pt.json': JSON.stringify({
          Hello: 'Olá',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(false);
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('skip constant check for $ prefixed translations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`$brandName\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          $brandName: 'Acme Corp',
        }),
        'pt.json': JSON.stringify({
          $brandName: 'Acme Corp',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(false);
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('skip constant check for ~~ variant translations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello~~formal\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Hello~~formal': 'Good day',
        }),
        'pt.json': JSON.stringify({
          'Hello~~formal': 'Good day',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(false);
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('no error when only one locale has the translation', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          Hello: 'Hello',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('no constant-translation error when fallback locale is missing key and others have same value', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hi\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({}), // Hi key doesn't exist
        'pt.json': JSON.stringify({
          Hi: 'Ola',
        }),
        'es.json': JSON.stringify({
          Hi: 'Ola',
        }),
      },
    });

    const result = await ctx.validate({ defaultLocale: 'en' });

    // The fallback locale effectively uses "Hi" (the key) as the translation,
    // while pt and es use "Ola", so values differ - no constant-translation error
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('constant-translation error when fallback is missing key but others match the key value', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hi\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({}), // Hi key doesn't exist
        'pt.json': JSON.stringify({
          Hi: 'Hi',
        }),
        'es.json': JSON.stringify({
          Hi: 'Hi',
        }),
      },
    });

    const result = await ctx.validate({ defaultLocale: 'en' });

    // The fallback locale effectively uses "Hi" (the key),
    // and pt/es also use "Hi", so all values are the same - constant-translation error
    expect(result.errors).toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });
});

describe('unnecessary-plural', () => {
  test('error when plural only uses +2 form in all locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            '+2': '# items',
          },
        }),
        'pt.json': JSON.stringify({
          '# items': {
            '+2': '# itens',
          },
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('unnecessary plural "# items" only uses the +2 form'),
    );
  });

  test('no error when any locale uses zero/one/many form', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            zero: 'No items',
            one: '1 item',
            '+2': '# items',
          },
        }),
        'pt.json': JSON.stringify({
          '# items': {
            '+2': '# itens',
          },
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('unnecessary plural'),
    );
  });

  test('no error for regular plurals with multiple forms', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            zero: 'No items',
            one: '1 item',
            '+2': '# items',
            many: 'Many items',
            manyLimit: 50,
          },
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('unnecessary plural'),
    );
  });
});

describe('jsx-without-interpolation', () => {
  test('error when __jsx has no {n} placeholders', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`Hello World\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Hello World': 'Hello World',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('__jsx used without interpolations for "Hello World"'),
    );
  });

  test('no error when __jsx has interpolation placeholders', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`Click \${<b>here</b>} to continue\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Click {1} to continue': 'Click {1} to continue',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('__jsx used without interpolations'),
    );
  });

  test('no error for regular __ without interpolation', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello World\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Hello World': 'Hello World',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('__jsx used without interpolations'),
    );
  });
});

describe('jsx-without-jsx-nodes', () => {
  test('error when __jsx only has string literal interpolations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`Hello \${'World'}\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Hello {1}': 'Hello {1}',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('__jsx used but all interpolations are primitives'),
    );
  });

  test('error when __jsx only has number literal interpolations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`Count: \${42}\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Count: {1}': 'Count: {1}',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('__jsx used but all interpolations are primitives'),
    );
  });

  test('no error when __jsx has JSX element interpolations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`Click \${<b>here</b>} to continue\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Click {1} to continue': 'Click {1} to continue',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('__jsx used but all interpolations are primitives'),
    );
  });

  test('no error when interpolation type has JSX fragment', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`Click \${<>here</>} to continue\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Click {1} to continue': 'Click {1} to continue',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('__jsx used but all interpolations are primitives'),
    );
  });

  test('error when __jsx has only variable interpolations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component({ name }: { name: string }) {
            return __jsx\`Hello \${name}\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Hello {1}': 'Hello {1}',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('__jsx used but all interpolations are primitives'),
    );
  });
});

describe('unnecessary-interpolated-affix', () => {
  test('error when prefix is identical across all locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Error: \${errorMessage}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Error: {1}': 'Error: {1}',
        }),
        'pt.json': JSON.stringify({
          'Error: {1}': 'Error: {1}',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('prefix "Error: " before interpolation'),
    );
  });

  test('error when suffix is identical across all locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`\${count} items!\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '{1} items!': '{1} items!',
        }),
        'pt.json': JSON.stringify({
          '{1} items!': '{1} items!',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('suffix " items!" after interpolation'),
    );
  });

  test('no error when prefix differs between locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Welcome \${name}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Welcome {1}': 'Welcome {1}',
        }),
        'pt.json': JSON.stringify({
          'Welcome {1}': 'Bem-vindo {1}',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('prefix'),
    );
  });

  test('no error when suffix differs between locales', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`\${count} items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '{1} items': '{1} items',
        }),
        'pt.json': JSON.stringify({
          '{1} items': '{1} itens',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('suffix'),
    );
  });

  test('no error with only one locale', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Error: \${message}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Error: {1}': 'Error: {1}',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('interpolation'),
    );
  });

  test('no error when fallback locale is missing key and others have same prefix', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Welcome \${name}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({}), // Welcome {1} key doesn't exist
        'pt.json': JSON.stringify({
          'Welcome {1}': 'Ola {1}',
        }),
        'es.json': JSON.stringify({
          'Welcome {1}': 'Ola {1}',
        }),
      },
    });

    const result = await ctx.validate({ defaultLocale: 'en' });

    // The fallback locale effectively uses "Welcome {1}" (prefix "Welcome "),
    // while pt and es use "Ola {1}" (prefix "Ola "), so prefixes differ - no error
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('prefix'),
    );
  });

  test('no error when affix is ? ! or .', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t1 = __\`\${question}?\`;
          export const t2 = __\`\${exclaim}!\`;
          export const t3 = __\`\${sentence}.\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '{1}?': '{1}?',
          '{1}!': '{1}!',
          '{1}.': '{1}.',
        }),
        'pt.json': JSON.stringify({
          '{1}?': '{1}?',
          '{1}!': '{1}!',
          '{1}.': '{1}.',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('suffix'),
    );
  });
});

describe('max-translation-id-size', () => {
  test('error when hash exceeds default threshold (80 chars)', async () => {
    const longHash =
      'This is a very long translation key that exceeds eighty characters in length that is really super long';
    expect(longHash.length).toBeGreaterThan(80);

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`${longHash}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          [longHash]: longHash,
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('translation ID exceeds'),
    );
  });

  test('respects custom --max-id-size threshold', async () => {
    const mediumHash = 'This is a medium length translation key that is 50 c';
    expect(mediumHash.length).toBe(52);

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`${mediumHash}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          [mediumHash]: mediumHash,
        }),
      },
    });

    const resultDefault = await ctx.validate();
    expect(resultDefault.errors).not.toContainEqual(
      expect.stringContaining('translation ID exceeds'),
    );

    const resultCustom = await ctx.validate({ maxTranslationIdSize: 50 });
    expect(resultCustom.hasError).toBe(true);
    expect(resultCustom.errors).toContainEqual(
      expect.stringContaining('translation ID exceeds'),
    );
  });

  test('skip size check for $ prefixed translations', async () => {
    const longHash =
      '$this_is_a_very_long_placeholder_name_that_exceeds_eighty_characters_in_length_really_super_long';
    expect(longHash.length).toBeGreaterThan(80);

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`${longHash}\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          [longHash]: 'Some value',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).not.toContainEqual(
      expect.stringContaining('translation ID exceeds'),
    );
  });
});

describe('configuration options', () => {
  test('--disable-rule disables specific validation', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`OK\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          OK: 'OK',
        }),
        'pt.json': JSON.stringify({
          OK: 'OK',
        }),
      },
    });

    const resultEnabled = await ctx.validate();
    expect(resultEnabled.hasError).toBe(true);
    expect(resultEnabled.errors).toContainEqual(
      expect.stringContaining('constant translation'),
    );

    const resultDisabled = await ctx.validate({
      rules: {
        'constant-translation': 'off',
      },
    });
    expect(resultDisabled.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('--warn-rule downgrades error to warning', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`OK\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          OK: 'OK',
        }),
        'pt.json': JSON.stringify({
          OK: 'OK',
        }),
      },
    });

    const resultError = await ctx.validate();
    expect(resultError.hasError).toBe(true);
    expect(resultError.errors).toContainEqual(
      expect.stringContaining('constant translation'),
    );

    const resultWarning = await ctx.validate({
      rules: {
        'constant-translation': 'warning',
      },
    });
    expect(resultWarning.hasError).toBe(false);
    expect(resultWarning.infos).toContainEqual(
      expect.stringContaining('constant translation'),
    );
    expect(resultWarning.infos).toContainEqual(expect.stringContaining('⚠️'));
  });

  test('multiple rules can be configured independently', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx, __p } from '@ls-stack/i18n';
          export const t1 = __jsx\`Static text\`;
          export const t2 = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Static text': 'Static text',
          '# items': {
            '+2': '# items',
          },
        }),
        'pt.json': JSON.stringify({
          'Static text': 'Static text',
          '# items': {
            '+2': '# itens',
          },
        }),
      },
    });

    const result = await ctx.validate({
      rules: {
        'constant-translation': 'off',
        'jsx-without-interpolation': 'warning',
        'unnecessary-plural': 'error',
      },
    });

    expect(result.hasError).toBe(true);
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
    expect(result.infos).toContainEqual(
      expect.stringContaining('__jsx used without interpolations'),
    );
    expect(result.errors).toContainEqual(
      expect.stringContaining('unnecessary plural'),
    );
  });
});

describe('line number reporting', () => {
  test('error message includes file path and line number', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`OK\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          OK: 'OK',
        }),
        'pt.json': JSON.stringify({
          OK: 'OK',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).toContainEqual(
      expect.stringMatching(/main\.tsx:\d+:\d+ constant translation/),
    );
  });

  test('line number is accurate for multi-line files', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `import { __ } from '@ls-stack/i18n';

const unused1 = 'unused';
const unused2 = 'unused';
const unused3 = 'unused';

export const t = __\`OK\`;
`,
      },
      config: {
        'en.json': JSON.stringify({
          OK: 'OK',
        }),
        'pt.json': JSON.stringify({
          OK: 'OK',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).toContainEqual(expect.stringContaining('main.tsx:7:'));
  });

  test('reports first location when hash is used multiple times', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `import { __ } from '@ls-stack/i18n';
export const t1 = __\`OK\`;
export const t2 = __\`OK\`;
export const t3 = __\`OK\`;
`,
      },
      config: {
        'en.json': JSON.stringify({
          OK: 'OK',
        }),
        'pt.json': JSON.stringify({
          OK: 'OK',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).toContainEqual(expect.stringContaining('main.tsx:2:'));
  });
});

describe('incomplete plural translations', () => {
  test('error when non-default locale has +2: null', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            '+2': '# items',
          },
        }),
        'pt.json': JSON.stringify({
          '# items': {
            '+2': null,
          },
        }),
      },
    });

    const result = await ctx.validate({ defaultLocale: 'en' });

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining("incomplete plural translations ('+2' is null"),
    );
  });

  test('no error when default locale has +2: null', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            '+2': null,
          },
        }),
        'pt.json': JSON.stringify({
          '# items': {
            '+2': '# itens',
          },
        }),
      },
    });

    const result = await ctx.validate({ defaultLocale: 'en' });

    expect(result.errors).not.toContainEqual(
      expect.stringContaining("incomplete plural translations"),
    );
  });

  test('no error when +2 has a value in non-default locale', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            '+2': '# items',
          },
        }),
        'pt.json': JSON.stringify({
          '# items': {
            '+2': '# itens',
          },
        }),
      },
    });

    const result = await ctx.validate({ defaultLocale: 'en' });

    expect(result.errors).not.toContainEqual(
      expect.stringContaining("incomplete plural translations"),
    );
  });
});

describe('edge cases', () => {
  test('handles plural with null translation gracefully', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const t = __p(5)\`# items\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            '+2': '# items',
          },
        }),
        'pt.json': JSON.stringify({
          '# items': null,
        }),
      },
    });

    await expect(ctx.validate()).resolves.not.toThrow();
  });

  test('handles empty translation file gracefully', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({}),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('constant translation'),
    );
  });

  test('property access __jsx also triggers jsx validations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import * as i18n from '@ls-stack/i18n';
          export function Component() {
            return i18n.__jsx\`Hello World\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'Hello World': 'Hello World',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.hasError).toBe(true);
    expect(result.errors).toContainEqual(
      expect.stringContaining('__jsx used without interpolations'),
    );
  });

  test('property access __pjsx also triggers jsx validations', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import * as i18n from '@ls-stack/i18n';
          export function Component() {
            return i18n.__pjsx(5)\`# items\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          '# items': {
            '+2': '# items',
          },
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors).toContainEqual(
      expect.stringContaining('unnecessary plural'),
    );
  });

  test('does not report jsx-without-jsx-nodes when jsx-without-interpolation would already apply', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __jsx } from '@ls-stack/i18n';
          export function Component() {
            return __jsx\`No interpolations at all\`;
          }
        `,
      },
      config: {
        'en.json': JSON.stringify({
          'No interpolations at all': 'No interpolations at all',
        }),
      },
    });

    const result = await ctx.validate();

    expect(result.errors.filter((e) => e.includes('__jsx used'))).toHaveLength(
      1,
    );
    expect(result.errors).toContainEqual(
      expect.stringContaining('__jsx used without interpolations'),
    );
    expect(result.errors).not.toContainEqual(
      expect.stringContaining('__jsx used but all interpolations are primitives'),
    );
  });
});
