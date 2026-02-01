import { getActiveLocaleConfig } from './state';

function getRegionLocale(): string {
  const config = getActiveLocaleConfig();
  return config?.regionLocale ?? config?.id ?? 'en-US';
}

export function __date(
  date: Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const regionLocale = getRegionLocale();

  return new Intl.DateTimeFormat(regionLocale, options).format(date);
}

export function __num(
  num: number,
  options?: Intl.NumberFormatOptions,
): string {
  const regionLocale = getRegionLocale();

  return new Intl.NumberFormat(regionLocale, options).format(num);
}

export function __currency(
  num: number,
  currencyCode?: string,
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>,
): string {
  const regionLocale = getRegionLocale();
  const config = getActiveLocaleConfig();
  const currency = currencyCode ?? config?.currencyCode ?? 'USD';

  return new Intl.NumberFormat(regionLocale, {
    style: 'currency',
    currency,
    ...options,
  }).format(num);
}

export function __relativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  const regionLocale = getRegionLocale();

  return new Intl.RelativeTimeFormat(regionLocale, options).format(value, unit);
}

type TimeUnit = {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
};

const TIME_UNITS: TimeUnit[] = [
  { value: 60, unit: 'second' },
  { value: 60, unit: 'minute' },
  { value: 24, unit: 'hour' },
  { value: 7, unit: 'day' },
  { value: 4.34524, unit: 'week' },
  { value: 12, unit: 'month' },
  { value: Infinity, unit: 'year' },
];

export function __relativeTimeFromNow(
  date: Date | number,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  const now = Date.now();
  const timestamp = typeof date === 'number' ? date : date.getTime();
  let diff = (timestamp - now) / 1000;

  for (const { value, unit } of TIME_UNITS) {
    if (Math.abs(diff) < value) {
      return __relativeTime(Math.round(diff), unit, options);
    }
    diff /= value;
  }

  return __relativeTime(Math.round(diff), 'year', options);
}

type ListFormatOptions = {
  type?: 'conjunction' | 'disjunction' | 'unit';
  style?: 'long' | 'short' | 'narrow';
  localeMatcher?: 'lookup' | 'best fit';
};

export function __list(items: string[], options?: ListFormatOptions): string {
  const regionLocale = getRegionLocale();
  const ListFormat = Intl.ListFormat as
    | (new (
        locales?: string | string[],
        options?: ListFormatOptions,
      ) => { format(list: string[]): string })
    | undefined;

  if (!ListFormat) {
    const separator = options?.type === 'disjunction' ? ' or ' : ', ';
    return items.join(separator);
  }

  return new ListFormat(regionLocale, options).format(items);
}

type DurationComponents = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

export function __formattedTimeDuration(
  durationMs: number,
  options?: {
    showSeconds?: boolean;
    showDays?: boolean;
    padWithZeros?: boolean;
  },
): string {
  const {
    showSeconds = true,
    showDays = true,
    padWithZeros = true,
  } = options ?? {};

  const totalSeconds = Math.floor(durationMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  const components: DurationComponents = {};

  if (showDays && totalDays > 0) {
    components.days = totalDays;
    components.hours = totalHours % 24;
  } else {
    components.hours = totalHours;
  }

  components.minutes = totalMinutes % 60;

  if (showSeconds) {
    components.seconds = totalSeconds % 60;
  }

  const pad = (n: number) => (padWithZeros ? String(n).padStart(2, '0') : String(n));

  const parts: string[] = [];

  if (components.days !== undefined && components.days > 0) {
    parts.push(`${components.days}d`);
  }

  if (parts.length > 0 || components.hours > 0) {
    parts.push(pad(components.hours));
  }

  parts.push(pad(components.minutes));

  if (components.seconds !== undefined) {
    parts.push(pad(components.seconds));
  }

  if (parts.length === 0) {
    return showSeconds ? '0:00' : '0:00';
  }

  if (components.days !== undefined && components.days > 0) {
    return `${parts[0]} ${parts.slice(1).join(':')}`;
  }

  return parts.join(':');
}
