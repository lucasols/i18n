import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { PluralTranslation } from '../types';
import { logAiGeneration } from './ai-logger';
import type { SimilarityMatch } from './similarity';

type AnyLanguageModel =
  | LanguageModel
  | { readonly specificationVersion: 'v1' | 'v2' | 'v3' };

export type AIProvider = 'google' | 'openai';

export type TranslationContext = {
  sourceKey: string;
  targetLocale: string;
  isPlural: boolean;
  similarTranslations: SimilarityMatch[];
};

export type TranslationResult =
  | { type: 'string'; value: string }
  | { type: 'plural'; value: PluralTranslation };

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TranslateBatchResult = {
  translations: Map<string, TranslationResult>;
  model?: string;
  usage?: TokenUsage;
};

export interface AITranslator {
  translateBatch(contexts: TranslationContext[]): Promise<TranslateBatchResult>;
}

const pluralTranslationSchema = z.object({
  zero: z.string().optional(),
  one: z.string().optional(),
  '+2': z.string(),
  many: z.string().optional(),
  manyLimit: z.number().optional(),
});

function buildTranslationsSchema(contexts: TranslationContext[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const ctx of contexts) {
    shape[ctx.sourceKey] = ctx.isPlural ? pluralTranslationSchema : z.string();
  }
  return z.object(shape);
}

function buildPrompt(contexts: TranslationContext[]): string {
  const lines: string[] = [
    '<role>',
    'You are a professional translator specializing in i18n localization.',
    '</role>',
    '',
    '<instructions>',
    '- Translate the provided keys to the specified target locale',
    '- Keep placeholders like {1}, {2}, # exactly as they appear',
    '- For plural translations, provide an object with one and +2 forms',
    '- Use similar existing translations as style/terminology reference',
    '</instructions>',
    '',
    '<plural-format>',
    'Plural translations must be objects with these keys:',
    '  one: text when count is 1',
    '  +2: text when count is 2 or more (use # as the number placeholder)',
    '',
    'English example: { "one": "1 item", "+2": "# items" }',
    'Portuguese example: { "one": "1 item", "+2": "# itens" }',
    '</plural-format>',
    '',
    '<keys>',
  ];

  for (const ctx of contexts) {
    lines.push('');
    lines.push(`Key: "${ctx.sourceKey}"`);
    lines.push(`Locale: ${ctx.targetLocale}`);
    lines.push(`Type: ${ctx.isPlural ? 'plural' : 'string'}`);

    if (ctx.similarTranslations.length > 0) {
      lines.push('Similar translations:');
      for (const match of ctx.similarTranslations.slice(0, 3)) {
        const translationValue =
          typeof match.translation === 'string' ?
            match.translation
          : JSON.stringify(match.translation);
        lines.push(`  "${match.key}" → ${translationValue}`);
      }
    }
  }

  lines.push('</keys>');

  return lines.join('\n');
}

function parseGeneratedObject(
  obj: Record<string, string | z.infer<typeof pluralTranslationSchema>>,
  contexts: TranslationContext[],
): Map<string, TranslationResult> {
  const results = new Map<string, TranslationResult>();

  for (const ctx of contexts) {
    const value = obj[ctx.sourceKey];
    if (value === undefined) continue;

    if (ctx.isPlural && typeof value === 'object') {
      const pluralValue = value;
      results.set(ctx.sourceKey, {
        type: 'plural',
        value: {
          zero: pluralValue.zero,
          one: pluralValue.one,
          '+2': pluralValue['+2'],
          many: pluralValue.many,
          manyLimit: pluralValue.manyLimit,
        },
      });
    } else if (typeof value === 'string') {
      results.set(ctx.sourceKey, { type: 'string', value });
    }
  }

  return results;
}

export function createAITranslator(
  provider: AIProvider,
  model?: AnyLanguageModel,
): AITranslator {
  return {
    async translateBatch(
      contexts: TranslationContext[],
    ): Promise<TranslateBatchResult> {
      if (contexts.length === 0) {
        return { translations: new Map() };
      }

      const ai = await import('ai');

      let languageModel: AnyLanguageModel;

      if (model) {
        languageModel = model;
      } else if (provider === 'google') {
        const { google } = await import('@ai-sdk/google');
        languageModel = google('gemini-2.5-flash') as AnyLanguageModel;
      } else {
        const { openai } = await import('@ai-sdk/openai');
        languageModel = openai('gpt-5-mini') as AnyLanguageModel;
      }

      const prompt = buildPrompt(contexts);
      const schema = buildTranslationsSchema(contexts);
      const startTime = Date.now();

      try {
        const result = await ai.generateText({
          model: languageModel as LanguageModel,
          output: ai.Output.object({
            schema,
          }),
          prompt,
        });

        const output = result.output as
          | Record<string, string | z.infer<typeof pluralTranslationSchema>>
          | undefined;

        if (!output) {
          logAiGeneration({
            timestamp: new Date().toISOString(),
            provider,
            model: result.response.modelId,
            prompt,
            contexts,
            results: [],
            usage: undefined,
            durationMs: Date.now() - startTime,
            error: undefined,
          });
          return { translations: new Map() };
        }

        const { inputTokens, outputTokens, totalTokens } = result.usage;

        const usage =
          inputTokens !== undefined &&
          outputTokens !== undefined &&
          totalTokens !== undefined
            ? { inputTokens, outputTokens, totalTokens }
            : undefined;

        const translations = parseGeneratedObject(output, contexts);

        logAiGeneration({
          timestamp: new Date().toISOString(),
          provider,
          model: result.response.modelId,
          prompt,
          contexts,
          results: contexts.map((ctx) => ({
            sourceKey: ctx.sourceKey,
            result: translations.get(ctx.sourceKey),
          })),
          usage,
          durationMs: Date.now() - startTime,
          error: undefined,
        });

        return {
          translations,
          model: result.response.modelId,
          usage,
        };
      } catch (err) {
        logAiGeneration({
          timestamp: new Date().toISOString(),
          provider,
          model: undefined,
          prompt,
          contexts,
          results: [],
          usage: undefined,
          durationMs: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };
}
