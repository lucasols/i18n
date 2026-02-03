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
  'Hello World~~2': 'Olá Mundo~~2',
  'Imported usage': 'Uso importado',
  '# Hello World': {
    zero: 'Nenhuma x',
    one: '1 x',
    '+2': '# x',
    many: 'Muitas x',
    manyLimit: 50,
  },
  '# Hello {1}': {
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
  'Hello {1} {2}': 'Hello {1} {2}',
  'Hello World~~2': 'Hello World~~2',
  'Imported usage': 'Imported usage',
  '# Hello World': {
    zero: 'No x',
    one: '1 x',
    '+2': '# x',
    many: 'A lot of x',
    manyLimit: 50,
  },
  '# Hello {1}': {
    zero: 'No x',
    one: '1 x',
    '+2': '# x',
    many: 'A lot of x',
    manyLimit: 50,
  },
};

test('missing translations error', async () => {
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

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has invalid translations: missing 7",
        "❌ pt.json has invalid translations: missing 6",
      ],
      "hasError": true,
      "infos": [],
      "output": [
        "❌ en.json has invalid translations: missing 7",
        "❌ pt.json has invalid translations: missing 6",
      ],
    }
  `);
});

test('correct translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
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

test('extra translations error', async () => {
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

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has invalid translations: extra 1",
        "❌ pt.json has invalid translations: extra 1",
      ],
      "hasError": true,
      "infos": [],
      "output": [
        "❌ en.json has invalid translations: extra 1",
        "❌ pt.json has invalid translations: extra 1",
      ],
    }
  `);
});

test('invalid plural translations error', async () => {
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

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ pt.json has invalid plural translations:  # Hello World",
      ],
      "hasError": true,
      "infos": [
        "✅ en.json translations are up to date",
      ],
      "output": [
        "✅ en.json translations are up to date",
        "❌ pt.json has invalid plural translations:  # Hello World",
      ],
    }
  `);
});

test('missing and extra translations errors', async () => {
  const enWithMissingAndExtra = { ...enCorrectTranslations };
  delete (enWithMissingAndExtra as Record<string, unknown>)['Imported usage'];
  (enWithMissingAndExtra as Record<string, unknown>)['Extra translation'] =
    'Extra translation';

  const ptWithMissingAndExtra = { ...ptCorrectTranslations };
  delete (ptWithMissingAndExtra as Record<string, unknown>)['Hello World'];
  (ptWithMissingAndExtra as Record<string, unknown>)['Extra translation'] =
    'Extra translation';

  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
    },
    config: {
      'en.json': JSON.stringify(enWithMissingAndExtra),
      'pt.json': JSON.stringify(ptWithMissingAndExtra),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has invalid translations: missing 1, extra 1",
        "❌ pt.json has invalid translations: missing 1, extra 1",
      ],
      "hasError": true,
      "infos": [],
      "output": [
        "❌ en.json has invalid translations: missing 1, extra 1",
        "❌ pt.json has invalid translations: missing 1, extra 1",
      ],
    }
  `);
});

test('default locale null translations error', async () => {
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

  const result = await ctx.validate({ defaultLocale: 'en' });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has invalid translations: extra 1",
      ],
      "hasError": true,
      "infos": [
        "✅ pt.json translations are up to date",
      ],
      "output": [
        "✅ pt.json translations are up to date",
        "❌ en.json has invalid translations: extra 1",
      ],
    }
  `);
});

test('undefined default locale translations should not return error', async () => {
  const enWithoutHelloWorld = { ...enCorrectTranslations };
  delete (enWithoutHelloWorld as Record<string, unknown>)['Hello World'];

  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
    },
    config: {
      'en.json': JSON.stringify(enWithoutHelloWorld),
      'pt.json': JSON.stringify(ptCorrectTranslations),
    },
  });

  const result = await ctx.validate({ defaultLocale: 'en' });

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

test('undefined plural translations should return error in default locale too', async () => {
  const ptWithoutPluralHello = { ...ptCorrectTranslations };
  delete (ptWithoutPluralHello as Record<string, unknown>)['# Hello World'];

  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
    },
    config: {
      'en.json': JSON.stringify(ptWithoutPluralHello),
      'pt.json': JSON.stringify(enCorrectTranslations),
    },
  });

  const result = await ctx.validate({ defaultLocale: 'pt' });

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has invalid translations: missing 1",
      ],
      "hasError": true,
      "infos": [
        "✅ pt.json translations are up to date",
      ],
      "output": [
        "✅ pt.json translations are up to date",
        "❌ en.json has invalid translations: missing 1",
      ],
    }
  `);
});

test('empty source directory (no translations) returns error', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `export const x = 1;`,
    },
    config: {
      'en.json': JSON.stringify({}),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('No translations found'),
  );
});

test('invalid JSON in config file returns error', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': mainTs,
      'main2.ts': main2Ts,
    },
    config: {
      'en.json': '{ invalid json }',
      'pt.json': JSON.stringify(ptCorrectTranslations),
    },
  });

  await expect(ctx.validate()).rejects.toThrow();
});

test('nested source directories are scanned', async () => {
  const ctx = createCliTestContext({
    src: {
      'i18n.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } });
        export const { __, __p } = i18n.with('en');
      `,
      'components/Button.tsx': `
        import { __ } from '../i18n';
        export const label = __\`Button\`;
      `,
      'pages/home/Home.tsx': `
        import { __ } from '../../i18n';
        export const title = __\`Home Page\`;
      `,
      'utils/helpers.ts': `
        import { __ } from '../i18n';
        export const msg = __\`Helper message\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Button: 'Button',
        'Home Page': 'Home Page',
        'Helper message': 'Helper message',
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

test('handles translation variations', async () => {
  const ctx = createCliTestContext({
    src: {
      'i18n.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } });
        export const { __, __p } = i18n.with('en');
      `,
      'main.ts': `
        import { __ } from './i18n';
        export const t1 = __\`Greeting\`;
        export const t2 = __\`Greeting~~formal\`;
        export const t3 = __\`Greeting~~casual\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Greeting: 'Hello',
        'Greeting~~formal': 'Good day',
        'Greeting~~casual': 'Hey',
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

test('handles multiple config files in nested directories', async () => {
  const ctx = createCliTestContext({
    src: {
      'i18n.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {}, pt: {} } });
        export const { __, __p } = i18n.with('en');
      `,
      'main.ts': `
        import { __ } from './i18n';
        export const t = __\`Hello\`;
      `,
    },
    config: {
      'locales/en.json': JSON.stringify({ Hello: 'Hello' }),
      'locales/pt.json': JSON.stringify({ Hello: 'Olá' }),
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

test('invalid translation value schema returns error', async () => {
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
      'en.json': JSON.stringify({ Hello: 123 }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('has invalid format'),
  );
});

// === Property Access Expressions ===

test('detects property access translation i18n.__`text`', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const translation = i18n.__\`Property access\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Property access': 'Property access',
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

test('detects property access plural i18n.__p(count)`text`', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const pluralTranslation = i18n.__p(5)\`# items\`;
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

// === Plural Schema Edge Cases ===

test('accepts plural with only required +2 field', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__p(5)\`# items\`;
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

test('rejects plural missing required +2 field', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__p(5)\`# items\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        '# items': {
          zero: 'none',
          one: '1',
        },
      }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('has invalid format'),
  );
});

test('rejects plural with invalid field types', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__p(5)\`# items\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        '# items': {
          '+2': 123,
        },
      }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('has invalid format'),
  );
});

test('rejects array value for translation', async () => {
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
        Hello: ['array', 'value'],
      }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('has invalid format'),
  );
});

// === Multiple Items ===

test('reports multiple extra translations count', async () => {
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
        'Extra 1': 'Extra 1',
        'Extra 2': 'Extra 2',
        'Extra 3': 'Extra 3',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result).toMatchInlineSnapshot(`
    {
      "errors": [
        "❌ en.json has invalid translations: extra 3",
      ],
      "hasError": true,
      "infos": [],
      "output": [
        "❌ en.json has invalid translations: extra 3",
      ],
    }
  `);
});

test('reports multiple invalid plural translations', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t1 = i18n.__p(1)\`# item\`;
        export const t2 = i18n.__p(2)\`# thing\`;
        export const t3 = i18n.__p(3)\`# object\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        '# item': 'Invalid plural 1',
        '# thing': 'Invalid plural 2',
        '# object': 'Invalid plural 3',
      }),
    },
  });

  const result = await ctx.validate();

  expect(result.hasError).toBe(true);
  expect(result.errors).toContainEqual(
    expect.stringContaining('has invalid plural translations'),
  );
  expect(result.errors[0]).toContain('# item');
  expect(result.errors[0]).toContain('# thing');
  expect(result.errors[0]).toContain('# object');
});

// === Source Scanning Edge Cases ===

test('handles file with i18n in comments but no usage', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`Hello\`;
      `,
      'other.ts': `
        // i18n config file
        // This file has i18n in comments but no actual usage
        export const x = 1;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello',
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

test('handles file with i18n in string but no function call', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`Hello\`;
      `,
      'other.ts': `
        const configName = "i18n";
        export const x = configName;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello',
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

// === Translation Key Edge Cases ===

test('handles keys with special characters (quotes)', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`He said "hello"\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'He said "hello"': 'He said "hello"',
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

test('handles keys with emoji characters', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`Hello 👋 World\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Hello 👋 World': 'Hello 👋 World',
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

test('handles keys with newlines', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t = i18n.__\`Line 1
Line 2\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        'Line 1\nLine 2': 'Line 1\nLine 2',
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

// === Default Locale Edge Cases ===

test('default locale allows null for string but requires plural object', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.ts': `
        import { i18nitialize } from '@ls-stack/server-i18n';
        const i18n = i18nitialize({ locales: { en: {} } }).with('en');
        export const t1 = i18n.__\`Hello\`;
        export const t2 = i18n.__p(5)\`# items\`;
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
