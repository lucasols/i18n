export type PluralTranslationBase = {
  manyLimit?: number;
  zero?: string;
  one?: string;
  many?: string;
};

export type PluralTranslation = PluralTranslationBase & {
  '+2': string;
};

export type DefaultLocalePluralTranslation = PluralTranslationBase & {
  '+2': string | null;
};

export type TranslationValue = string | null | PluralTranslation;

export type DefaultLocaleTranslationValue =
  | string
  | null
  | DefaultLocalePluralTranslation;

export type Locale = Record<string, TranslationValue>;

export type DefaultLocale = Record<string, DefaultLocaleTranslationValue>;

export type LocaleConfig<T extends string = string> = Record<T, Locale>;
