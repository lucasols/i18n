import type { PluralTranslation } from '@ls-stack/i18n-core';
import {
  createCliTestContext,
  findSimilarTranslations,
  type AITranslator,
  type TranslationContext,
  type TranslationResult,
} from '@ls-stack/i18n-core/cli';
import { describe, expect, test } from 'vitest';

describe('AI translation fix', () => {
  test('generates string translations', async () => {
    const translator = mockTranslator((ctx) =>
      ctx.isPlural ? undefined : { type: 'string', value: 'Olá Mundo' },
    );

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello World\`;
        `,
      },
      config: { 'pt.json': '{}' },
    });

    const result = await ctx.validate({ fix: true, aiTranslator: translator });

    expect(result.hasError).toBe(false);
    expect(result.infos).toContainEqual(
      expect.stringContaining('AI-generated'),
    );

    expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
      "{
        "Hello World": "Olá Mundo",
        "": ""
      }"
    `);
  });

  test('generates plural translations with required forms', async () => {
    const translator = mockTranslator((ctx) =>
      ctx.isPlural ?
        {
          type: 'plural',
          value: {
            one: '1 usuário',
            '+2': '# usuários',
          },
        }
      : undefined,
    );

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const count = __p(5)\`# users\`;
        `,
      },
      config: { 'pt.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
      "{
        "# users": {
          "one": "1 usuário",
          "+2": "# usuários"
        },
        "": ""
      }"
    `);
  });

  test('generates plural translations with optional many/manyLimit', async () => {
    const translator = mockTranslator((ctx) =>
      ctx.isPlural ?
        {
          type: 'plural',
          value: {
            one: '1 item',
            '+2': '# items',
            many: 'Many items',
            manyLimit: 100,
          },
        }
      : undefined,
    );

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __p } from '@ls-stack/i18n';
          export const count = __p(5)\`# items\`;
        `,
      },
      config: { 'en.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
      "{
        "# items": {
          "one": "1 item",
          "+2": "# items",
          "many": "Many items",
          "manyLimit": 100
        },
        "": ""
      }"
    `);
  });

  test('does not add missing markers when AI succeeds', async () => {
    const translator = mockStringTranslator((key) => `AI: ${key}`);

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello\`;
        `,
      },
      config: { 'en.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    const rawJson = ctx.getConfigFileRaw('en.json') ?? '';
    expect(rawJson).not.toContain('👇 missing start 👇');
    expect(rawJson).not.toContain('👆 missing end 👆');
    expect(rawJson).not.toContain('🛑 delete this line 🛑');
  });

  test('falls back to null when AI fails for specific key', async () => {
    const translator = mockTranslator((ctx) =>
      ctx.sourceKey === 'Hello' ?
        { type: 'string', value: 'AI Hello' }
      : undefined,
    );

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t1 = __\`Hello\`;
          export const t2 = __\`World\`;
        `,
      },
      config: { 'en.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
      "{
        "Hello": "AI Hello",
        "World": null,
        "": ""
      }"
    `);
  });

  test('falls back to null with markers on complete AI failure', async () => {
    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello\`;
        `,
      },
      config: { 'en.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: failingTranslator() });

    expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
      "{
        "👇 missing start 👇": "🛑 delete this line 🛑",
        "Hello": null,
        "👆 missing end 👆": "🛑 delete this line 🛑",
        "": ""
      }"
    `);
  });

  test('preserves existing translations', async () => {
    const translator = mockStringTranslator((key) => `AI: ${key}`);

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t1 = __\`Hello\`;
          export const t2 = __\`World\`;
        `,
      },
      config: {
        'en.json': JSON.stringify({ Hello: 'Existing translation' }),
      },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
      "{
        "World": "AI: World",
        "Hello": "Existing translation",
        "": ""
      }"
    `);
  });

  test('provides similar translations as context to AI', async () => {
    const { translator, getContexts } = trackingTranslator();

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t1 = __\`Welcome back\`;
          export const t2 = __\`Welcome to the app\`;
        `,
      },
      config: {
        'pt.json': JSON.stringify({ 'Welcome back': 'Bem-vindo de volta' }),
      },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    const welcomeAppCtx = getContexts().find(
      (c) => c.sourceKey === 'Welcome to the app',
    );

    expect(welcomeAppCtx).toBeDefined();
    expect(welcomeAppCtx?.similarTranslations).toHaveLength(1);
    expect(welcomeAppCtx?.similarTranslations[0]?.key).toBe('Welcome back');
    expect(welcomeAppCtx?.similarTranslations[0]?.translation).toBe(
      'Bem-vindo de volta',
    );
    expect(typeof welcomeAppCtx?.similarTranslations[0]?.score).toBe('number');
  });

  test('passes correct target locale to AI', async () => {
    const { translator, getContexts } = trackingTranslator();

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Hello\`;
        `,
      },
      config: { 'pt-BR.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    expect(getContexts()).toHaveLength(1);
    expect(getContexts()[0]?.targetLocale).toBe('pt-BR');
  });

  test('handles mixed string and plural translations', async () => {
    const translator = mockTranslator((ctx) =>
      ctx.isPlural ?
        {
          type: 'plural',
          value: { one: '1 item', '+2': '# items' },
        }
      : { type: 'string', value: `Translated: ${ctx.sourceKey}` },
    );

    const ctx = createCliTestContext({
      src: {
        'main.tsx': `
          import { __, __p } from '@ls-stack/i18n';
          export const t1 = __\`Hello World\`;
          export const t2 = __p(5)\`# items\`;
        `,
      },
      config: { 'en.json': '{}' },
    });

    await ctx.validate({ fix: true, aiTranslator: translator });

    expect(ctx.getConfigFileRaw('en.json')).toMatchInlineSnapshot(`
      "{
        "Hello World": "Translated: Hello World",
        "# items": {
          "one": "1 item",
          "+2": "# items"
        },
        "": ""
      }"
    `);
  });
});

describe('Similarity search', () => {
  test('finds matches by token overlap', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['Welcome back', 'Bem-vindo de volta'],
      ['Goodbye', 'Tchau'],
    ]);

    const matches = findSimilarTranslations('Welcome to app', existing);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.key).toBe('Welcome back');
  });

  test('finds plural translations by shared tokens', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['# active users', { zero: 'No users', one: '1 user', '+2': '# users' }],
      ['Hello', 'Olá'],
    ]);

    const matches = findSimilarTranslations('# total users', existing);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.key).toBe('# active users');
  });

  test('returns empty array when no translations exist', () => {
    const matches = findSimilarTranslations(
      'Hello',
      new Map<string, string | PluralTranslation>(),
    );

    expect(matches).toEqual([]);
  });

  test('respects maxResults limit', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['Test one', 'Um'],
      ['Test two', 'Dois'],
      ['Test three', 'Três'],
      ['Test four', 'Quatro'],
      ['Test five', 'Cinco'],
    ]);

    const matches = findSimilarTranslations('Test query', existing, 3);

    expect(matches.length).toBeLessThanOrEqual(3);
  });
});

function mockTranslator(
  handler: (ctx: TranslationContext) => TranslationResult | undefined,
): AITranslator {
  return {
    translateBatch(contexts) {
      const results = new Map<string, TranslationResult>();
      for (const ctx of contexts) {
        const result = handler(ctx);
        if (result) {
          results.set(ctx.sourceKey, result);
        }
      }
      return Promise.resolve(results);
    },
  };
}

function mockStringTranslator(
  translate: (key: string) => string,
): AITranslator {
  return mockTranslator((ctx) => ({
    type: 'string',
    value: translate(ctx.sourceKey),
  }));
}

function failingTranslator(error = 'API Error'): AITranslator {
  return {
    translateBatch() {
      return Promise.reject(new Error(error));
    },
  };
}

function trackingTranslator(): {
  translator: AITranslator;
  getContexts: () => TranslationContext[];
} {
  let contexts: TranslationContext[] = [];

  return {
    translator: {
      translateBatch(ctxs) {
        contexts = ctxs;
        const results = new Map<string, TranslationResult>();
        for (const ctx of ctxs) {
          results.set(ctx.sourceKey, {
            type: 'string',
            value: `translated:${ctx.sourceKey}`,
          });
        }
        return Promise.resolve(results);
      },
    },
    getContexts: () => contexts,
  };
}
