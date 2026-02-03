import { cachedGetter } from '@ls-stack/utils/cache';
import { getCompositeKey } from '@ls-stack/utils/getCompositeKey';
import { assertDevScope, getRegionLocale, getState } from './state';

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
  new (
    locale?: string,
    options?: IntlDurationFormatOptions,
  ): IntlDurationFormat;
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
    typeof Intl !== 'undefined' &&
    typeof Intl.RelativeTimeFormat !== 'undefined',
);

const hasListFormat = cachedGetter(
  () => typeof Intl !== 'undefined' && typeof Intl.ListFormat !== 'undefined',
);

const hasDurationFormat = cachedGetter(
  () =>
    typeof Intl !== 'undefined' && typeof Intl.DurationFormat !== 'undefined',
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

export function __num(num: number, options?: Intl.NumberFormatOptions): string {
  assertDevScope();

  const regionLocale = getRegionLocale();
  const cacheKey = `${regionLocale}:${getCacheKey(options)}`;

  let formatter = intlCache.number.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(regionLocale, options);
    intlCache.number.set(cacheKey, formatter);
  }

  return formatter.format(num);
}

// Thresholds in seconds
const MINUTE_SECS = 60;
const HOUR_SECS = 60 * 60;
const DAY_SECS = 24 * HOUR_SECS;
const MONTH_SECS = 30 * DAY_SECS;
const YEAR_SECS = 365 * DAY_SECS;

function getUnit(
  from: Date | string | number | undefined,
  to: Date | string | number | undefined,
): { value: number; unit: RelativeTimeUnits } {
  const fromDate = toDate(from ?? new Date());
  const toDate_ = toDate(to ?? new Date());

  const diffMs = fromDate.getTime() - toDate_.getTime();
  const absDiffSecs = Math.abs(diffMs / 1000);
  const isNegative = diffMs < 0;

  const applySign = (val: number) => (isNegative ? -val : val);

  // 0...55 secs → seconds
  if (absDiffSecs < 55) {
    return { value: applySign(Math.round(absDiffSecs)), unit: 'second' };
  }
  // 55 secs...1m 55s → 1 minute
  if (absDiffSecs < MINUTE_SECS + 55) {
    return { value: applySign(1), unit: 'minute' };
  }
  // 1m 30s...44m 30s → [2..44] minutes (floor, but round if >= 55s past minute)
  if (absDiffSecs < 44 * MINUTE_SECS + 30) {
    const minutes = absDiffSecs / MINUTE_SECS;
    const secondsPastMinute = absDiffSecs % MINUTE_SECS;
    const roundedMinutes =
      secondsPastMinute >= 55 ? Math.ceil(minutes) : Math.floor(minutes);
    return {
      value: applySign(roundedMinutes),
      unit: 'minute',
    };
  }
  // 44m 30s...89m 30s → 1 hour
  if (absDiffSecs < 89 * MINUTE_SECS + 30) {
    return { value: applySign(1), unit: 'hour' };
  }
  // 89m 30s...23h 59m 30s → [2..24] hours (floor, but round if >= X hours 55 min)
  if (absDiffSecs < 24 * HOUR_SECS - 30) {
    const hours = absDiffSecs / HOUR_SECS;
    const minutesPastHour = (absDiffSecs % HOUR_SECS) / 60;
    const roundedHours =
      minutesPastHour >= 55 ? Math.ceil(hours) : Math.floor(hours);
    return {
      value: applySign(roundedHours),
      unit: 'hour',
    };
  }
  // 23h 59m 30s...41h 59m 30s → 1 day
  if (absDiffSecs < 42 * HOUR_SECS - 30) {
    return { value: applySign(1), unit: 'day' };
  }
  // 41h 59m 30s...29d 23h 59m 30s → [2..30] days (floor, but round if >= 22h past day)
  if (absDiffSecs < 30 * DAY_SECS - 30) {
    const days = absDiffSecs / DAY_SECS;
    const hoursPastDay = (absDiffSecs % DAY_SECS) / HOUR_SECS;
    const roundedDays = hoursPastDay >= 22 ? Math.ceil(days) : Math.floor(days);
    return { value: applySign(roundedDays), unit: 'day' };
  }
  // 29d 23h 59m 30s...44d 23h 59m 30s → 1 month
  if (absDiffSecs < 45 * DAY_SECS - 30) {
    return { value: applySign(1), unit: 'month' };
  }
  // 44d 23h 59m 30s...59d 23h 59m 30s → 2 months
  if (absDiffSecs < 60 * DAY_SECS - 30) {
    return { value: applySign(2), unit: 'month' };
  }
  // 59d 23h 59m 30s...1yr → [2..12] months (floor, but round if >= 25 days past month)
  if (absDiffSecs < YEAR_SECS - 30) {
    const months = absDiffSecs / MONTH_SECS;
    const daysPastMonth = (absDiffSecs % MONTH_SECS) / DAY_SECS;
    const roundedMonths =
      daysPastMonth >= 25 ? Math.ceil(months) : Math.floor(months);
    return {
      value: applySign(roundedMonths),
      unit: 'month',
    };
  }
  // Years (floor, but round if >= 11 months past year)
  const years = absDiffSecs / YEAR_SECS;
  const monthsPastYear = (absDiffSecs % YEAR_SECS) / MONTH_SECS;
  const roundedYears =
    monthsPastYear >= 11 ? Math.ceil(years) : Math.floor(years);
  return { value: applySign(roundedYears), unit: 'year' };
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
    return formatRelativeFallback(
      diff,
      formatUnit as RelativeTimeUnits,
      format,
    );
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
    value.ms !== undefined ?
      getUnit(new Date(msBaseTime + value.ms), new Date(msBaseTime))
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

  const durationObjToUse: PartialRecord<DurationUnit, number> =
    maxUnitsToShow ? {} : durationObj;

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
