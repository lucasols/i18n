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
  /**
   * Sets the active locale. Pass 'auto' to detect from browser settings.
   * @returns `true` if the locale was set successfully, `false` if it fell back to the fallback locale.
   */
  setLocale: (localeId: T | 'auto') => Promise<boolean>;
  /**
   * Sets the nearest available locale from a language identifier (e.g., "en", "pt-BR").
   * Matching priority: exact match → regional input matches base → base input matches regional.
   * @returns `true` if a matching locale was found and set, `false` otherwise.
   */
  setNearestLocale: (lang: string) => Promise<boolean>;
  /**
   * Returns the currently loaded locale, or `null` if no locale has been loaded yet.
   */
  getLoadedLocale: () => T | null;
  /**
   * Returns the regional locale (e.g., "en-US") inferred from the loaded locale and browser settings.
   */
  getRegionLocale: () => string;
  /**
   * The locale that was determined at initialization (from persistence or fallback).
   * This value never changes after initialization.
   */
  initialLocale: T;
  /**
   * Returns the regional locale inferred from `initialLocale` and browser settings.
   * This value never changes after initialization.
   */
  getInitialRegionLocale: () => string;
  /**
   * Registers a callback to be invoked whenever a locale finishes loading.
   * @returns An unsubscribe function.
   */
  onLoad: (callback: (localeId: T) => void) => () => void;
  /**
   * Signals that the dev environment is ready. Required in dev mode before translations work.
   */
  devEnvIsReady: () => void;
  /**
   * React hook that returns the current loading state and loaded locale.
   */
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
    setNearestLocale: async (lang: string): Promise<boolean> => {
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
