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

test('fix missing translations in tsx files', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
    },
    config: {
      'en.json': JSON.stringify({}),
      'pt.json': JSON.stringify({ 'Hello World': 'Olá Mundo' }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "🟠 en.json translations keys were added",
        "🟠 pt.json translations keys were added",
      ],
      "output": [
        "🟠 en.json translations keys were added",
        "🟠 pt.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "Hello World": null,
      "Hello {1}": null,
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "": ""
    }"
  `);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "Hello {1}": null,
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "": ""
    }"
  `);
});

test('fix extra translations in tsx files', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
    },
    config: {
      'en.json': JSON.stringify({
        ...enCorrectTranslations,
        'Extra translation': 'Extra translation',
      }),
      'pt.json': JSON.stringify({
        ...ptCorrectTranslations,
        'Extra translation': 'Extra translation',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations fixed",
        "✅ pt.json translations fixed",
      ],
      "output": [
        "✅ en.json translations fixed",
        "✅ pt.json translations fixed",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "Hello World",
      "Hello {1}": "Hello {1}",
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "Hello {1}": "Olá {1}",
      "# Hello World": {
        "zero": "Nenhuma x",
        "one": "1 x",
        "+2": "# x",
        "many": "Muitas x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

test('fix invalid plural translations in tsx files', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
    },
    config: {
      'en.json': JSON.stringify(enCorrectTranslations),
      'pt.json': JSON.stringify({
        ...ptCorrectTranslations,
        '# Hello World': 'Invalid plural',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations are up to date",
        "🟠 pt.json translations keys were added",
      ],
      "output": [
        "✅ en.json translations are up to date",
        "🟠 pt.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "Hello {1}": "Olá {1}",
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "": ""
    }"
  `);
});

test('fix mode with missing translations marker already present', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`Hello\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        '👇 missing translations 👇': '🛑 delete this line 🛑',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "🟠 en.json translations keys were added",
      ],
      "output": [
        "🟠 en.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "Hello": null,
      "": ""
    }"
  `);
});

test('fix mode error when file has only missing marker', async () => {
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
        '👇 missing translations 👇': '🛑 delete this line 🛑',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has missing translations",
      ],
      "hasError": false,
      "infos": [],
      "output": [
        "❌ en.json has missing translations",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(
    `"{"Hello":"Hello","👇 missing translations 👇":"🛑 delete this line 🛑"}"`,
  );
});

test('fix mode handles missing, extra, and invalid plural simultaneously', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __, __p } from '@ls-stack/i18n';
        export const t1 = __\`Hello\`;
        export const t2 = __\`World\`;
        export const t3 = __p(5)\`# items\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello',
        'Extra translation': 'Extra translation',
        '# items': 'Invalid plural string',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "🟠 en.json translations keys were added",
      ],
      "output": [
        "🟠 en.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "Hello": "Hello",
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "World": null,
      "# items": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "": ""
    }"
  `);
});

test('fix mode preserves existing valid translations', async () => {
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
        Hello: 'Custom Hello Translation',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "🟠 en.json translations keys were added",
      ],
      "output": [
        "🟠 en.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "Hello": "Custom Hello Translation",
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "World": null,
      "": ""
    }"
  `);
});

test('fix default locale null translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': mainTsx,
    },
    config: {
      'en.json': JSON.stringify({
        ...enCorrectTranslations,
        'Hello World': null,
      }),
      'pt.json': JSON.stringify(ptCorrectTranslations),
    },
  });

  const result = await ctx.validate({ fix: true, defaultLocale: 'en' });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "✅ en.json translations fixed",
        "✅ pt.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations fixed",
        "✅ pt.json translations are up to date",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

test('fix adds null for missing variant translations', async () => {
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
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "🟠 en.json translations keys were added",
      ],
      "output": [
        "🟠 en.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "Hello": "Hello",
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "Hello~~formal": null,
      "": ""
    }"
  `);
});

test('fix adds null for missing $ prefixed translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`$placeholder\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({}),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [],
      "hasError": false,
      "infos": [
        "🟠 en.json translations keys were added",
      ],
      "output": [
        "🟠 en.json translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "$placeholder": null,
      "": ""
    }"
  `);
});

test('fix mode reports error for variant translation equal to key', async () => {
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

  const result = await ctx.validate({ fix: true });

  expect(result.errors).toContainEqual(
    expect.stringContaining('invalid special translations'),
  );
  expect(result.errors[0]).toContain('Hello~~formal');

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(
    `"{"Hello~~formal":"Hello~~formal"}"`,
  );
});

test('fix mode reports error for $ prefixed translation equal to key', async () => {
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

  const result = await ctx.validate({ fix: true });

  expect(result.errors).toContainEqual(
    expect.stringContaining('invalid special translations'),
  );
  expect(result.errors[0]).toContain('$terms');

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(
    `"{"$terms":"$terms"}"`,
  );
});
