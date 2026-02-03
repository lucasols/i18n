import { useSyncExternalStore } from 'react';
import { clearIntlCache } from './formatters';
import {
  configure,
  getLoadedLocaleSnapshot,
  getLocalesConfig,
  getPersistedLocale,
  getRegionLocale,
  getState,
  registerClearIntlCache,
  setLocale,
  setMockedRegionLocale,
  subscribe,
  subscribeToState,
  type LocaleConfig,
} from './state';

export type I18nController<T extends string = string> = {
  setLocale: (localeId: T) => Promise<void>;
  getLoadedLocale: () => T | null;
  getRegionLocale: () => string;
  onLoad: (callback: (localeId: T) => void) => () => void;
  useLoadedLocale: () => {
    isLoading: { locale: T } | null;
    loadError: Error | null;
    loadedLocale: T | null;
  };
  __mockRegionLocale: (locale: string) => void;
};

export type I18nOptions<T extends string> = {
  locales: LocaleConfig<T>[];
  persistenceKey: string;
  fallbackLocale: T;
  retryAttempts?: number;
  retryDelay?: number;
  dev?: boolean;
};

export function i18nitialize<T extends string>(
  options: I18nOptions<T>,
): I18nController<T> {
  configure({
    locales: options.locales,
    persistenceKey: options.persistenceKey,
    retryAttempts: options.retryAttempts,
    retryDelay: options.retryDelay,
    dev: options.dev,
  });

  registerClearIntlCache(clearIntlCache);

  const setLocaleWithFallback = async (localeId: T): Promise<void> => {
    const locales = getLocalesConfig();
    const localeExists = locales.some((l) => l.id === localeId);

    if (!localeExists && options.fallbackLocale) {
      await setLocale(options.fallbackLocale);
      return;
    }

    await setLocale(localeId);
  };

  const controller: I18nController<T> = {
    setLocale: setLocaleWithFallback,
    getLoadedLocale: () => {
      const state = getState();
      return state.activeLocale as T | null;
    },
    getRegionLocale: () => getRegionLocale(),
    onLoad: (callback: (localeId: T) => void) =>
      subscribe(callback as (localeId: string) => void),
    useLoadedLocale: () => {
      const snapshot = useSyncExternalStore(
        subscribeToState,
        getLoadedLocaleSnapshot,
      );
      return {
        isLoading: snapshot.isLoading as { locale: T } | null,
        loadError: snapshot.loadError,
        loadedLocale: snapshot.loadedLocale as T | null,
      };
    },
    __mockRegionLocale: setMockedRegionLocale,
  };

  const persistedLocale = getPersistedLocale() as T | null;
  const initialLocale = persistedLocale ?? options.fallbackLocale;

  if (initialLocale) {
    setLocaleWithFallback(initialLocale).catch((error) => {
      console.error('Failed to load initial locale:', error);
    });
  }

  return controller;
}

export {
  __currency,
  __date,
  __formattedTimeDuration,
  __list,
  __num,
  __relativeTime,
  __relativeTimeFromNow,
  __timeDuration,
  type DateTimeFormats,
  type DurationUnit,
  type RelativeTimeFormat,
  type RelativeTimeUnits,
} from './formatters';
export {
  resetState,
  type I18nState,
  type LocaleConfig,
  type LocaleLoader,
} from './state';
export { __, __jsx, __p, __pjsx, type JsxInterpolation } from './translate';

export type {
  Locale,
  PluralTranslation,
  TranslationValue,
} from '@ls-stack/i18n-core';
