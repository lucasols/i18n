import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  __date,
  __formattedTimeDuration,
  __list,
  __num,
  __relativeTime,
  __relativeTimeFromNow,
  __timeDuration,
  resetState,
} from '../src/main';
import { createTestController } from './test-utils';

const getDurationFormatter = (
  locale: string,
  style: 'narrow' | 'short' | 'long',
) => {
  if (!Intl.DurationFormat) {
    throw new Error('Intl.DurationFormat is not available in this environment');
  }
  return new Intl.DurationFormat(locale, { style });
};

beforeEach(() => {
  resetState();
  vi.stubGlobal('navigator', { languages: ['en-US'] });
});

describe('__date', () => {
  test('formats dates', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = __date(date, { dateStyle: 'short' });
    expect(formatted).toMatch(/1\/15\/24/);
  });

  test('accepts string input', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __date('2024-01-15', { dateStyle: 'short' });
    expect(formatted).toMatch(/1\/15\/24/);
  });

  test('date-only strings are parsed as local midnight, not UTC', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    // Without the T00:00 fix, "2024-01-15" would be parsed as UTC midnight,
    // resulting in a non-midnight local time in any non-UTC timezone.
    // This test verifies the time is 00:00 (local midnight).
    const formatted = __date('2024-01-15', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // en-US uses 12-hour format, so midnight is "12:00 AM"
    expect(formatted).toBe('12:00 AM');
  });

  test('returns Invalid Date for invalid input', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __date('not-a-date');
    expect(formatted).toBe('Invalid Date');
  });
});

describe('__num', () => {
  test('formats numbers', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __num(1234.56);
    expect(formatted).toBe('1,234.56');
  });
});

describe('__relativeTime', () => {
  test('formats relative time with object API', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const yesterday = new Date('2024-01-14T12:00:00Z');
    const formatted = __relativeTime({ from: yesterday, to: now }, 'day');
    expect(formatted).toBe('1 day ago');
  });

  test('auto unit detection', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const fiveMinutesAgo = new Date('2024-01-15T11:55:00Z');
    const formatted = __relativeTime({ from: fiveMinutesAgo, to: now }, 'auto');
    expect(formatted).toBe('5 minutes ago');
  });
});

describe('__relativeTimeFromNow', () => {
  test('formats relative time', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const yesterday = new Date('2024-01-14T12:00:00Z');
    const formatted = __relativeTimeFromNow(yesterday, { now, unit: 'day' });
    expect(formatted).toBe('1 day ago');
  });

  test('returns 1 second ago when no diffs', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    expect(__relativeTimeFromNow(now, { now })).toBe('1 second ago');
  });

  test('formats future diffs', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const tomorrow = new Date('2024-01-16T12:00:00Z');
    expect(__relativeTimeFromNow(tomorrow, { now })).toBe('in 1 day');
  });

  test('uses date format for long diffs', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const now = new Date('2024-01-15T12:00:00Z');
    const twoWeeksAgo = new Date('2024-01-01T12:00:00Z');
    const formatted = __relativeTimeFromNow(twoWeeksAgo, {
      now,
      useDateForLongerDiffs: { dateStyle: 'short' },
      longDiffDaysThreshold: 7,
    });
    expect(formatted).toMatch(/1\/1\/24/);
  });
});

describe('__relativeTimeFromNow rounding thresholds', () => {
  const setup = async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');
    return new Date('2024-01-15T12:00:00Z');
  };

  const addSeconds = (date: Date, seconds: number) =>
    new Date(date.getTime() - seconds * 1000);

  describe('seconds threshold (0...55 secs)', () => {
    test('29 seconds shows as seconds', async () => {
      const now = await setup();
      const date = addSeconds(now, 29);
      expect(__relativeTimeFromNow(date, { now })).toBe('29 seconds ago');
    });

    test('54 seconds shows as seconds', async () => {
      const now = await setup();
      const date = addSeconds(now, 54);
      expect(__relativeTimeFromNow(date, { now })).toBe('54 seconds ago');
    });

    test('55 seconds shows as 1 minute', async () => {
      const now = await setup();
      const date = addSeconds(now, 55);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 minute ago');
    });
  });

  describe('1 minute threshold (55 secs...1m 55s)', () => {
    test('56 seconds shows as 1 minute', async () => {
      const now = await setup();
      const date = addSeconds(now, 56);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 minute ago');
    });

    test('114 seconds shows as 1 minute', async () => {
      const now = await setup();
      const date = addSeconds(now, 114);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 minute ago');
    });

    test('115 seconds shows as 2 minutes (rounds at >= 55s past minute)', async () => {
      const now = await setup();
      const date = addSeconds(now, 115);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 minutes ago');
    });

    test('120 seconds shows as 2 minutes', async () => {
      const now = await setup();
      const date = addSeconds(now, 120);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 minutes ago');
    });
  });

  describe('minutes threshold (1m 30s...44m 30s)', () => {
    test('44 minutes shows as 44 minutes', async () => {
      const now = await setup();
      const date = addSeconds(now, 44 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('44 minutes ago');
    });

    test('44 minutes 30 seconds shows as 44 minutes', async () => {
      const now = await setup();
      const date = addSeconds(now, 44 * 60 + 29);
      expect(__relativeTimeFromNow(date, { now })).toBe('44 minutes ago');
    });

    test('44 minutes 31 seconds shows as 1 hour', async () => {
      const now = await setup();
      const date = addSeconds(now, 44 * 60 + 31);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
    });
  });

  describe('1 hour threshold (44m 30s...89m 30s)', () => {
    test('45 minutes shows as 1 hour', async () => {
      const now = await setup();
      const date = addSeconds(now, 45 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
    });

    test('89 minutes shows as 1 hour', async () => {
      const now = await setup();
      const date = addSeconds(now, 89 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
    });

    test('90 minutes shows as 1 hour (floor)', async () => {
      const now = await setup();
      const date = addSeconds(now, 90 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
    });

    test('114 minutes shows as 1 hour (floor, < 55 min past hour)', async () => {
      const now = await setup();
      const date = addSeconds(now, 114 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 hour ago');
    });

    test('115 minutes shows as 2 hours (rounds at >= 55 min past hour)', async () => {
      const now = await setup();
      const date = addSeconds(now, 115 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 hours ago');
    });

    test('120 minutes shows as 2 hours', async () => {
      const now = await setup();
      const date = addSeconds(now, 120 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 hours ago');
    });
  });

  describe('hours threshold (89m 30s...23h 59m 30s)', () => {
    test('23 hours shows as 23 hours', async () => {
      const now = await setup();
      const date = addSeconds(now, 23 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('23 hours ago');
    });

    test('23 hours 54 minutes shows as 23 hours (floor)', async () => {
      const now = await setup();
      const date = addSeconds(now, 23 * 60 * 60 + 54 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('23 hours ago');
    });

    test('23 hours 55 minutes shows as 24 hours (rounds at >= 55 min)', async () => {
      const now = await setup();
      const date = addSeconds(now, 23 * 60 * 60 + 55 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('24 hours ago');
    });

    test('23 hours 59 minutes 30 seconds shows as 1 day', async () => {
      const now = await setup();
      const date = addSeconds(now, 23 * 60 * 60 + 59 * 60 + 30);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });
  });

  describe('1 day threshold (23h 59m 30s...41h 59m 30s) - KEY FIX', () => {
    test('24 hours shows as 1 day', async () => {
      const now = await setup();
      const date = addSeconds(now, 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('25 hours shows as 1 day (not 2 days)', async () => {
      const now = await setup();
      const date = addSeconds(now, 25 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('36 hours shows as 1 day (not 2 days)', async () => {
      const now = await setup();
      const date = addSeconds(now, 36 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('40 hours shows as 1 day (not 2 days)', async () => {
      const now = await setup();
      const date = addSeconds(now, 40 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('41 hours 59 minutes shows as 1 day', async () => {
      const now = await setup();
      const date = addSeconds(now, 41 * 60 * 60 + 59 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('42 hours shows as 1 day (floor, 18h past day < 22h threshold)', async () => {
      const now = await setup();
      const date = addSeconds(now, 42 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });
  });

  describe('days threshold (41h 59m 30s...29d 23h 59m 30s)', () => {
    test('43 hours shows as 1 day (floor, < 22h past day)', async () => {
      const now = await setup();
      const date = addSeconds(now, 43 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('45 hours shows as 1 day (floor, < 22h past day)', async () => {
      const now = await setup();
      const date = addSeconds(now, 45 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 day ago');
    });

    test('46 hours shows as 2 days (rounds at >= 22h past day)', async () => {
      const now = await setup();
      const date = addSeconds(now, 46 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 days ago');
    });

    test('48 hours shows as 2 days', async () => {
      const now = await setup();
      const date = addSeconds(now, 48 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 days ago');
    });

    test('29 days shows as 29 days', async () => {
      const now = await setup();
      const date = addSeconds(now, 29 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('29 days ago');
    });

    test('30 days shows as 1 month', async () => {
      const now = await setup();
      const date = addSeconds(now, 30 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 month ago');
    });
  });

  describe('1 month threshold (29d 23h 59m 30s...44d 23h 59m 30s)', () => {
    test('44 days shows as 1 month', async () => {
      const now = await setup();
      const date = addSeconds(now, 44 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 month ago');
    });

    test('45 days shows as 2 months', async () => {
      const now = await setup();
      const date = addSeconds(now, 45 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 months ago');
    });
  });

  describe('2 months threshold (44d 23h 59m 30s...59d 23h 59m 30s)', () => {
    test('59 days shows as 2 months', async () => {
      const now = await setup();
      const date = addSeconds(now, 59 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 months ago');
    });

    test('60 days shows as 2 months (calculated)', async () => {
      const now = await setup();
      const date = addSeconds(now, 60 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 months ago');
    });
  });

  describe('months threshold (59d 23h 59m 30s...~1yr)', () => {
    test('90 days shows as 3 months (floor)', async () => {
      const now = await setup();
      const date = addSeconds(now, 90 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('3 months ago');
    });

    test('114 days shows as 3 months (floor, < 25 days past month)', async () => {
      const now = await setup();
      const date = addSeconds(now, 114 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('3 months ago');
    });

    test('115 days shows as 4 months (rounds at >= 25 days past month)', async () => {
      const now = await setup();
      const date = addSeconds(now, 115 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('4 months ago');
    });

    test('180 days shows as 6 months', async () => {
      const now = await setup();
      const date = addSeconds(now, 180 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('6 months ago');
    });

    test('364 days shows as 12 months', async () => {
      const now = await setup();
      const date = addSeconds(now, 364 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('12 months ago');
    });
  });

  describe('years threshold', () => {
    test('365 days shows as 1 year', async () => {
      const now = await setup();
      const date = addSeconds(now, 365 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 year ago');
    });

    test('1 year + 10 months shows as 1 year (floor)', async () => {
      const now = await setup();
      const date = addSeconds(now, (365 + 300) * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('1 year ago');
    });

    test('1 year + 11 months shows as 2 years (rounds at >= 11 months)', async () => {
      const now = await setup();
      const date = addSeconds(now, (365 + 330) * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 years ago');
    });

    test('730 days shows as 2 years', async () => {
      const now = await setup();
      const date = addSeconds(now, 730 * 24 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('2 years ago');
    });
  });

  describe('future times with thresholds', () => {
    const addSecondsFuture = (date: Date, seconds: number) =>
      new Date(date.getTime() + seconds * 1000);

    test('25 hours in future shows as in 1 day (not in 2 days)', async () => {
      const now = await setup();
      const date = addSecondsFuture(now, 25 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('in 1 day');
    });

    test('36 hours in future shows as in 1 day', async () => {
      const now = await setup();
      const date = addSecondsFuture(now, 36 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('in 1 day');
    });

    test('42 hours in future shows as in 1 day (floor)', async () => {
      const now = await setup();
      const date = addSecondsFuture(now, 42 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('in 1 day');
    });

    test('46 hours in future shows as in 2 days (rounds at >= 22h)', async () => {
      const now = await setup();
      const date = addSecondsFuture(now, 46 * 60 * 60);
      expect(__relativeTimeFromNow(date, { now })).toBe('in 2 days');
    });
  });
});

describe('__list', () => {
  test('formats lists', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __list(['apple', 'banana', 'cherry']);
    expect(formatted).toBe('apple, banana, and cherry');
  });

  test('formats lists with disjunction', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __list(['red', 'green', 'blue'], { type: 'disjunction' });
    expect(formatted).toBe('red, green, or blue');
  });

  test('returns empty string for empty list', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    expect(__list([])).toBe('');
  });
});

describe('__timeDuration', () => {
  test('returns formatted duration with unit', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const result = __timeDuration({ ms: 3600000 });
    expect(result.unit).toBe('hour');
    expect(result.formatted).toMatch(/1.*hour/);
  });
});

describe('__formattedTimeDuration', () => {
  test('formats duration with hours', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration({
      hours: 2,
      minutes: 30,
      seconds: 45,
    });
    const expected = getDurationFormatter('en-US', 'narrow').format({
      hours: 2,
      minutes: 30,
      seconds: 45,
    });
    expect(formatted).toBe(expected);
  });

  test('formats duration with minutes only', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration({ minutes: 5, seconds: 20 });
    const expected = getDurationFormatter('en-US', 'narrow').format({
      minutes: 5,
      seconds: 20,
    });
    expect(formatted).toBe(expected);
  });

  test('formats duration with seconds only', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formatted = __formattedTimeDuration({ seconds: 45 });
    const expected = getDurationFormatter('en-US', 'narrow').format({
      seconds: 45,
    });
    expect(formatted).toBe(expected);
  });

  test('with maxUnitsToShow', async () => {
    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    const formattedOneUnit = __formattedTimeDuration(
      { hours: 2, minutes: 30, seconds: 45 },
      { maxUnitsToShow: 1 },
    );

    const formattedTwoUnits = __formattedTimeDuration(
      { hours: 2, minutes: 30, seconds: 45 },
      { maxUnitsToShow: 2 },
    );

    const formattedDays = __formattedTimeDuration(
      { days: 3, minutes: 30, seconds: 45 },
      { maxUnitsToShow: 2 },
    );

    const expectedOneUnit = getDurationFormatter('en-US', 'narrow').format({
      hours: 2,
    });
    const expectedTwoUnits = getDurationFormatter('en-US', 'narrow').format({
      hours: 2,
      minutes: 30,
    });
    const expectedDays = getDurationFormatter('en-US', 'narrow').format({
      days: 3,
      minutes: 30,
    });

    expect(formattedOneUnit).toBe(expectedOneUnit);
    expect(formattedTwoUnits).toBe(expectedTwoUnits);
    expect(formattedDays).toBe(expectedDays);
  });

  test('pt-BR narrow formatting', async () => {
    const controller = createTestController({
      locales: { 'pt-BR': {} },
    });
    await controller.setLocale('pt-BR');

    expect(__formattedTimeDuration({ months: 1, days: 1 })).toBe('1m 1d');

    expect(
      __formattedTimeDuration({
        months: 1,
        hours: 2,
        minutes: 30,
        seconds: 45,
        milliseconds: 100,
        years: 1,
        days: 1,
      }),
    ).toBe('1ano 1m 1d 2h 30min 45s 100ms');

    expect(
      __formattedTimeDuration({
        months: 10,
        hours: 1,
        minutes: 1,
        seconds: 1,
        milliseconds: 1,
        years: 8,
        days: 8,
      }),
    ).toBe('8a 10m 8d 1h 1min 1s 1ms');

    expect(
      __formattedTimeDuration(
        { hours: 2, minutes: 30, seconds: 45 },
        { maxUnitsToShow: 1 },
      ),
    ).toBe('2h');

    expect(
      __formattedTimeDuration(
        { hours: 2, minutes: 30, seconds: 45 },
        { maxUnitsToShow: 2 },
      ),
    ).toBe('2h 30min');

    expect(
      __formattedTimeDuration(
        { days: 3, minutes: 30, seconds: 45 },
        { maxUnitsToShow: 2 },
      ),
    ).toBe('3d 30min');
  });

  test('pt-BR long formatting', async () => {
    const controller = createTestController({
      locales: { 'pt-BR': {} },
    });
    await controller.setLocale('pt-BR');

    const formatted = __formattedTimeDuration(
      { days: 3, minutes: 30, seconds: 45 },
      { style: 'long', maxUnitsToShow: 2 },
    );

    const expected = getDurationFormatter('pt-BR', 'long').format({
      days: 3,
      minutes: 30,
    });
    expect(formatted).toBe(expected);
  });
});
