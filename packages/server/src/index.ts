import {
  createHashAndFallbackTranslation,
  interpolate,
  type Locale,
  selectPluralForm,
} from '@ls-stack/i18n-core';

type I18nOptions<T extends string> = {
  locales: Record<T, Locale>;
};

let config: I18nOptions<string> | null = null;

export function i18nitialize<T extends string>(options: I18nOptions<T>) {
  config = options;

  return {
    with(localeId: T) {
      return new I18n(localeId);
    },
  };
}

class I18n {
  constructor(private localeId: string) {}

  __ = (strings: TemplateStringsArray, ...exprs: (string | number)[]): string => {
    const [hash, fallbackTranslation] = createHashAndFallbackTranslation(
      strings,
      exprs,
    );

    const activeLocale = config?.locales[this.localeId];

    if (!activeLocale) {
      throw new Error('No active locale');
    }

    const selectedTranslation = activeLocale[hash];

    if (selectedTranslation === undefined) {
      return fallbackTranslation;
    }

    if (typeof selectedTranslation === 'string' && selectedTranslation) {
      return interpolate(selectedTranslation, exprs) || fallbackTranslation;
    }

    if (selectedTranslation) {
      throw new Error(
        'Invalid translation, this translation should use the plural `__p` method',
      );
    }

    return fallbackTranslation;
  };

  __p = (num: number) => {
    return (strings: TemplateStringsArray, ...exprs: (string | number)[]) => {
      const [hash, fallbackTranslation] = createHashAndFallbackTranslation(
        strings,
        exprs,
      );

      const activeLocale = config?.locales[this.localeId];

      if (!activeLocale) {
        throw new Error('No active locale');
      }

      const selectedTranslation = activeLocale[hash];

      if (selectedTranslation === undefined) {
        return fallbackTranslation;
      }

      if (
        typeof selectedTranslation === 'object' &&
        selectedTranslation !== null
      ) {
        const translation = selectPluralForm(num, selectedTranslation);

        if (translation === null) {
          console.error(`No plural configured for hash: ${hash}`);
          return fallbackTranslation;
        }

        return interpolate(translation, exprs) || fallbackTranslation;
      }

      if (selectedTranslation) {
        throw new Error(
          'Invalid translation, this translation should use the `__` method',
        );
      }

      return fallbackTranslation;
    };
  };
}

export type { Locale, LocaleConfig, PluralTranslation, TranslationValue } from '@ls-stack/i18n-core';
