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
        "Hello": "AI Hello",
        "👇 missing start 👇": "🛑 delete this line 🛑",
        "World": null,
        "👆 missing end 👆": "🛑 delete this line 🛑",
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
      "Goodbye": "translated:Goodbye",
      "👇 missing start 👇": "🛑 delete this line 🛑",
      "$terms_of_service": null,
      "Welcome~~formal": null,
      "👆 missing end 👆": "🛑 delete this line 🛑",
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

test('inserts AI translations at a random position, not always at the end', async () => {
  const translator = mockStringTranslator((key) => `AI: ${key}`);

  const existingTranslations: Record<string, string> = {};
  for (let i = 1; i <= 10; i++) {
    existingTranslations[`Existing ${i}`] = `Translation ${i}`;
  }

  const src = {
    'main.tsx': `
        import { __ } from '@ls-stack/i18n';
        export const t1 = __\`Existing 1\`;
        export const t2 = __\`Existing 2\`;
        export const t3 = __\`Existing 3\`;
        export const t4 = __\`Existing 4\`;
        export const t5 = __\`Existing 5\`;
        export const t6 = __\`Existing 6\`;
        export const t7 = __\`Existing 7\`;
        export const t8 = __\`Existing 8\`;
        export const t9 = __\`Existing 9\`;
        export const t10 = __\`Existing 10\`;
        export const tNew = __\`New Key\`;
      `,
  };

  // Math.random returns 0 → AI translation should be inserted at the beginning
  vi.spyOn(Math, 'random').mockReturnValue(0);

  const ctxStart = createCliTestContext({
    src,
    config: { 'pt.json': JSON.stringify(existingTranslations) },
  });

  await ctxStart.validate({ fix: true, aiTranslator: translator });
  const rawStart = ctxStart.getConfigFileRaw('pt.json') ?? '';
  const keysStart = Object.keys(
    JSON.parse(rawStart) as Record<string, unknown>,
  );

  // Math.random returns 0.5 → AI translation should be inserted in the middle
  vi.spyOn(Math, 'random').mockReturnValue(0.5);

  const ctxMid = createCliTestContext({
    src,
    config: { 'pt.json': JSON.stringify(existingTranslations) },
  });

  await ctxMid.validate({ fix: true, aiTranslator: translator });
  const rawMid = ctxMid.getConfigFileRaw('pt.json') ?? '';
  const keysMid = Object.keys(JSON.parse(rawMid) as Record<string, unknown>);

  const newKeyIndexStart = keysStart.indexOf('New Key');
  const newKeyIndexMid = keysMid.indexOf('New Key');

  // With Math.random = 0, AI key should be inserted at the beginning
  expect(newKeyIndexStart).toBe(0);
  // With Math.random = 0.5, AI key should be inserted in the middle
  // floor(0.5 * 10) = 5
  expect(newKeyIndexMid).toBe(5);
  // The positions should be different proving random insertion
  expect(newKeyIndexStart).not.toBe(newKeyIndexMid);
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
