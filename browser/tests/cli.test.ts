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
    zero: 'Nenhuma x',
    one: '1 x',
    '+2': '# x',
    many: 'Muitas x',
    manyLimit: 50,
  },
};

const enCorrectTranslations = {
  'Hello World': 'Hello World',
  'Hello {1}': 'Hello {1}',
  '# Hello World': {
    zero: 'No x',
    one: '1 x',
    '+2': '# x',
    many: 'A lot of x',
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
  expect(result.errors).toContainEqual(
    expect.stringContaining('missing 1'),
  );
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
  expect(result.errors).toContainEqual(
    expect.stringContaining('missing 1'),
  );
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
