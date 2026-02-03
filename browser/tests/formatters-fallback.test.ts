import { beforeEach, describe, expect, test, vi } from 'vitest';

// Store original Intl APIs
const OriginalIntl = globalThis.Intl;

describe('__relativeTime fallback (no Intl.RelativeTimeFormat)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: ['en-US'] });
    vi.stubGlobal('Intl', {
      ...OriginalIntl,
      RelativeTimeFormat: undefined,
    });
  });

  test('formats past time', async () => {
    const { __relativeTime, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const yesterday = new Date('2024-01-14T12:00:00Z');
    const formatted = __relativeTime({ from: yesterday, to: now }, 'day');
    expect(formatted).toBe('1 day ago');
  });

  test('formats future time', async () => {
    const { __relativeTime, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const tomorrow = new Date('2024-01-16T12:00:00Z');
    const formatted = __relativeTime({ from: tomorrow, to: now }, 'day');
    expect(formatted).toBe('in 1 day');
  });

  test('formats plural units', async () => {
    const { __relativeTime, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const threeDaysAgo = new Date('2024-01-12T12:00:00Z');
    const formatted = __relativeTime({ from: threeDaysAgo, to: now }, 'day');
    expect(formatted).toBe('3 days ago');
  });

  test('formats "now" with numeric auto and zeroFallback=0', async () => {
    const { __relativeTime, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    // Pass zeroFallback=0 to allow 0 value (otherwise defaults to -1)
    const formatted = __relativeTime(
      { from: now, to: now },
      'second',
      { numeric: 'auto' },
      0,
    );
    expect(formatted).toBe('now');
  });

  test('formats various units', async () => {
    const { __relativeTime, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');

    const twoHoursAgo = new Date('2024-01-15T10:00:00Z');
    expect(__relativeTime({ from: twoHoursAgo, to: now }, 'hour')).toBe(
      '2 hours ago',
    );

    const fiveMinutesAgo = new Date('2024-01-15T11:55:00Z');
    expect(__relativeTime({ from: fiveMinutesAgo, to: now }, 'minute')).toBe(
      '5 minutes ago',
    );

    const oneWeekAgo = new Date('2024-01-08T12:00:00Z');
    expect(__relativeTime({ from: oneWeekAgo, to: now }, 'week')).toBe(
      '1 week ago',
    );
  });
});

describe('__relativeTimeFromNow rounding thresholds fallback (no Intl.RelativeTimeFormat)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: ['en-US'] });
    vi.stubGlobal('Intl', {
      ...OriginalIntl,
      RelativeTimeFormat: undefined,
    });
  });

  const setupTest = async () => {
    const { __relativeTimeFromNow, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');
    const now = new Date('2024-01-15T12:00:00Z');
    return { __relativeTimeFromNow, now };
  };

  const addSeconds = (date: Date, seconds: number) =>
    new Date(date.getTime() - seconds * 1000);

  test('29 seconds shows as 29 seconds ago', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 29);
    expect(__relativeTimeFromNow(date, { now })).toBe('29 seconds ago');
  });

  test('54 seconds shows as 54 seconds ago', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 54);
    expect(__relativeTimeFromNow(date, { now })).toBe('54 seconds ago');
  });

  test('55 seconds shows as 1 minute ago', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 55);
    expect(__relativeTimeFromNow(date, { now })).toBe('1 minute ago');
  });

  test('25 hours shows as 1 day ago (not 2 days)', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 25 * 60 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
  });

  test('36 hours shows as 1 day ago (not 2 days)', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 36 * 60 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
  });

  test('42 hours shows as 1 day ago (floor, 18h past day < 22h threshold)', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 42 * 60 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
  });

  test('46 hours shows as 2 days ago (rounds at >= 22h past day)', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 46 * 60 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('2 days ago');
  });

  test('45 minutes shows as 1 hour ago', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 45 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
  });

  test('90 minutes shows as 1 hour ago (floor)', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 90 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
  });

  test('115 minutes shows as 2 hours ago (rounds at >= 55 min past hour)', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 115 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('2 hours ago');
  });

  test('120 minutes shows as 2 hours ago', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = addSeconds(now, 120 * 60);
    expect(__relativeTimeFromNow(date, { now })).toBe('2 hours ago');
  });

  test('future: 25 hours in future shows as in 1 day', async () => {
    const { __relativeTimeFromNow, now } = await setupTest();
    const date = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    expect(__relativeTimeFromNow(date, { now })).toBe('in 1 day');
  });
});

describe('__list fallback (no Intl.ListFormat)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: ['en-US'] });
    vi.stubGlobal('Intl', {
      ...OriginalIntl,
      ListFormat: undefined,
    });
  });

  test('joins items with comma', async () => {
    const { __list, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const formatted = __list(['apple', 'banana', 'cherry']);
    expect(formatted).toBe('apple, banana, cherry');
  });

  test('handles single item', async () => {
    const { __list, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    expect(__list(['apple'])).toBe('apple');
  });

  test('handles empty list', async () => {
    const { __list, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    expect(__list([])).toBe('');
  });
});

describe('__timeDuration fallback (no unit style support)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: ['en-US'] });

    const MockNumberFormat = function (
      this: Intl.NumberFormat,
      locale?: string,
      options?: Intl.NumberFormatOptions,
    ) {
      if (options?.style === 'unit') {
        throw new Error('Unit style not supported');
      }
      return new OriginalIntl.NumberFormat(locale, options);
    } as unknown as typeof Intl.NumberFormat;

    vi.stubGlobal('Intl', {
      ...OriginalIntl,
      NumberFormat: MockNumberFormat,
    });
  });

  test('formats duration with short labels', async () => {
    const { __timeDuration, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const result = __timeDuration({ ms: 3600000, short: true });
    expect(result.unit).toBe('hour');
    expect(result.formatted).toBe('1 hr');
  });

  test('formats duration with long labels', async () => {
    const { __timeDuration, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const result = __timeDuration({ ms: 3600000 });
    expect(result.unit).toBe('hour');
    expect(result.formatted).toBe('1 hour');
  });

  test('formats plural durations', async () => {
    const { __timeDuration, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const result = __timeDuration({ ms: 7200000 });
    expect(result.unit).toBe('hour');
    expect(result.formatted).toBe('2 hours');
  });

  test('formats minutes', async () => {
    const { __timeDuration, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const result = __timeDuration({ ms: 300000, short: true });
    expect(result.unit).toBe('minute');
    expect(result.formatted).toBe('5 mins');
  });

  test('formats days', async () => {
    const { __timeDuration, resetState } = await import('../src/main');
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const result = __timeDuration({ ms: 86400000 * 3 });
    expect(result.unit).toBe('day');
    expect(result.formatted).toBe('3 days');
  });
});

describe('__formattedTimeDuration fallback (no Intl.DurationFormat)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: ['en-US'] });
    vi.stubGlobal('Intl', {
      ...OriginalIntl,
      DurationFormat: undefined,
    });
  });

  test('formats as time string', async () => {
    const { __formattedTimeDuration, resetState } = await import(
      '../src/main'
    );
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration({
      hours: 2,
      minutes: 30,
      seconds: 45,
    });
    expect(formatted).toBe('00y 00m 00d 02:30:45');
  });

  test('formats with days', async () => {
    const { __formattedTimeDuration, resetState } = await import(
      '../src/main'
    );
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration({
      days: 5,
      hours: 12,
      minutes: 0,
      seconds: 30,
    });
    expect(formatted).toBe('00y 00m 05d 12:00:30');
  });

  test('formats with years and months', async () => {
    const { __formattedTimeDuration, resetState } = await import(
      '../src/main'
    );
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration({
      years: 1,
      months: 6,
      days: 15,
      hours: 8,
      minutes: 45,
      seconds: 30,
    });
    expect(formatted).toBe('01y 06m 15d 08:45:30');
  });

  test('respects maxUnitsToShow', async () => {
    const { __formattedTimeDuration, resetState } = await import(
      '../src/main'
    );
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { en: {} } });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration(
      { hours: 2, minutes: 30, seconds: 45 },
      { maxUnitsToShow: 1 },
    );
    expect(formatted).toBe('00y 00m 00d 02:00:00');
  });

  test('pt-BR narrow still uses custom formatter even without DurationFormat', async () => {
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: ['pt-BR'] });
    vi.stubGlobal('Intl', {
      ...OriginalIntl,
      DurationFormat: undefined,
    });

    const { __formattedTimeDuration, resetState } = await import(
      '../src/main'
    );
    const { createTestController } = await import('./test-utils');
    resetState();

    const controller = createTestController({ locales: { 'pt-BR': {} } });
    await controller.setLocale('pt-BR');

    expect(__formattedTimeDuration({ months: 1, days: 1 })).toBe('1m 1d');
    expect(
      __formattedTimeDuration({ hours: 2, minutes: 30, seconds: 45 }),
    ).toBe('2h 30min 45s');
  });
});
