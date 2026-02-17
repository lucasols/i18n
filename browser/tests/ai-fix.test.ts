import {
  createCliTestContext,
  type AITranslator,
  type TranslationContext,
  type TranslationResult,
} from '@ls-stack/i18n-core/cli';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
  expect(result.infos).toContainEqual(expect.stringContaining('AI-generated'));

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
        "👇 missing start 👇": "🛑 delete this line 🛑",
        "World": null,
        "👆 missing end 👆": "🛑 delete this line 🛑",
        "Hello": "AI Hello",
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
        "Hello": "Existing translation",
        "World": "AI: World",
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

test('does not send $ and ~~ translations to AI and fails validation', async () => {
  const { translator, getContexts } = trackingTranslator();

  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t1 = __\`Hello World\`;
          export const t2 = __\`$terms_of_service\`;
          export const t3 = __\`Welcome~~formal\`;
          export const t4 = __\`Goodbye\`;
        `,
    },
    config: { 'pt.json': '{}' },
  });

  const result = await ctx.validate({ fix: true, aiTranslator: translator });

  const sentKeys = getContexts().map((c) => c.sourceKey);

  expect(sentKeys).toContain('Hello World');
  expect(sentKeys).toContain('Goodbye');
  expect(sentKeys).not.toContain('$terms_of_service');
  expect(sentKeys).not.toContain('Welcome~~formal');
  expect(sentKeys).toHaveLength(2);

  expect(ctx.getConfigFileRaw('pt.json')).toMatchInlineSnapshot(`
    "{
      "Hello World": "translated:Hello World",
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "$terms_of_service": null,
      "Welcome~~formal": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
      "Goodbye": "translated:Goodbye",
      "": ""
    }"
  `);

  expect(result.hasError).toBe(true);
  expect(result.errors).toMatchInlineSnapshot(`
    [
      "❌ pt.json has missing $ or ~~ translations that require manual translation: $terms_of_service,Welcome~~formal",
    ]
  `);
});

test('includes extra translations in similarity context for renamed keys', async () => {
  const { translator, getContexts } = trackingTranslator();

  // Simulate a source key rename: "Welcome back" was renamed to "Welcome back!"
  // The old translation ("Welcome back" → "Bem-vindo de volta") is now extra
  // but should still appear as similar context for AI generation
  const ctx = createCliTestContext({
    src: {
      'main.tsx': `
          import { __ } from '@ls-stack/i18n';
          export const t = __\`Welcome back!\`;
        `,
    },
    config: {
      'pt.json': JSON.stringify({ 'Welcome back': 'Bem-vindo de volta' }),
    },
  });

  await ctx.validate({ fix: true, aiTranslator: translator });

  const welcomeCtx = getContexts().find(
    (c) => c.sourceKey === 'Welcome back!',
  );

  expect(welcomeCtx).toBeDefined();
  expect(welcomeCtx?.similarTranslations.length).toBeGreaterThanOrEqual(1);
  expect(welcomeCtx?.similarTranslations[0]?.key).toBe('Welcome back');
  expect(welcomeCtx?.similarTranslations[0]?.translation).toBe(
    'Bem-vindo de volta',
  );
});

function mockTranslator(
  handler: (ctx: TranslationContext) => TranslationResult | undefined,
): AITranslator {
  return {
    translateBatch(contexts) {
      const translations = new Map<string, TranslationResult>();
      for (const ctx of contexts) {
        const result = handler(ctx);
        if (result) {
          translations.set(ctx.sourceKey, result);
        }
      }
      return Promise.resolve({ translations });
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
        const translations = new Map<string, TranslationResult>();
        for (const ctx of ctxs) {
          translations.set(ctx.sourceKey, {
            type: 'string',
            value: `translated:${ctx.sourceKey}`,
          });
        }
        return Promise.resolve({ translations });
      },
    },
    getContexts: () => contexts,
  };
}
