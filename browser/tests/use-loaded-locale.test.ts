/**
 * @vitest-environment happy-dom
 */
import { createLoggerStore } from '@ls-stack/utils/testUtils';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { __, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
  vi.useRealTimers();
});

test('returns initial loading state', () => {
  vi.useFakeTimers();

  const controller = createTestController({
    locales: { en: {} },
  });

  const logger = createLoggerStore();

  renderHook(() => {
    const state = controller.useLoadedLocale();
    logger.add({
      isLoading: state.isLoading?.locale ?? null,
      loadError: state.loadError,
      loadedLocale: state.loadedLocale,
      translation: __`Hello`,
    });
    return state;
  });

  expect(logger.snapshot).toMatchInlineSnapshot(`
    "
    -> isLoading: en ⋅ loadError: null ⋅ loadedLocale: null ⋅ translation: Hello
    "
  `);
});

test('returns loaded state after successful load', async () => {
  vi.useFakeTimers();

  const controller = createTestController({
    locales: { en: { Hello: 'Hello EN' } },
  });

  const logger = createLoggerStore();

  renderHook(() => {
    const state = controller.useLoadedLocale();
    logger.add({
      isLoading: state.isLoading?.locale ?? null,
      loadError: state.loadError,
      loadedLocale: state.loadedLocale,
      translation: __`Hello`,
    });
    return state;
  });

  await vi.advanceTimersByTimeAsync(100);

  expect(logger.snapshot).toMatchInlineSnapshot(`
    "
    -> isLoading: en ⋅ loadError: null ⋅ loadedLocale: null ⋅ translation: Hello
    -> isLoading: null ⋅ loadError: null ⋅ loadedLocale: en ⋅ translation: Hello EN
    "
  `);
});

test('returns error state on load failure', async () => {
  vi.useFakeTimers();

  const controller = createTestController({
    locales: { en: new Error('Network error') },
    retryAttempts: 1,
    retryDelay: 0,
  });

  const logger = createLoggerStore();

  renderHook(() => {
    const state = controller.useLoadedLocale();
    logger.add({
      isLoading: state.isLoading?.locale ?? null,
      loadedLocale: state.loadedLocale,
      errorMessage: state.loadError?.message ?? null,
      translation: __`Hello`,
    });
    return state;
  });

  // First attempt (100ms) + 1 retry (100ms) = 200ms
  await vi.advanceTimersByTimeAsync(200);

  expect(logger.snapshot).toMatchInlineSnapshot(`
    "
    -> isLoading: en ⋅ loadedLocale: null ⋅ errorMessage: null ⋅ translation: Hello
    ┌─
    ⋅ isLoading: null
    ⋅ loadedLocale: null
    ⋅ errorMessage: Network error
    ⋅ translation: Hello
    └─
    "
  `);
});

test('updates when locale changes', async () => {
  vi.useFakeTimers();

  const controller = createTestController({
    locales: {
      en: { Hello: 'Hello EN' },
      pt: { Hello: 'Olá PT' },
    },
  });

  const logger = createLoggerStore();

  renderHook(() => {
    const state = controller.useLoadedLocale();
    logger.add({
      isLoading: state.isLoading?.locale ?? null,
      loadError: state.loadError,
      loadedLocale: state.loadedLocale,
      translation: __`Hello`,
    });
    return state;
  });

  await vi.advanceTimersByTimeAsync(100);

  await act(async () => {
    const promise = controller.setLocale('pt');
    await vi.advanceTimersByTimeAsync(100);
    await promise;
  });

  expect(logger.snapshot).toMatchInlineSnapshot(`
    "
    -> isLoading: en ⋅ loadError: null ⋅ loadedLocale: null ⋅ translation: Hello
    -> isLoading: null ⋅ loadError: null ⋅ loadedLocale: en ⋅ translation: Hello EN
    -> isLoading: pt ⋅ loadError: null ⋅ loadedLocale: en ⋅ translation: Hello EN
    -> isLoading: null ⋅ loadError: null ⋅ loadedLocale: pt ⋅ translation: Olá PT
    "
  `);
});

test('re-renders during loading transitions', async () => {
  vi.useFakeTimers();

  const controller = createTestController({
    locales: {
      en: { Hello: 'Hello EN' },
      pt: { Hello: 'Olá PT' },
    },
  });

  const logger = createLoggerStore();

  renderHook(() => {
    const state = controller.useLoadedLocale();
    logger.add({
      isLoading: state.isLoading?.locale ?? null,
      loadError: state.loadError,
      loadedLocale: state.loadedLocale,
      translation: __`Hello`,
    });
    return state;
  });

  await vi.advanceTimersByTimeAsync(100);

  logger.addMark('start loading pt');

  act(() => {
    void controller.setLocale('pt');
  });

  logger.addMark('finish loading pt');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });

  expect(logger.snapshot).toMatchInlineSnapshot(`
    "
    -> isLoading: en ⋅ loadError: null ⋅ loadedLocale: null ⋅ translation: Hello
    -> isLoading: null ⋅ loadError: null ⋅ loadedLocale: en ⋅ translation: Hello EN

    >>> start loading pt

    -> isLoading: pt ⋅ loadError: null ⋅ loadedLocale: en ⋅ translation: Hello EN

    >>> finish loading pt

    -> isLoading: null ⋅ loadError: null ⋅ loadedLocale: pt ⋅ translation: Olá PT
    "
  `);
});
