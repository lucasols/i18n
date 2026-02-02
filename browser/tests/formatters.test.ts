import { beforeEach, expect, test } from 'vitest';
import {
  __currency,
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

beforeEach(() => {
  resetState();
});

test('__date formats dates', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
        currencyCode: 'USD',
      },
    ],
  });
  await controller.setLocale('en');

  const date = new Date('2024-01-15T12:00:00Z');
  const formatted = __date(date, { dateStyle: 'short' });
  expect(formatted).toMatch(/1\/15\/24/);
});

test('__date accepts string input', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __date('2024-01-15', { dateStyle: 'short' });
  expect(formatted).toMatch(/1\/15\/24/);
});

test('__date returns Invalid Date for invalid input', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __date('not-a-date');
  expect(formatted).toBe('Invalid Date');
});

test('__num formats numbers', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __num(1234.56);
  expect(formatted).toBe('1,234.56');
});

test('__num returns empty string for null', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __num(null);
  expect(formatted).toBe('');
});

test('__currency formats currency', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
        currencyCode: 'USD',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __currency(1234.56);
  expect(formatted).toMatch(/\$1,234\.56/);
});

test('__relativeTime formats relative time with object API', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const yesterday = new Date('2024-01-14T12:00:00Z');
  const formatted = __relativeTime({ from: yesterday, to: now }, 'day');
  expect(formatted).toBe('1 day ago');
});

test('__relativeTime with auto unit detection', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const fiveMinutesAgo = new Date('2024-01-15T11:55:00Z');
  const formatted = __relativeTime({ from: fiveMinutesAgo, to: now }, 'auto');
  expect(formatted).toBe('5 minutes ago');
});

test('__relativeTimeFromNow formats relative time', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const now = new Date('2024-01-15T12:00:00Z');
  const yesterday = new Date('2024-01-14T12:00:00Z');
  const formatted = __relativeTimeFromNow(yesterday, { now, unit: 'day' });
  expect(formatted).toBe('1 day ago');
});

test('__relativeTimeFromNow uses date format for long diffs', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
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
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __list(['apple', 'banana', 'cherry']);
  expect(formatted).toBe('apple, banana, and cherry');
});

test('__timeDuration returns formatted duration with unit', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const result = __timeDuration({ ms: 3600000 });
  expect(result.unit).toBe('hour');
  expect(result.formatted).toMatch(/1.*hour/);
});

test('__formattedTimeDuration formats duration object', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __formattedTimeDuration({
    hours: 1,
    minutes: 30,
    seconds: 45,
  });
  expect(formatted).toBeTruthy();
});

test('__formattedTimeDuration with maxUnitsToShow', async () => {
  const controller = createTestController({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __formattedTimeDuration(
    { hours: 1, minutes: 30, seconds: 45 },
    { maxUnitsToShow: 2 },
  );
  expect(formatted).toBeTruthy();
});
