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
} from './state';
import type { I18nController, LocaleConfig } from './types';

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
} from './formatters';
export { resetState } from './state';
export { __, __jsx, __p, __pjsx } from './translate';

export type {
  DateTimeFormats,
  DurationUnit,
  I18nController,
  I18nState,
  JsxInterpolation,
  Locale,
  LocaleConfig,
  LocaleLoader,
  PluralTranslation,
  RelativeTimeFormat,
  RelativeTimeUnits,
  TranslationValue,
} from './types';
