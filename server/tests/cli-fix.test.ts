import { createCliTestContext } from '@ls-stack/i18n-core/cli';
import { expect, test } from 'vitest';

const mainTs = `
import { i18nitialize } from '../../server/src/main';

const i18n = i18nitialize({
  locales: {
    pt: {},
    es: {},
    en: {},
  },
});

export const { __, __p } = i18n.with('pt');

export const translation = __\`Hello World\`;

export const pluralTranslation = __p(1)\`# Hello World\`;

export const translationWithInterpolation = __\`Hello \${'World'}\`;

export const pluralTranslationWithInterpolation = __p(1)\`# Hello \${'World'}\`;

export const translationWithMultipleInterpolations = __\`Hello \${'World'} \${'foo'}\`;

export const alternateTranslation = __\`Hello World~~2\`;
`;

const main2Ts = `
/* eslint-disable no-console */
import { __ } from './main';

console.log(__\`Imported usage\`);
`;

const ptCorrectTranslations = {
  'Hello World': 'Olá Mundo',
  'Hello {1}': 'Olá {1}',
  'Hello {1} {2}': 'Olá {1} {2}',
  'Hello World~~2': 'Olá Mundo variante',
  'Imported usage': 'Uso importado',
  '# Hello World': {
    zero: 'Nenhuma saudação',
    one: '1 saudação',
    '+2': '# saudações',
    many: 'Muitas saudações',
    manyLimit: 50,
  },
  '# Hello {1}': {
    zero: 'Nenhum {1}',
    one: '{1}: 1',
    '+2': '{1}: #',
    many: '{1}: muitos',
    manyLimit: 50,
  },
};

const enCorrectTranslations = {
  'Hello World': 'Hello World',
  'Hello {1}': 'Hello {1}',
  'Hello {1} {2}': 'Hello {1} {2}',
  'Hello World~~2': 'Hello World (variant 2)',
  'Imported usage': 'Imported usage',
  '# Hello World': {
    zero: 'No greetings',
    one: '1 greeting',
    '+2': '# greetings',
    many: 'Many greetings',
    manyLimit: 50,
  },
  '# Hello {1}': {
    zero: 'No {1}',
    one: '1 {1}',
    '+2': '# {1}',
    many: 'Many {1}',
    manyLimit: 50,
  },
};

test('fix missing translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
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
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "Hello World": null,
      "Hello {1}": null,
      "Hello {1} {2}": null,
      "Hello World~~2": null,
      "Imported usage": null,
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "# Hello {1}": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "": ""
    }"
  `);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "Hello {1}": null,
      "Hello {1} {2}": null,
      "Hello World~~2": null,
      "Imported usage": null,
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "# Hello {1}": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello World": "Olá Mundo",
      "": ""
    }"
  `);
});

test('fix extra translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
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
      "Hello {1} {2}": "Hello {1} {2}",
      "Hello World~~2": "Hello World (variant 2)",
      "Imported usage": "Imported usage",
      "# Hello World": {
        "zero": "No greetings",
        "one": "1 greeting",
        "+2": "# greetings",
        "many": "Many greetings",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "No {1}",
        "one": "1 {1}",
        "+2": "# {1}",
        "many": "Many {1}",
        "manyLimit": 50
      },
      "": ""
    }"
  `);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "Hello {1}": "Olá {1}",
      "Hello {1} {2}": "Olá {1} {2}",
      "Hello World~~2": "Olá Mundo variante",
      "Imported usage": "Uso importado",
      "# Hello World": {
        "zero": "Nenhuma saudação",
        "one": "1 saudação",
        "+2": "# saudações",
        "many": "Muitas saudações",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "Nenhum {1}",
        "one": "{1}: 1",
        "+2": "{1}: #",
        "many": "{1}: muitos",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

test('fix invalid plural translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
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
      "Hello {1} {2}": "Olá {1} {2}",
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello World~~2": "Olá Mundo variante",
      "Imported usage": "Uso importado",
      "# Hello {1}": {
        "zero": "Nenhum {1}",
        "one": "{1}: 1",
        "+2": "{1}: #",
        "many": "{1}: muitos",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

test('fix default locale null translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
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
      "Hello World~~2": "Hello World (variant 2)",
      "# Hello World": {
        "zero": "No greetings",
        "one": "1 greeting",
        "+2": "# greetings",
        "many": "Many greetings",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "No {1}",
        "one": "1 {1}",
        "+2": "# {1}",
        "many": "Many {1}",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

test('fix mode with missing translations marker already present', async () => {
  const ctx = createCliTestContext({
    src: {
      'i18n.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } });
        export const { __, __p } = i18n.with('en');
      `,
      'main.ts': `
        import { __ } from './i18n';
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

  expect(result.hasError).toBe(false);
  expect(result.infos).toContainEqual(
    expect.stringContaining('translations keys were added'),
  );

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "Hello": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "": ""
    }"
  `);
});

test('fix mode error when file has only missing marker', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`Hello\`;
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
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t1 = i18n.__\`Hello\`;
        export const t2 = i18n.__\`World\`;
        export const t3 = i18n.__p(5)\`# items\`;
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
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "World": null,
      "# items": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello": "Hello",
      "": ""
    }"
  `);
});

test('fix mode preserves existing valid translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t1 = i18n.__\`Hello\`;
        export const t2 = i18n.__\`World\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Custom Hello Translation',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result.hasError).toBe(false);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "World": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello": "Custom Hello Translation",
      "": ""
    }"
  `);
});

test('fix adds null for missing variant translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t1 = i18n.__\`Hello\`;
        export const t2 = i18n.__\`Hello~~formal\`;
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
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "Hello~~formal": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello": "Hello",
      "": ""
    }"
  `);
});

test('fix adds null for missing $ prefixed translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`$placeholder\`;
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
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "$placeholder": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "": ""
    }"
  `);
});

test('fix mode reports error for variant translation equal to key', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`Hello~~formal\`;
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
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`$terms\`;
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
