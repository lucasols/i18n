import { cachedGetter } from '@ls-stack/utils/cache';
import { useSyncExternalStore } from 'react';
import { clearIntlCache } from './formatters';
import {
  configure,
  devEnvIsReady,
  findBestMatchingLocale,
  getLoadedLocaleSnapshot,
  getLocalesConfig,
  getPersistedLocale,
  getRegionLocale,
  getState,
  inferRegionLocale,
  registerClearIntlCache,
  setLocale,
  subscribe,
  subscribeToState,
  type LocaleConfig,
} from './state';

export type I18nController<T extends string> = {
  setLocale: (localeId: T | 'auto') => Promise<boolean>;
  setLocaleFromLang: (lang: string) => Promise<boolean>;
  getLoadedLocale: () => T | null;
  getRegionLocale: () => string;
  initialLocale: T;
  getInitialRegionLocale: () => string;
  onLoad: (callback: (localeId: T) => void) => () => void;
  devEnvIsReady: () => void;
  useLoadedLocale: () => {
    isLoading: { locale: T } | null;
    loadError: Error | null;
    loadedLocale: T | null;
  };
};

export type I18nOptions<T extends string> = {
  locales: LocaleConfig<T>[];
  persistenceKey: string;
  fallbackLocale: T | ['auto', T];
  retryAttempts?: number;
  retryDelay?: number;
  dev?: boolean;
};

export function i18nitialize<T extends string>(
  options: I18nOptions<T>,
): I18nController<T> {
  const availableIds = options.locales.map((l) => l.id);

  const findBestMatchingLocaleFromOptions = (): T | null => {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav?.languages) {
      return null;
    }

    for (const browserLocale of nav.languages) {
      if (availableIds.includes(browserLocale as T)) {
        return browserLocale as T;
      }

      const browserBase = browserLocale.split('-')[0];
      if (browserBase && availableIds.includes(browserBase as T)) {
        return browserBase as T;
      }

      const matchingLocale = availableIds.find((id) => {
        const localeBase = id.split('-')[0];
        return localeBase === browserBase;
      });
      if (matchingLocale) {
        return matchingLocale;
      }
    }

    return null;
  };

  let resolvedFallback: T;
  if (Array.isArray(options.fallbackLocale)) {
    const autoLocale = findBestMatchingLocaleFromOptions();
    resolvedFallback = autoLocale ?? options.fallbackLocale[1];
  } else {
    resolvedFallback = options.fallbackLocale;
  }

  configure({
    locales: options.locales,
    persistenceKey: options.persistenceKey,
    fallbackLocale: resolvedFallback,
    retryAttempts: options.retryAttempts,
    retryDelay: options.retryDelay,
    dev: options.dev,
  });

  registerClearIntlCache(clearIntlCache);

  const persistedLocale = getPersistedLocale() as T | null;
  const initialLocale: T = persistedLocale ?? resolvedFallback;
  const cachedInitialRegionLocale = cachedGetter(() =>
    inferRegionLocale(initialLocale),
  );

  const resolveLocaleId = (localeId: T | 'auto'): T => {
    if (localeId === 'auto') {
      const autoLocale = findBestMatchingLocale();
      if (autoLocale) return autoLocale as T;
      if (resolvedFallback) return resolvedFallback;
      throw new Error(
        'No locales match browser settings and no fallback configured',
      );
    }
    return localeId;
  };

  const findLocaleFromLang = (lang: string): T | null => {
    // Priority 1: Exact match (e.g., 'en-US' matches 'en-US')
    if (availableIds.includes(lang as T)) {
      return lang as T;
    }

    // Priority 2: Input has region, match base (e.g., 'en-US' input matches 'en' config)
    const langBase = lang.split('-')[0];
    if (langBase && availableIds.includes(langBase as T)) {
      return langBase as T;
    }

    // Priority 3: Input is base, match regional (e.g., 'en' input matches 'en-US' config)
    const matchingLocale = availableIds.find((id) => {
      const localeBase = id.split('-')[0];
      return localeBase === langBase;
    });
    if (matchingLocale) {
      return matchingLocale;
    }

    return null;
  };

  const setLocaleWithFallback = async (
    localeId: T | 'auto',
  ): Promise<boolean> => {
    const resolvedLocaleId = resolveLocaleId(localeId);
    const locales = getLocalesConfig();
    const localeExists = locales.some((l) => l.id === resolvedLocaleId);

    if (!localeExists && resolvedFallback) {
      await setLocale(resolvedFallback);
      return false;
    }

    await setLocale(resolvedLocaleId);
    return true;
  };

  const controller: I18nController<T> = {
    setLocale: setLocaleWithFallback,
    setLocaleFromLang: async (lang: string): Promise<boolean> => {
      const matchedLocale = findLocaleFromLang(lang);
      if (matchedLocale) {
        await setLocale(matchedLocale);
        return true;
      }
      return false;
    },
    getLoadedLocale: () => {
      const state = getState();
      return state.activeLocale as T | null;
    },
    getRegionLocale: () => getRegionLocale(),
    initialLocale,
    getInitialRegionLocale: () => cachedInitialRegionLocale.value,
    onLoad: (callback: (localeId: T) => void) =>
      subscribe(callback as (localeId: string) => void),
    devEnvIsReady,
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
  };

  setLocaleWithFallback(initialLocale).catch((error) => {
    console.error('Failed to load initial locale:', error);
  });

  return controller;
}

export {
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
