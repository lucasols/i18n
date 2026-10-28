import { createCliTestContext } from '@ls-stack/i18n-core/cli';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
      "hasError": true,
      "infos": [
        "🟠 en.json:2 translations keys were added",
        "🟠 pt.json:2 translations keys were added",
      ],
      "output": [
        "🟠 en.json:2 translations keys were added",
        "🟠 pt.json:2 translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "Hello World": null,
      "Hello {1}": null,
      "# Hello World": {
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
      "# Hello World": {
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
        'Extra translation': 'Tradução extra',
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
        "zero": "No greetings",
        "one": "1 greeting",
        "+2": "# greetings",
        "many": "Many greetings",
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
        "zero": "Nenhuma saudação",
        "one": "1 saudação",
        "+2": "# saudações",
        "many": "Muitas saudações",
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
      "hasError": true,
      "infos": [
        "✅ en.json translations are up to date",
        "🟠 pt.json:3 translations keys were added",
      ],
      "output": [
        "✅ en.json translations are up to date",
        "🟠 pt.json:3 translations keys were added",
      ],
    }
  `);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x"
      },
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello {1}": "Olá {1}",
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
      "hasError": true,
      "infos": [
        "🟠 en.json:2 translations keys were added",
      ],
      "output": [
        "🟠 en.json:2 translations keys were added",
      ],
    }
  `);

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
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t = __\`Hello\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello',
        '👇 missing start 👇': '🛑 delete this line 🛑',
        '👆 missing end 👆': '🛑 delete this line 🛑',
      }),
    },
  });

  const result = await ctx.validate({ fix: true });

  expect(result).toMatchObject({
    errors: ['❌ en.json:1 has missing translations'],
    infos: [],
    output: ['❌ en.json:1 has missing translations'],
  });

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(
    `"{"Hello":"Hello","👇 missing start 👇":"🛑 delete this line 🛑","👆 missing end 👆":"🛑 delete this line 🛑"}"`,
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
      "hasError": true,
      "infos": [
        "🟠 en.json:2 translations keys were added",
      ],
      "output": [
        "🟠 en.json:2 translations keys were added",
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
      "hasError": true,
      "infos": [
        "🟠 en.json:2 translations keys were added",
      ],
      "output": [
        "🟠 en.json:2 translations keys were added",
      ],
    }
  `);

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

  const result = await ctx.validate({
    fix: true,
    defaultLocale: 'en',
  });

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
        "zero": "No greetings",
        "one": "1 greeting",
        "+2": "# greetings",
        "many": "Many greetings",
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
      "hasError": true,
      "infos": [
        "🟠 en.json:2 translations keys were added",
      ],
      "output": [
        "🟠 en.json:2 translations keys were added",
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
      "hasError": true,
      "infos": [
        "🟠 en.json:2 translations keys were added",
      ],
      "output": [
        "🟠 en.json:2 translations keys were added",
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

test('fix adds missing $ prefixed translations to the default locale', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const intro = __\`$onboarding_intro \${'Ana'}\`;
        export const title = __\`Welcome back\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({}),
      'pt.json': JSON.stringify({
        '$onboarding_intro {1}': 'Olá {1}, vamos configurar seu primeiro agente',
        'Welcome back': 'Bem-vindo de volta',
      }),
    },
  });

  const result = await ctx.validate({ fix: true, defaultLocale: 'en' });

  expect(result.hasError).toBe(true);
  expect(result.infos).toEqual([
    '🟠 en.json:2 translations keys were added',
    '✅ pt.json translations are up to date',
  ]);

  expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "$onboarding_intro {1}": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
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

test('fix moves existing null translations under missing marker for non-default locale', async () => {
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

  const result = await ctx.validate({ fix: true, defaultLocale: 'en' });

  expect(result.infos).toContainEqual(
    expect.stringMatching(/pt\.json(:\d+)? translations keys were added/),
  );

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "World": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Hello": "Olá tradução",
      "": ""
    }"
  `);
});

test('fix moves multiple existing null translations under missing marker for non-default locale', async () => {
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Hello\`;
        export const t2 = __\`World\`;
        export const t3 = __\`Foo\`;
      `,
    },
    config: {
      'en.json': JSON.stringify({
        Hello: 'Hello',
        World: 'World',
        Foo: 'Foo',
      }),
      'pt.json': JSON.stringify({
        Hello: null,
        World: 'Mundo tradução',
        Foo: null,
      }),
    },
  });

  await ctx.validate({ fix: true, defaultLocale: 'en' });

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "Hello": null,
      "Foo": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "World": "Mundo tradução",
      "": ""
    }"
  `);
});

test('missing translations position is random and consistent when Math.random is mocked', async () => {
  vi.mocked(Math.random).mockReturnValue(0.3);

  const existingTranslations = {
    Apple: 'Apple',
    Banana: 'Banana',
    Cherry: 'Cherry',
    Date: 'Date',
    Elderberry: 'Elderberry',
  };

  const ctx1 = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Apple\`;
        export const t2 = __\`Banana\`;
        export const t3 = __\`Cherry\`;
        export const t4 = __\`Date\`;
        export const t5 = __\`Elderberry\`;
        export const t6 = __\`NewKey1\`;
      `,
    },
    config: {
      'en.json': JSON.stringify(existingTranslations),
    },
  });

  await ctx1.validate({ fix: true });
  const output1 = ctx1.getConfigFileRaw('en.json');

  const ctx2 = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Apple\`;
        export const t2 = __\`Banana\`;
        export const t3 = __\`Cherry\`;
        export const t4 = __\`Date\`;
        export const t5 = __\`Elderberry\`;
        export const t6 = __\`NewKey1\`;
      `,
    },
    config: {
      'en.json': JSON.stringify(existingTranslations),
    },
  });

  await ctx2.validate({ fix: true });
  const output2 = ctx2.getConfigFileRaw('en.json');

  expect(output1).toBe(output2);

  const ctx3 = createCliTestContext({
    src: {
      'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Apple\`;
        export const t2 = __\`Banana\`;
        export const t3 = __\`Cherry\`;
        export const t4 = __\`Date\`;
        export const t5 = __\`Elderberry\`;
        export const t6 = __\`DifferentKey\`;
      `,
    },
    config: {
      'en.json': JSON.stringify(existingTranslations),
    },
  });

  await ctx3.validate({ fix: true });
  const output3 = ctx3.getConfigFileRaw('en.json');

  expect(output1).not.toBe(output3);
});

test('different branches adding different translations get different positions', async () => {
  let callCount = 0;
  const randomValues = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
  vi.mocked(Math.random).mockImplementation(() => {
    const index = callCount % randomValues.length;
    callCount++;
    return randomValues[index] ?? 0;
  });

  const existingTranslations: Record<string, string> = {};
  const existingKeys: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const key = `Translation key ${i.toString().padStart(4, '0')}`;
    existingTranslations[key] = `Translated value ${i}`;
    existingKeys.push(key);
  }

  const branchFeatures = [
    ['Auth login button', 'Auth logout button', 'Auth forgot password'],
    ['Cart add item', 'Cart remove item', 'Cart checkout'],
    ['Dashboard welcome', 'Dashboard stats', 'Dashboard settings'],
    ['Error not found', 'Error server error', 'Error validation'],
    ['Form submit', 'Form cancel', 'Form reset'],
    ['Help faq', 'Help contact', 'Help docs'],
    ['Invoice total', 'Invoice items', 'Invoice date'],
    ['Menu home', 'Menu profile', 'Menu settings'],
    ['Notification success', 'Notification error', 'Notification warning'],
    ['Search placeholder', 'Search results', 'Search no results'],
  ];

  function getMissingBlockPosition(output: string): number {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    return keys.indexOf('👇 missing start 👇');
  }

  const positions: number[] = [];

  for (const featureKeys of branchFeatures) {
    const existingExports = existingKeys
      .map((k, i) => `export const t${i} = __\`${k}\`;`)
      .join('\n');
    const newExports = featureKeys
      .map((k, i) => `export const new${i} = __\`${k}\`;`)
      .join('\n');

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          ${existingExports}
          ${newExports}
        `,
      },
      config: {
        'en.json': JSON.stringify(existingTranslations),
      },
    });

    await ctx.validate({ fix: true });
    const output = ctx.getConfigFileRaw('en.json');
    if (output === undefined) {
      throw new Error('Expected en.json to exist');
    }
    const position = getMissingBlockPosition(output);
    positions.push(position);
  }

  const uniquePositions = new Set(positions);
  expect(uniquePositions.size).toBe(10);
});
