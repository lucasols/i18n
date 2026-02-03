import { beforeEach, expect, test, vi } from 'vitest';
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

test('__date formats dates', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const date = new Date('2024-01-15T12:00:00Z');
  const formatted = __date(date, { dateStyle: 'short' });
  expect(formatted).toMatch(/1\/15\/24/);
});

test('__date accepts string input', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const formatted = __date('2024-01-15', { dateStyle: 'short' });
  expect(formatted).toMatch(/1\/15\/24/);
});

test('__date returns Invalid Date for invalid input', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const formatted = __date('not-a-date');
  expect(formatted).toBe('Invalid Date');
});

test('__num formats numbers', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const formatted = __num(1234.56);
  expect(formatted).toBe('1,234.56');
});

test('__num returns empty string for null', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const formatted = __num(null);
  expect(formatted).toBe('');
});

test('__relativeTime formats relative time with object API', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const yesterday = new Date('2024-01-14T12:00:00Z');
  const formatted = __relativeTime({ from: yesterday, to: now }, 'day');
  expect(formatted).toBe('1 day ago');
});

test('__relativeTime with auto unit detection', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const fiveMinutesAgo = new Date('2024-01-15T11:55:00Z');
  const formatted = __relativeTime({ from: fiveMinutesAgo, to: now }, 'auto');
  expect(formatted).toBe('5 minutes ago');
});

test('__relativeTimeFromNow formats relative time', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const yesterday = new Date('2024-01-14T12:00:00Z');
  const formatted = __relativeTimeFromNow(yesterday, { now, unit: 'day' });
  expect(formatted).toBe('1 day ago');
});

test('__relativeTimeFromNow returns 1 second ago when no diffs', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  expect(__relativeTimeFromNow(now, { now })).toBe('1 second ago');
});

test('__relativeTimeFromNow formats future diffs', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const tomorrow = new Date('2024-01-16T12:00:00Z');
  expect(__relativeTimeFromNow(tomorrow, { now })).toBe('in 1 day');
});

test('__relativeTimeFromNow uses date format for long diffs', async () => {
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

test('__list formats lists', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const formatted = __list(['apple', 'banana', 'cherry']);
  expect(formatted).toBe('apple, banana, and cherry');
});

test('__list formats lists with disjunction', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const formatted = __list(['red', 'green', 'blue'], { type: 'disjunction' });
  expect(formatted).toBe('red, green, or blue');
});

test('__list returns empty string for empty list', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  expect(__list([])).toBe('');
});

test('__timeDuration returns formatted duration with unit', async () => {
  const controller = createTestController({
    locales: { en: {} },
  });
  await controller.setLocale('en');

  const result = __timeDuration({ ms: 3600000 });
  expect(result.unit).toBe('hour');
  expect(result.formatted).toMatch(/1.*hour/);
});

test('__formattedTimeDuration formats duration with hours', async () => {
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

test('__formattedTimeDuration formats duration with minutes only', async () => {
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

test('__formattedTimeDuration formats duration with seconds only', async () => {
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

test('__formattedTimeDuration with maxUnitsToShow', async () => {
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

test('__formattedTimeDuration pt-BR narrow formatting', async () => {
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

test('__formattedTimeDuration pt-BR long formatting', async () => {
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
