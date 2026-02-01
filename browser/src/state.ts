import type { Locale } from '@ls-stack/i18n-core';
import type { I18nState, LocaleConfig } from './types';

let localesConfig: LocaleConfig<string>[] = [];
let state: I18nState<string> = {
  activeLocale: null,
  isLoading: false,
  isLoaded: false,
  loadError: null,
  translations: null,
};

const listeners: Set<() => void> = new Set();

let persistenceKey: string | null = null;
let retryAttempts = 3;
let retryDelay = 1000;

export function configure<T extends string>(options: {
  locales: LocaleConfig<T>[];
  persistenceKey?: string;
  retryAttempts?: number;
  retryDelay?: number;
}) {
  localesConfig = options.locales;
  persistenceKey = options.persistenceKey ?? null;
  retryAttempts = options.retryAttempts ?? 3;
  retryDelay = options.retryDelay ?? 1000;
}

export function getState(): I18nState<string> {
  return state;
}

export function getLocalesConfig(): LocaleConfig<string>[] {
  return localesConfig;
}

export function getActiveLocaleConfig(): LocaleConfig<string> | null {
  if (!state.activeLocale) return null;
  return localesConfig.find((l) => l.id === state.activeLocale) ?? null;
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  for (const callback of listeners) {
    callback();
  }
}

function updateState(newState: Partial<I18nState<string>>) {
  state = { ...state, ...newState };
  notifyListeners();
}

async function loadWithRetry(
  loader: () => Promise<{ default: Locale }>,
  attempts: number,
): Promise<Locale> {
  try {
    const result = await loader();
    return result.default;
  } catch (error) {
    if (attempts > 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return loadWithRetry(loader, attempts - 1);
    }
    throw error;
  }
}

export async function setLocale(localeId: string): Promise<void> {
  const localeConfig = localesConfig.find((l) => l.id === localeId);

  if (!localeConfig) {
    throw new Error(`Locale "${localeId}" not found`);
  }

  updateState({
    activeLocale: localeId,
    isLoading: true,
    loadError: null,
  });

  try {
    const translations = await loadWithRetry(localeConfig.loader, retryAttempts);

    updateState({
      translations,
      isLoading: false,
      isLoaded: true,
    });

    if (persistenceKey) {
      try {
        localStorage.setItem(persistenceKey, localeId);
      } catch {
        // localStorage might not be available
      }
    }
  } catch (error) {
    updateState({
      isLoading: false,
      loadError: error instanceof Error ? error : new Error(String(error)),
    });
    throw error;
  }
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
  };
  listeners.clear();
  persistenceKey = null;
  retryAttempts = 3;
  retryDelay = 1000;
}
