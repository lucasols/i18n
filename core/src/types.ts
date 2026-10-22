export type PluralTranslation = {
  manyLimit?: number;
  zero?: string;
  one?: string;
  '+2': string | null;
  many?: string;
};

export type TranslationValue = string | null | PluralTranslation;

export type Locale = Record<string, TranslationValue>;

export type LocaleConfig<T extends string = string> = Record<T, Locale>;

/**
 * Plural translation compiled by the vite plugin: `[zero, one, +2, many, manyLimit]`.
 * `0` marks a missing form, `many` and `manyLimit` are omitted when not both set.
 */
export type CompiledPlural =
  | [zero: string | 0, one: string | 0, plus2: string]
  | [
      zero: string | 0,
      one: string | 0,
      plus2: string,
      many: string,
      manyLimit: number,
    ];

/** `0` marks a missing `$` translation, rendered as `…` */
export type CompiledTranslation = string | 0 | CompiledPlural;

/** Locale compiled by the vite plugin, indexed by translation id */
export type CompiledLocale = CompiledTranslation[];
