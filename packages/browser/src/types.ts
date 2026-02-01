import type { Locale } from '@ls-stack/i18n-core';
import type { ReactNode } from 'react';

export type LocaleLoader = () => Promise<{ default: Locale }>;

export type LocaleConfig<T extends string = string> = {
  id: T;
  loader: LocaleLoader;
  currencyCode?: string;
  regionLocale?: string;
};

export type I18nState<T extends string = string> = {
  activeLocale: T | null;
  isLoading: boolean;
  isLoaded: boolean;
  loadError: Error | null;
  translations: Locale | null;
};

export type I18nController<T extends string = string> = {
  setLocale: (localeId: T) => Promise<void>;
  getActiveLocale: () => T | null;
  getRegionLocale: () => string;
  isLoaded: () => boolean;
  onChange: (callback: () => void) => () => void;
};

export type JsxInterpolation = string | number | ReactNode;

export type {
  Locale,
  PluralTranslation,
  TranslationValue,
} from '@ls-stack/i18n-core';
