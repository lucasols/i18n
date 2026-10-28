import {
  createHashAndFallbackTranslation,
  interpolate,
  type Locale,
  selectPluralForm,
} from '@ls-stack/i18n-core';

type I18nOptions<T extends string> = {
  locales: Record<T, Locale>;
  /**
   * Locale used by `toAvailableLocale` and `withUnknownLocale` when no locale
   * matches. Defaults to the first locale in `locales`
   */
  fallbackLocale?: NoInfer<T>;
};

let config: I18nOptions<string> | null = null;

function normalizeLocaleTag(localeTag: string): string {
  return localeTag.trim().toLowerCase().replaceAll('_', '-');
}

function getBaseLanguage(normalizedTag: string): string {
  const separatorIndex = normalizedTag.indexOf('-');
  return separatorIndex === -1 ? normalizedTag : (
      normalizedTag.slice(0, separatorIndex)
    );
}

export function i18nitialize<T extends string>(options: I18nOptions<T>) {
  config = options;

  function isLocaleId(id: string): id is T {
    return Object.hasOwn(options.locales, id);
  }

  const localeIds = Object.keys(options.locales).filter(isLocaleId);
  const fallbackLocale = options.fallbackLocale ?? localeIds[0];

  const localeByTag = new Map<string, T>();
  const localeByBaseLanguage = new Map<string, T>();

  for (const localeId of localeIds) {
    const normalizedId = normalizeLocaleTag(localeId);
    localeByTag.set(normalizedId, localeId);

    const baseLanguage = getBaseLanguage(normalizedId);
    // a locale without region (e.g. `pt`) wins over regional ones (e.g. `pt-PT`)
    if (
      normalizedId === baseLanguage ||
      !localeByBaseLanguage.has(baseLanguage)
    ) {
      localeByBaseLanguage.set(baseLanguage, localeId);
    }
  }

  const instances = new Map<T, I18n>();

  function getInstance(localeId: T): I18n {
    let instance = instances.get(localeId);

    if (!instance) {
      instance = new I18n(localeId);
      instances.set(localeId, instance);
    }

    return instance;
  }

  /**
   * Closest available locale of a language tag like `pt-BR` or `pt_br`,
   * matching the exact tag first, then its base language. Returns the
   * fallback locale if nothing matches
   */
  function toAvailableLocale(localeTag: string | null | undefined): T {
    if (localeTag) {
      const normalizedTag = normalizeLocaleTag(localeTag);

      const matchedLocale =
        localeByTag.get(normalizedTag) ??
        localeByBaseLanguage.get(getBaseLanguage(normalizedTag));

      if (matchedLocale !== undefined) return matchedLocale;
    }

    if (fallbackLocale === undefined) {
      throw new Error('No locales configured');
    }

    return fallbackLocale;
  }

  return {
    with(localeId: T): I18n {
      return getInstance(localeId);
    },
    /** `with` for an unvalidated language tag, see `toAvailableLocale` */
    withUnknownLocale(localeTag: string | null | undefined): I18n {
      return getInstance(toAvailableLocale(localeTag));
    },
    toAvailableLocale,
  };
}

export type { I18n };

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
