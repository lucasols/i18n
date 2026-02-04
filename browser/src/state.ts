import type { Locale } from '@ls-stack/i18n-core';
import { cachedGetter } from '@ls-stack/utils/cache';
import { retryOnError } from '@ls-stack/utils/retryOnError';

export type LocaleLoader = () => Promise<{ default: Locale }>;

export type LocaleConfig<T extends string = string> = {
  id: T;
  loader: LocaleLoader;
};

export type I18nState<T extends string = string> = {
  activeLocale: T | null;
  isLoading: boolean;
  isLoaded: boolean;
  loadError: Error | null;
  translations: Locale | null;
  regionLocale: string | null;
};

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

type StateChangeCallback = () => void;
const stateListeners: Set<StateChangeCallback> = new Set();

let persistenceKey: string | null = null;
let retryAttempts = 3;
let retryDelay = 1000;
let devMode = false;
let devEnvReady = false;
let loadingLocaleId: string | null = null;
let loadingPromise: Promise<void> | null = null;
let loadedLocaleId: string | null = null;
let loadRequestId = 0;
let clearIntlCacheFn: (() => void) | null = null;
let fallbackLocale: string | null = null;
let preloadRegionLocale: { value: string | null } | null = null;

const invalidScopeErrorMessage =
  'I18n error: Invalid usage of translation function, check if the translate function is called inside a React component scope';

export function configure<T extends string>(options: {
  locales: LocaleConfig<T>[];
  persistenceKey: string;
  fallbackLocale: T | null;
  retryAttempts?: number;
  retryDelay?: number;
  dev?: boolean;
}) {
  localesConfig = options.locales;
  persistenceKey = options.persistenceKey;
  fallbackLocale = options.fallbackLocale;
  retryAttempts = options.retryAttempts ?? 3;
  retryDelay = options.retryDelay ?? 1000;
  devMode = options.dev ?? false;

  preloadRegionLocale = cachedGetter(() => {
    const persistedLocale = getPersistedLocale();
    if (persistedLocale) {
      return inferRegionLocale(persistedLocale);
    }
    if (fallbackLocale) {
      return inferRegionLocale(fallbackLocale);
    }
    return null;
  });
}

export function getState(): I18nState<string> {
  return state;
}

export function isDevMode(): boolean {
  return devMode;
}

export function devEnvIsReady(): void {
  devEnvReady = true;
}

export function assertDevScope(): void {
  if (devMode && !devEnvReady) {
    throw new Error(invalidScopeErrorMessage);
  }
}

export function getLocalesConfig(): LocaleConfig<string>[] {
  return localesConfig;
}

export function subscribe(callback: OnChangeCallback): () => void {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
}

export function subscribeToState(callback: StateChangeCallback): () => void {
  stateListeners.add(callback);

  return () => {
    stateListeners.delete(callback);
  };
}

function notifyStateListeners() {
  for (const callback of stateListeners) {
    callback();
  }
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
  notifyStateListeners();
}

export function inferRegionLocale(localeId: string): string {
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

export function getPersistedLocale(): string | null {
  if (!persistenceKey) return null;
  try {
    return localStorage.getItem(persistenceKey);
  } catch {
    return null;
  }
}

export function getRegionLocale(): string {
  if (state.regionLocale) {
    return state.regionLocale;
  }

  const preloadValue = preloadRegionLocale?.value;
  if (preloadValue) {
    return preloadValue;
  }

  if (devMode) {
    throw new Error(
      'I18n error: No locale configured; call i18nitialize() with a fallbackLocale',
    );
  }

  return 'en-US';
}

export function registerClearIntlCache(fn: () => void): void {
  clearIntlCacheFn = fn;
}

export async function setLocale(localeId: string): Promise<void> {
  if (loadingLocaleId === localeId && loadingPromise) {
    return loadingPromise;
  }

  if (loadedLocaleId === localeId) {
    return;
  }

  const localeConfig = localesConfig.find((l) => l.id === localeId);

  if (!localeConfig) {
    throw new Error(`Locale "${localeId}" not found`);
  }

  const requestId = ++loadRequestId;
  loadingLocaleId = localeId;

  updateState({
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

      if (requestId !== loadRequestId) {
        return;
      }

      if (clearIntlCacheFn) {
        clearIntlCacheFn();
      }

      const regionLocale = inferRegionLocale(localeId);

      loadedLocaleId = localeId;

      updateState({
        activeLocale: localeId,
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
      if (requestId !== loadRequestId) {
        return;
      }
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

export function getDefaultLocale(): string | null {
  return localesConfig[0]?.id ?? null;
}

export function findBestMatchingLocale(): string | null {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (!nav?.languages) {
    return null;
  }

  const availableIds = localesConfig.map((l) => l.id);

  for (const browserLocale of nav.languages) {
    // Priority 1: Exact match (e.g., 'en-US' matches 'en-US')
    if (availableIds.includes(browserLocale)) {
      return browserLocale;
    }

    // Priority 2: Browser regional matches our base (e.g., 'en-GB' matches 'en')
    const browserBase = browserLocale.split('-')[0];
    if (browserBase && availableIds.includes(browserBase)) {
      return browserBase;
    }

    // Priority 3: Browser base matches our locale's base (e.g., 'en-GB' matches 'en-US')
    const matchingLocale = availableIds.find((id) => {
      const localeBase = id.split('-')[0];
      return localeBase === browserBase;
    });
    if (matchingLocale) {
      return matchingLocale;
    }
  }

  return null;
}

type LoadedLocaleSnapshot = {
  isLoading: { locale: string } | null;
  loadError: Error | null;
  loadedLocale: string | null;
};

let cachedSnapshot: LoadedLocaleSnapshot | null = null;

export function getLoadedLocaleSnapshot(): LoadedLocaleSnapshot {
  const isLoading = loadingLocaleId ? { locale: loadingLocaleId } : null;
  const loadedLocale = loadedLocaleId;

  if (
    cachedSnapshot &&
    cachedSnapshot.isLoading?.locale === isLoading?.locale &&
    cachedSnapshot.loadError === state.loadError &&
    cachedSnapshot.loadedLocale === loadedLocale
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = {
    isLoading,
    loadError: state.loadError,
    loadedLocale,
  };

  return cachedSnapshot;
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
  stateListeners.clear();
  cachedSnapshot = null;
  persistenceKey = null;
  fallbackLocale = null;
  preloadRegionLocale = null;
  retryAttempts = 3;
  retryDelay = 1000;
  devMode = false;
  devEnvReady = false;
  loadingLocaleId = null;
  loadingPromise = null;
  loadedLocaleId = null;
  loadRequestId = 0;
}
