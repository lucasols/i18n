import { beforeEach, expect, test } from 'vitest';
import {
  __currency,
  __date,
  __formattedTimeDuration,
  __list,
  __num,
  __relativeTime,
  i18nitialize,
  resetState,
} from '../src/main';

beforeEach(() => {
  resetState();
});

test('__date formats dates', async () => {
  const controller = i18nitialize({
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

test('__num formats numbers', async () => {
  const controller = i18nitialize({
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

test('__currency formats currency', async () => {
  const controller = i18nitialize({
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

test('__relativeTime formats relative time', async () => {
  const controller = i18nitialize({
    locales: [
      {
        id: 'en',
        loader: () => Promise.resolve({ default: {} }),
        regionLocale: 'en-US',
      },
    ],
  });
  await controller.setLocale('en');

  const formatted = __relativeTime(-1, 'day');
  expect(formatted).toBe('1 day ago');
});

test('__list formats lists', async () => {
  const controller = i18nitialize({
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

test('__formattedTimeDuration formats duration', () => {
  const duration = 3661000; // 1 hour, 1 minute, 1 second
  const formatted = __formattedTimeDuration(duration);
  expect(formatted).toBe('01:01:01');
});

test('__formattedTimeDuration with days', () => {
  const duration = 90061000; // 1 day, 1 hour, 1 minute, 1 second
  const formatted = __formattedTimeDuration(duration);
  expect(formatted).toBe('1d 01:01:01');
});
