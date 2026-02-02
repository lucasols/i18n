import { retryOnError } from '@ls-stack/utils/retryOnError';
import type { I18nState, LocaleConfig } from './types';

let localesConfig: LocaleConfig<string>[] = [];
let state: I18nState<string> = {
  activeLocale: null,
  isLoading: false,
  isLoaded: false,
  loadError: null,
  translations: null,
  regionLocale: null,
};

type OnChangeCallback = (localeId: string) => void;
const listeners: Set<OnChangeCallback> = new Set();

let persistenceKey: string | null = null;
let retryAttempts = 3;
let retryDelay = 1000;
let devMode = false;
let loadingLocaleId: string | null = null;
let loadingPromise: Promise<void> | null = null;
let mockedRegionLocale: string | null = null;
let clearIntlCacheFn: (() => void) | null = null;

export function configure<T extends string>(options: {
  locales: LocaleConfig<T>[];
  persistenceKey: string;
  retryAttempts?: number;
  retryDelay?: number;
  dev?: boolean;
}) {
  localesConfig = options.locales;
  persistenceKey = options.persistenceKey;
  retryAttempts = options.retryAttempts ?? 3;
  retryDelay = options.retryDelay ?? 1000;
  devMode = options.dev ?? false;
}

export function getState(): I18nState<string> {
  return state;
}

export function isDevMode(): boolean {
  return devMode;
}

export function getLocalesConfig(): LocaleConfig<string>[] {
  return localesConfig;
}

export function getActiveLocaleConfig(): LocaleConfig<string> | null {
  if (!state.activeLocale) return null;
  return localesConfig.find((l) => l.id === state.activeLocale) ?? null;
}

export function subscribe(callback: OnChangeCallback): () => void {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  if (state.activeLocale) {
    for (const callback of listeners) {
      callback(state.activeLocale);
    }
  }
}

function updateState(newState: Partial<I18nState<string>>) {
  state = { ...state, ...newState };
}

function inferRegionLocale(localeId: string): string {
  if (localeId.includes('-')) {
    return localeId;
  }

  if (typeof navigator !== 'undefined') {
    const regionLocale = navigator.languages.find(
      (lang) => lang.startsWith(localeId) && lang.includes('-'),
    );
    if (regionLocale) {
      return regionLocale;
    }
  }

  return localeId;
}

export function setMockedRegionLocale(locale: string): void {
  mockedRegionLocale = locale;
  if (state.activeLocale) {
    updateState({ regionLocale: locale });
  }
}

export function getRegionLocale(): string {
  if (mockedRegionLocale) {
    return mockedRegionLocale;
  }
  const fallback = state.regionLocale ?? state.activeLocale ?? 'en-US';
  return fallback;
}

export function registerClearIntlCache(fn: () => void): void {
  clearIntlCacheFn = fn;
}

export async function setLocale(localeId: string): Promise<void> {
  if (loadingLocaleId === localeId && loadingPromise) {
    return loadingPromise;
  }

  const localeConfig = localesConfig.find((l) => l.id === localeId);

  if (!localeConfig) {
    throw new Error(`Locale "${localeId}" not found`);
  }

  loadingLocaleId = localeId;

  updateState({
    activeLocale: localeId,
    isLoading: true,
    loadError: null,
  });

  const doLoad = async () => {
    try {
      const translations = await retryOnError(
        async () => (await localeConfig.loader()).default,
        retryAttempts,
        { delayBetweenRetriesMs: retryDelay },
      );

      if (clearIntlCacheFn) {
        clearIntlCacheFn();
      }

      const regionLocale =
        localeConfig.regionLocale ?? inferRegionLocale(localeId);

      updateState({
        translations,
        isLoading: false,
        isLoaded: true,
        regionLocale,
      });

      if (typeof document !== 'undefined') {
        document.documentElement.lang = regionLocale;
      }

      if (devMode) {
        console.info('locale loaded', localeId);
      }

      if (persistenceKey) {
        try {
          localStorage.setItem(persistenceKey, localeId);
        } catch {
          // localStorage might not be available
        }
      }

      loadingLocaleId = null;
      loadingPromise = null;
      notifyListeners();
    } catch (error) {
      loadingLocaleId = null;
      loadingPromise = null;
      updateState({
        isLoading: false,
        loadError: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  };

  loadingPromise = doLoad();
  return loadingPromise;
}

export function getPersistedLocale(): string | null {
  if (!persistenceKey) return null;
  try {
    return localStorage.getItem(persistenceKey);
  } catch {
    return null;
  }
}

export function getDefaultLocale(): string | null {
  return localesConfig[0]?.id ?? null;
}

export function resetState(): void {
  localesConfig = [];
  state = {
    activeLocale: null,
    isLoading: false,
    isLoaded: false,
    loadError: null,
    translations: null,
    regionLocale: null,
  };
  listeners.clear();
  persistenceKey = null;
  retryAttempts = 3;
  retryDelay = 1000;
  devMode = false;
  loadingLocaleId = null;
  loadingPromise = null;
  mockedRegionLocale = null;
}
