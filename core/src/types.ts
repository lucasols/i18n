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
