import { createCliTestContext } from '@ls-stack/i18n-core/cli';
import { expect, test } from 'vitest';

const mainTsx = `
import { __, __p, i18nitialize } from '@ls-stack/i18n';

i18nitialize({
  locales: [
    { id: 'pt', loader: async () => ({}) },
    { id: 'en', loader: async () => ({}) },
  ],
  persistenceKey: 'locale',
  fallbackLocale: 'en',
});

export const translation = __\`Hello World\`;

export const pluralTranslation = __p(1)\`# Hello World\`;

export const translationWithInterpolation = __\`Hello \${'World'}\`;

export function Component() {
  return <div>{translation}</div>;
}
`;

const ptCorrectTranslations = {
  'Hello World': 'Olá Mundo',
  'Hello {1}': 'Olá {1}',
  '# Hello World': {
    zero: 'Nenhuma saudação',
    one: '1 saudação',
    '+2': '# saudações',
    many: 'Muitas saudações',
    manyLimit: 50,
  },
};

const enCorrectTranslations = {
  'Hello World': 'Hello World',
  'Hello {1}': 'Hello {1}',
  '# Hello World': {
    zero: 'No greetings',
    one: '1 greeting',
    '+2': '# greetings',
    many: 'Many greetings',
    manyLimit: 50,
  },
};

test('validates translations in tsx files', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
    },
    config: {
      'en.json': JSON.stringify(enCorrectTranslations),
      'pt.json': JSON.stringify(ptCorrectTranslations),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
        "✅ pt.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
        "✅ pt.json translations are up to date",
      ],
    }
  `);
});

test('detects missing translations in tsx files', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
    },
    config: {
      'en.json': JSON.stringify({}),
      'pt.json': JSON.stringify({}),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('en.json has invalid translations'),
  );
  expect(result.errors).toContainEqual(
    expect.stringContaining('pt.json has invalid translations'),
  );
});

test('default locale skips string translations in non-fix mode', async () => {
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

  const result = await ctx.validate({ defaultLocale: 'en' });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('handles mixed .ts and .tsx files', async () => {
  const utilTs = `
import { __ } from '@ls-stack/i18n';

export const sharedTranslation = __\`Shared translation\`;
`;

  const componentTsx = `
import { __ } from '@ls-stack/i18n';

export function Component() {
  return <div>{__\`Component translation\`}</div>;
}
`;

  const ctx = createCliTestContext({
    src: {
      'util.ts': utilTs,
      'component.tsx': componentTsx,
    },
    config: {
      'en.json': JSON.stringify({
        'Shared translation': 'Shared translation',
        'Component translation': 'Component translation',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('scans the same source files compiled by the vite plugin', async () => {
  const ctx = createCliTestContext({
    src: {
      'legacy/banner.jsx': `
import { __ } from '@ls-stack/i18n';

export function Banner() {
  return <p>{__\`Legacy banner\`}</p>;
}
`,
      'legacy/format.js': `
import { __ } from '@ls-stack/i18n';

export const formatError = () => __\`Something went wrong\`;
`,
      'server/routes.mts': `
import { __ } from '@ls-stack/i18n';

export const notFound = __\`Page not found\`;
`,
      'types/i18n.d.ts': `
import { __ } from '@ls-stack/i18n';

export declare const typeOnly: typeof __;
declare const example = __\`Only in a declaration file\`;
`,
    },
    config: {
      'en.json': JSON.stringify({
        'Legacy banner': 'Legacy banner',
        'Something went wrong': 'Something went wrong',
        'Page not found': 'Page not found',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('parses .ts files with generic arrow functions', async () => {
  const ctx = createCliTestContext({
    src: {
      'utils/list.ts': `
        import { __ } from '@ls-stack/i18n';

        const identity = <T>(value: T) => value;

        export const emptyListLabel = identity(__\`No items found\`);
        export const loadMoreLabel = __\`Load more\`;
      `,
      'components/Header.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const title = __\`Inbox\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({}),
      'pt.json': JSON.stringify({
        Inbox: 'Caixa de entrada',
        'No items found': 'Nenhum item encontrado',
        'Load more': 'Carregar mais',
      }),
    },
  });

  await ctx.validate({ fix: true, defaultLocale: 'en' });

  const ptLocale: unknown = JSON.parse(ctx.getConfigFileRaw('pt.json') ?? '');

  expect(ptLocale).toEqual({
    Inbox: 'Caixa de entrada',
    'No items found': 'Nenhum item encontrado',
    'Load more': 'Carregar mais',
  });
});

test('finds calls with a comment between the tag and the template', async () => {
  const ctx = createCliTestContext({
    src: {
      'components/Toast.tsx': `
        import { __ } from '../translate';

        export const savedLabel = __ /* toast title */ \`Saved\`;
      `,
      'components/Header.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const title = __\`Inbox\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({}),
      'pt.json': JSON.stringify({ Inbox: 'Caixa de entrada', Saved: 'Salvo' }),
    },
  });

  await ctx.validate({ fix: true, defaultLocale: 'en' });

  const ptLocale: unknown = JSON.parse(ctx.getConfigFileRaw('pt.json') ?? '');

  expect(ptLocale).toEqual({ Inbox: 'Caixa de entrada', Saved: 'Salvo' });
});

test('handles nested source directories', async () => {
  const ctx = createCliTestContext({
    src: {
      'components/Button.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const label = __\`Button\`;
      `,
      'pages/home/Home.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const title = __\`Home Page\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Button: 'Button',
        'Home Page': 'Home Page',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('detects unicode characters in translation keys', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`Hello 世界\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Hello 世界': 'Hello 世界',
      }),
      'zh.json': JSON.stringify({
        'Hello 世界': '你好世界',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
        "✅ zh.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
        "✅ zh.json translations are up to date",
      ],
    }
  `);
});

// === JSX Translation Functions ===

test('detects __jsx translations', async () => {
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

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('detects __pjsx plural translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __pjsx } from '@ls-stack/i18n';
        export function Component({ count }: { count: number }) {
          return __pjsx(count)\`# \${<b>items</b>} in cart\`;
        }
      `,
    },
    config: {
      'en.json': JSON.stringify({
        '# {1} in cart': {
          zero: 'No {1} in cart',
          one: '1 {1} in cart',
          '+2': '# {1} in cart',
          many: 'Many {1} in cart',
          manyLimit: 50,
        },
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('detects missing __jsx translations', async () => {
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
      'en.json': JSON.stringify({}),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(expect.stringContaining('missing 1'));
});

test('detects missing __pjsx translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __pjsx } from '@ls-stack/i18n';
        export function Component({ count }: { count: number }) {
          return __pjsx(count)\`# \${<b>items</b>} in cart\`;
        }
      `,
    },
    config: {
      'en.json': JSON.stringify({}),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(expect.stringContaining('missing 1'));
});

test('handles mixed __, __p, __jsx, and __pjsx in same file', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __, __p, __jsx, __pjsx } from '@ls-stack/i18n';

        export const text = __\`Plain text\`;
        export const plural = __p(5)\`# items\`;
        export const jsx = __jsx\`Click \${<b>here</b>}\`;
        export const jsxPlural = __pjsx(5)\`# \${<b>items</b>} selected\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Plain text': 'Plain text',
        '# items': {
          zero: 'No items',
          one: '1 item',
          '+2': '# items',
        },
        'Click {1}': 'Click {1}',
        '# {1} selected': {
          zero: 'No {1} selected',
          one: '1 {1} selected',
          '+2': '# {1} selected',
        },
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('detects property access translation functions', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import * as i18n from '@ls-stack/i18n';

        export const text = i18n.__\`Plain text\`;
        export const plural = i18n.__p(5)\`# items\`;
        export const jsx = i18n.__jsx\`Click \${<b>here</b>}\`;
        export const jsxPlural = i18n.__pjsx(5)\`# \${<b>items</b>} selected\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Plain text': 'Plain text',
        '# items': {
          zero: 'No items',
          one: '1 item',
          '+2': '# items',
        },
        'Click {1}': 'Click {1}',
        '# {1} selected': {
          zero: 'No {1} selected',
          one: '1 {1} selected',
          '+2': '# {1} selected',
        },
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

// === Variant and $ Prefixed Translation Validation ===

test('variant translation equal to key is invalid', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`Hello~~formal\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Hello~~formal': 'Hello~~formal',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('invalid special translations'),
  );
  expect(result.errors.some((error) => error.includes('Hello~~formal'))).toBe(
    true,
  );
});

test('$ prefixed translation equal to key is invalid', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`$terms\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        $terms: '$terms',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('invalid special translations'),
  );
  expect(result.errors.some((error) => error.includes('$terms'))).toBe(true);
});

test('variant translation with different value is valid', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Hello\`;
        export const t2 = __\`Hello~~formal\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello',
        'Hello~~formal': 'Good day',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('$ prefixed translation with different value is valid', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`$terms\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        $terms: 'Terms and conditions text here...',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('variant translation with null value is valid (pending)', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`Hello~~formal\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Hello~~formal': null,
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('$ prefixed translation with null value is valid (pending)', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`$terms\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        $terms: null,
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
      ],
    }
  `);
});

test('check mode reports existing null translations as missing for non-default locale', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Hello\`;
        export const t2 = __\`World\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello translation',
        World: 'World translation',
      }),
      'pt.json': JSON.stringify({
        Hello: 'Olá tradução',
        World: null,
      }),
    },
  });

  const result = await ctx.validate({ fix: false, defaultLocale: 'en' });

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(expect.stringContaining('missing 1'));
});

const mainIds = {
  version: 1,
  ids: {
    'p:# Hello World': 0,
    's:Hello World': 1,
    's:Hello {1}': 2,
  },
};

function createIdsFixture(idsFile: string | null) {
  return createCliTestContext({
    src: { 'main.tsx': mainTsx },
    config: {
      'en.json': JSON.stringify(enCorrectTranslations),
      'pt.json': JSON.stringify(ptCorrectTranslations),
    },
    idsFile,
  });
}

test('fix creates the ids file', async () => {
  const ctx = createIdsFixture(null);

  const result = await ctx.validate({ fix: true });

  expect(result.hasError).toBe(false);
  expect(result.infos).toContain('✅ i18n-ids.json translation ids created');
  expect(ctx.getIdsFile()).toBe(`${JSON.stringify(mainIds, null, 2)}\n`);
});

test('an up to date ids file is valid', async () => {
  const ctx = createIdsFixture(JSON.stringify(mainIds, null, 2));

  const result = await ctx.validate();

  expect(result.hasError).toBe(false);
  expect(result.errors).toEqual([]);
});

test('check mode reports a missing ids file', async () => {
  const ctx = createIdsFixture(null);

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContain(
    '❌ i18n-ids.json not found, run with --fix to update the translation ids',
  );
  expect(ctx.getIdsFile()).toBeUndefined();
});

test('check mode reports an outdated ids file', async () => {
  const ctx = createIdsFixture(
    JSON.stringify({
      version: 1,
      ids: { 's:Hello World': 0, 's:Goodbye World': 1 },
    }),
  );

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContain(
    '❌ i18n-ids.json is outdated, run with --fix to update the translation ids',
  );
});

test('fix keeps the ids of the existing translations and reuses the free ones', async () => {
  const ctx = createIdsFixture(
    JSON.stringify({
      version: 1,
      ids: { 's:Goodbye World': 0, 's:Hello World': 1, 's:Hello {1}': 2 },
    }),
  );

  const result = await ctx.validate({ fix: true });

  expect(result.hasError).toBe(false);
  expect(result.infos).toContain('✅ i18n-ids.json translation ids updated');
  expect(JSON.parse(ctx.getIdsFile() ?? '')).toEqual({
    version: 1,
    ids: { 'p:# Hello World': 0, 's:Hello World': 1, 's:Hello {1}': 2 },
  });
});

test('fix resolves an id taken by two translations after a merge', async () => {
  const ctx = createIdsFixture(
    JSON.stringify({
      version: 1,
      ids: { 'p:# Hello World': 0, 's:Hello World': 1, 's:Hello {1}': 1 },
    }),
  );

  // the build resolves it the same way, so it doesn't fail the check
  const checkResult = await ctx.validate();
  expect(checkResult.hasError).toBe(false);
  expect(checkResult.infos).toContain(
    '🟠 i18n-ids.json has ids taken by two translations, run with --fix so the ids of both stay stable',
  );

  await ctx.validate({ fix: true });

  expect(JSON.parse(ctx.getIdsFile() ?? '')).toEqual(mainIds);
});

test('reports an invalid ids file', async () => {
  const ctx = createIdsFixture('{ "ids": {} }');

  const result = await ctx.validate({ fix: true });

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('❌ i18n-ids.json: Invalid ids file'),
  );
  expect(ctx.getIdsFile()).toBe('{ "ids": {} }');
});

test('the ids file only lists the translations compiled by the vite plugin', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
      'server.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        import en from './locales/en.json';

        const i18n = i18nitialize({ locales: { en } }).with('en');

        export const emailSubject = i18n.__\`Your weekly summary\`;
      `,
    },
    config: {
      'en.json': JSON.stringify(enCorrectTranslations),
      'pt.json': JSON.stringify(ptCorrectTranslations),
    },
    idsFile: null,
  });

  await ctx.validate({ fix: true });

  expect(JSON.parse(ctx.getIdsFile() ?? '')).toEqual(mainIds);
});

test('the ids file lists the translations of every src dir', async () => {
  const ctx = createCliTestContext({
    src: { 'main.tsx': mainTsx },
    packageSrc: {
      'Button.tsx': `
        import { __ } from '@ls-stack/i18n';

        export function SaveButton() {
          return <button>{__\`Save changes\`}</button>;
        }
      `,
    },
    config: {
      'en.json': JSON.stringify({
        ...enCorrectTranslations,
        'Save changes': 'Save changes',
      }),
      'pt.json': JSON.stringify({
        ...ptCorrectTranslations,
        'Save changes': 'Salvar alterações',
      }),
    },
    idsFile: null,
  });

  await ctx.validate({ fix: true });

  expect(JSON.parse(ctx.getIdsFile() ?? '')).toEqual({
    version: 1,
    ids: {
      'p:# Hello World': 0,
      's:Hello World': 1,
      's:Hello {1}': 2,
      's:Save changes': 3,
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(false);
  expect(result.errors).toEqual([]);
});
