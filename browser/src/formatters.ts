import { cachedGetter } from '@ls-stack/utils/cache';
import { getCompositeKey } from '@ls-stack/utils/getCompositeKey';
import {
  assertDevScope,
  getActiveLocaleConfig,
  getRegionLocale,
  getState,
} from './state';

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

type PartialRecord<K extends string, V> = { [P in K]?: V };

interface IntlDurationFormatOptions {
  style?: 'narrow' | 'short' | 'long';
}

interface IntlDurationFormat {
  format(duration: PartialRecord<DurationUnit, number>): string;
}

interface IntlDurationFormatConstructor {
  new (locale?: string, options?: IntlDurationFormatOptions): IntlDurationFormat;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Intl {
    const DurationFormat: IntlDurationFormatConstructor | undefined;
  }
}

const intlCache = {
  date: new Map<string, Intl.DateTimeFormat>(),
  number: new Map<string, Intl.NumberFormat>(),
  relative: new Map<string, Intl.RelativeTimeFormat>(),
  list: new Map<string, Intl.ListFormat>(),
  duration: new Map<string, IntlDurationFormat>(),
};

const cacheKeyMemo = new WeakMap<object, string>();

export function clearIntlCache(): void {
  intlCache.date.clear();
  intlCache.number.clear();
  intlCache.relative.clear();
  intlCache.list.clear();
  intlCache.duration.clear();
}

function getCacheKey(options: unknown): string {
  if (options === undefined) return '';

  if (typeof options !== 'object' || options === null) {
    return getCompositeKey(options);
  }

  const cached = cacheKeyMemo.get(options);
  if (cached) return cached;

  const key = getCompositeKey(options);
  cacheKeyMemo.set(options, key);
  return key;
}

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' && value.length === 10) {
    return new Date(`${value}T00:00`);
  }
  return new Date(value);
}

const hasRelativeTimeFormat = cachedGetter(
  () =>
    typeof Intl !== 'undefined'
    && typeof Intl.RelativeTimeFormat !== 'undefined',
);

const hasListFormat = cachedGetter(
  () => typeof Intl !== 'undefined' && typeof Intl.ListFormat !== 'undefined',
);

const hasDurationFormat = cachedGetter(
  () => typeof Intl !== 'undefined' && typeof Intl.DurationFormat !== 'undefined',
);

const hasUnitStyleSupport = cachedGetter(() => {
  if (typeof Intl === 'undefined' || typeof Intl.NumberFormat === 'undefined') {
    return false;
  }
  try {
    new Intl.NumberFormat('en', {
      style: 'unit',
      unit: 'second',
      unitDisplay: 'long',
    }).format(1);
    return true;
  } catch {
    return false;
  }
});

function formatRelativeFallback(
  value: number,
  unit: RelativeTimeUnits,
  format?: RelativeTimeFormat,
): string {
  if (value === 0 && format?.numeric === 'auto') {
    return 'now';
  }

  const absValue = Math.abs(value);
  const unitLabel = absValue === 1 ? unit : `${unit}s`;

  if (value > 0) {
    return `in ${absValue} ${unitLabel}`;
  }

  return `${absValue} ${unitLabel} ago`;
}

function formatDurationFallback(
  value: number,
  unit: RelativeTimeUnits,
  short: boolean | undefined,
): string {
  const absValue = Math.abs(value);
  const unitLabels: Record<RelativeTimeUnits, string> = {
    second: 'second',
    minute: 'minute',
    hour: 'hour',
    day: 'day',
    week: 'week',
    month: 'month',
    quarter: 'quarter',
    year: 'year',
  };

  const shortLabels: Record<RelativeTimeUnits, string> = {
    second: 'sec',
    minute: 'min',
    hour: 'hr',
    day: 'day',
    week: 'wk',
    month: 'mo',
    quarter: 'qtr',
    year: 'yr',
  };

  const baseLabel = short ? shortLabels[unit] : unitLabels[unit];
  const label = absValue === 1 ? baseLabel : `${baseLabel}s`;
  return `${absValue} ${label}`;
}

export function __date(
  date: Date | string | number,
  format?: DateTimeFormats,
): string {
  assertDevScope();
  const regionLocale = getRegionLocale();
  const cacheKey = `${regionLocale}:${getCacheKey(format)}`;

  let formatter = intlCache.date.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(regionLocale, format);
    intlCache.date.set(cacheKey, formatter);
  }

  const dateInstance = toDate(date);

  if (Number.isNaN(dateInstance.getTime())) {
    return 'Invalid Date';
  }

  return formatter.format(dateInstance);
}

export function __num(
  num: number | null,
  options?: Intl.NumberFormatOptions,
): string {
  assertDevScope();
  if (num === null) {
    return '';
  }

  const regionLocale = getRegionLocale();
  const cacheKey = `${regionLocale}:${getCacheKey(options)}`;

  let formatter = intlCache.number.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(regionLocale, options);
    intlCache.number.set(cacheKey, formatter);
  }

  return formatter.format(num);
}

export function __currency(
  num: number,
  currencyCode?: string,
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>,
): string {
  assertDevScope();
  const regionLocale = getRegionLocale();
  const config = getActiveLocaleConfig();
  const currency = currencyCode ?? config?.currencyCode ?? 'USD';

  const fullOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options,
  };

  const cacheKey = `${regionLocale}:${getCacheKey(fullOptions)}`;

  let formatter = intlCache.number.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(regionLocale, fullOptions);
    intlCache.number.set(cacheKey, formatter);
  }

  return formatter.format(num);
}

function getUnit(
  from: Date | string | number | undefined,
  to: Date | string | number | undefined,
): { value: number; unit: RelativeTimeUnits } {
  const fromDate = toDate(from ?? new Date());
  const toDate_ = toDate(to ?? new Date());

  const diffMs = fromDate.getTime() - toDate_.getTime();
  const diffSecs = diffMs / 1000;

  if (Math.abs(diffSecs) < 60) {
    return { value: Math.round(diffSecs), unit: 'second' };
  }

  const diffMins = diffSecs / 60;
  if (Math.abs(diffMins) < 60) {
    return { value: Math.floor(diffMins), unit: 'minute' };
  }

  const diffHours = diffMins / 60;
  if (Math.abs(diffHours) < 24) {
    return { value: Math.floor(diffHours), unit: 'hour' };
  }

  const diffDays = diffHours / 24;

  const fromYear = fromDate.getFullYear();
  const toYear = toDate_.getFullYear();
  const yearDiff = fromYear - toYear;

  if (Math.abs(yearDiff) > 0) {
    return { value: yearDiff, unit: 'year' };
  }

  const fromMonth = fromDate.getMonth();
  const toMonth = toDate_.getMonth();
  const monthDiff = fromMonth - toMonth + (fromYear - toYear) * 12;

  if (Math.abs(monthDiff) > 0) {
    return { value: monthDiff, unit: 'month' };
  }

  return { value: Math.floor(diffDays), unit: 'day' };
}

export function __relativeTime(
  value: { from?: Date | string | number; to?: Date | string | number },
  unit: RelativeTimeUnits | 'auto' = 'auto',
  format?: RelativeTimeFormat,
  zeroFallback = -1,
): string {
  assertDevScope();

  let diff: number;
  let formatUnit: Intl.RelativeTimeFormatUnit;

  if (unit === 'auto') {
    const autoUnit = getUnit(value.from, value.to);
    formatUnit = autoUnit.unit;
    diff = autoUnit.value || zeroFallback;
  } else {
    formatUnit = unit;
    const fromDate = toDate(value.from ?? new Date());
    const toDateVal = toDate(value.to ?? new Date());
    const diffMs = fromDate.getTime() - toDateVal.getTime();

    switch (unit) {
      case 'second':
        diff = Math.round(diffMs / 1000);
        break;
      case 'minute':
        diff = Math.round(diffMs / (1000 * 60));
        break;
      case 'hour':
        diff = Math.round(diffMs / (1000 * 60 * 60));
        break;
      case 'day':
        diff = Math.round(diffMs / (1000 * 60 * 60 * 24));
        break;
      case 'week':
        diff = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
        break;
      case 'month':
        diff = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
        break;
      case 'quarter':
        diff = Math.round(diffMs / (1000 * 60 * 60 * 24 * 91));
        break;
      case 'year':
        diff = Math.round(diffMs / (1000 * 60 * 60 * 24 * 365));
        break;
      default:
        diff = 0;
    }
    diff = diff || zeroFallback;
  }

  if (Number.isNaN(diff)) {
    return 'Invalid Date';
  }

  if (!hasRelativeTimeFormat.value) {
    return formatRelativeFallback(diff, formatUnit as RelativeTimeUnits, format);
  }

  const regionLocale = getRegionLocale();
  const cacheKey = `${regionLocale}:${getCacheKey(format)}`;

  let formatter = intlCache.relative.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(regionLocale, format);
    intlCache.relative.set(cacheKey, formatter);
  }

  return formatter.format(diff, formatUnit);
}

export function __relativeTimeFromNow(
  date: Date | string | number,
  options: {
    format?: RelativeTimeFormat;
    unit?: RelativeTimeUnits;
    useDateForLongerDiffs?: DateTimeFormats;
    longDiffDaysThreshold?: number;
    now?: Date;
  } = {},
): string {
  assertDevScope();
  const {
    format,
    unit,
    useDateForLongerDiffs,
    longDiffDaysThreshold = 7,
    now = new Date(),
  } = options;

  if (useDateForLongerDiffs) {
    const dateValue = toDate(date);
    const diffMs = now.getTime() - dateValue.getTime();
    const diffDays = Math.abs(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > longDiffDaysThreshold) {
      return __date(date, useDateForLongerDiffs);
    }
  }

  return __relativeTime({ from: date, to: now }, unit, format);
}

export function __timeDuration(value: {
  from?: Date | string;
  to?: Date | string;
  ms?: number;
  short?: boolean;
}): { formatted: string; unit: RelativeTimeUnits } {
  assertDevScope();
  const { translations } = getState();

  if (!translations) {
    return { formatted: '?', unit: 'second' };
  }

  const msBaseTime = 1736058575000;

  const autoUnit =
    value.ms !== undefined
      ? getUnit(new Date(msBaseTime + value.ms), new Date(msBaseTime))
      : getUnit(value.to, value.from);

  const formatUnit = autoUnit.unit;
  const diff = autoUnit.value;

  let formatted: string;

  if (hasUnitStyleSupport.value) {
    formatted = __num(Math.abs(diff), {
      style: 'unit',
      unit: formatUnit,
      unitDisplay: value.short ? 'short' : 'long',
    });
  } else {
    formatted = formatDurationFallback(diff, formatUnit, value.short);
  }

  return {
    formatted,
    unit: formatUnit,
  };
}

type ListFormatOptions = {
  type?: 'conjunction' | 'disjunction' | 'unit';
  style?: 'long' | 'short' | 'narrow';
  localeMatcher?: 'lookup' | 'best fit';
};

export function __list(items: string[], options?: ListFormatOptions): string {
  assertDevScope();
  if (!hasListFormat.value) {
    return items.join(', ');
  }

  const regionLocale = getRegionLocale();
  const cacheKey = `${regionLocale}:${getCacheKey(options)}`;

  let formatter = intlCache.list.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.ListFormat(regionLocale, options);
    intlCache.list.set(cacheKey, formatter);
  }

  return formatter.format(items);
}

const unitsOrder: DurationUnit[] = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
];

const ptUnitSingularMap: Record<DurationUnit, string> = {
  years: 'ano',
  months: 'm',
  days: 'd',
  hours: 'h',
  minutes: 'min',
  seconds: 's',
  milliseconds: 'ms',
};

const ptUnitMapPlural: Record<DurationUnit, string> = {
  years: 'a',
  months: 'm',
  days: 'd',
  hours: 'h',
  minutes: 'min',
  seconds: 's',
  milliseconds: 'ms',
};

function msToTimeString(
  durationObj: PartialRecord<DurationUnit, number>,
  hoursMinLength = 2,
): string {
  const {
    hours = 0,
    minutes = 0,
    seconds = 0,
    days = 0,
    months = 0,
    years = 0,
  } = durationObj;

  const pad = (val: number, maxLength = 2) =>
    val.toString().padStart(maxLength, '0');

  return `${pad(years)}y ${pad(months)}m ${pad(days)}d ${pad(hours, hoursMinLength)}:${pad(minutes)}:${pad(seconds)}`;
}

export function __formattedTimeDuration(
  durationObj: PartialRecord<DurationUnit, number>,
  options: {
    maxUnitsToShow?: number;
    style?: 'narrow' | 'short' | 'long';
  } = {},
): string {
  assertDevScope();
  const { maxUnitsToShow, style = 'narrow' } = options;

  const regionLocale = getRegionLocale();

  const durationObjToUse: PartialRecord<DurationUnit, number> = maxUnitsToShow
    ? {}
    : durationObj;

  if (maxUnitsToShow) {
    let unitsAdded = 0;
    for (const unit of unitsOrder) {
      const value = durationObj[unit];

      if (value === 0 || value === undefined) continue;

      durationObjToUse[unit] = value;

      unitsAdded++;

      if (unitsAdded >= maxUnitsToShow) break;
    }
  }

  if (style === 'narrow' && regionLocale.startsWith('pt')) {
    let formatted = '';

    for (const unit of unitsOrder) {
      const value = durationObjToUse[unit];

      if (value === 0 || value === undefined) continue;

      formatted += `${value}${
        (value === 1 ? ptUnitSingularMap : ptUnitMapPlural)[unit]
      } `;
    }

    return formatted.trimEnd();
  }

  try {
    if (hasDurationFormat.value && Intl.DurationFormat) {
      const cacheKey = `${regionLocale}:${style}`;
      let formatter = intlCache.duration.get(cacheKey);
      if (!formatter) {
        formatter = new Intl.DurationFormat(regionLocale, { style });
        intlCache.duration.set(cacheKey, formatter);
      }

      return formatter.format(durationObjToUse);
    }
  } catch {
    // fallback to old implementation
  }

  return msToTimeString(durationObjToUse);
}
