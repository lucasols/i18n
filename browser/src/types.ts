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
  regionLocale: string | null;
};

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

export type JsxInterpolation = string | number | ReactNode;

export type DateTimeFormats = {
  weekday?: 'narrow' | 'short' | 'long';
  era?: 'narrow' | 'short' | 'long';
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'narrow' | 'short' | 'long';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
  timeZoneName?: 'short' | 'long';
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
};

export type RelativeTimeFormat = {
  numeric?: 'always' | 'auto';
  style?: 'long' | 'narrow';
};

export type RelativeTimeUnits =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

export type DurationUnit =
  | 'years'
  | 'months'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'milliseconds';

export type {
  Locale,
  PluralTranslation,
  TranslationValue,
} from '@ls-stack/i18n-core';
