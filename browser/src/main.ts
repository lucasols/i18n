import {
  configure,
  getActiveLocaleConfig,
  getDefaultLocale,
  getPersistedLocale,
  getState,
  setLocale,
  subscribe,
} from './state';
import type { I18nController, LocaleConfig } from './types';

export type I18nOptions<T extends string> = {
  locales: LocaleConfig<T>[];
  persistenceKey?: string;
  retryAttempts?: number;
  retryDelay?: number;
  defaultLocale?: T;
};

export function i18nitialize<T extends string>(
  options: I18nOptions<T>,
): I18nController<T> {
  configure({
    locales: options.locales,
    persistenceKey: options.persistenceKey,
    retryAttempts: options.retryAttempts,
    retryDelay: options.retryDelay,
  });

  const controller: I18nController<T> = {
    setLocale: async (localeId: T) => {
      await setLocale(localeId);
    },
    getActiveLocale: () => getState().activeLocale as T | null,
    getRegionLocale: () => {
      const config = getActiveLocaleConfig();
      return config?.regionLocale ?? config?.id ?? 'en-US';
    },
    isLoaded: () => getState().isLoaded,
    onChange: (callback: () => void) => subscribe(callback),
  };

  const persistedLocale = getPersistedLocale() as T | null;
  const defaultLocale = options.defaultLocale ?? (getDefaultLocale() as T | null);
  const initialLocale = persistedLocale ?? defaultLocale;

  if (initialLocale) {
    setLocale(initialLocale).catch((error) => {
      console.error('Failed to load initial locale:', error);
    });
  }

  return controller;
}

export { __, __jsx, __p, __pjsx } from './translate';
export { resetState } from './state';
export {
  __currency,
  __date,
  __formattedTimeDuration,
  __list,
  __num,
  __relativeTime,
  __relativeTimeFromNow,
} from './formatters';

export type {
  I18nController,
  I18nState,
  JsxInterpolation,
  Locale,
  LocaleConfig,
  LocaleLoader,
  PluralTranslation,
  TranslationValue,
} from './types';
