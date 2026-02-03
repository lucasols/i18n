/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { resetState } from '../src/main';
import { configure, findBestMatchingLocale } from '../src/state';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
  vi.useRealTimers();
  localStorage.clear();
});

function setupLocalesConfig(localeIds: string[]) {
  configure({
    locales: localeIds.map((id) => ({
      id,
      loader: () => Promise.resolve({ default: {} }),
    })),
    persistenceKey: 'test',
    fallbackLocale: localeIds[0] ?? null,
  });
}

function getMatchingLocale({
  navigatorLanguages,
  configLocales,
}: {
  navigatorLanguages: string[] | undefined;
  configLocales: string[];
}): string | null {
  vi.stubGlobal('navigator', navigatorLanguages ? { languages: navigatorLanguages } : undefined);
  setupLocalesConfig(configLocales);
  return findBestMatchingLocale();
}

describe('findBestMatchingLocale', () => {
  test('exact match returns the matching locale', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en-US', 'en'],
      configLocales: ['en-US', 'pt-BR'],
    });
    expect(result).toBe('en-US');
  });

  test('browser regional matches our base locale', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en-GB'],
      configLocales: ['en', 'pt'],
    });
    expect(result).toBe('en');
  });

  test('browser base matches our regional locale', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en'],
      configLocales: ['en-US', 'pt-BR'],
    });
    expect(result).toBe('en-US');
  });

  test('browser regional matches our regional with same base', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en-GB'],
      configLocales: ['en-US', 'pt-BR'],
    });
    expect(result).toBe('en-US');
  });

  test('respects priority order of navigator.languages', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['fr-FR', 'en-US', 'pt-BR'],
      configLocales: ['en-US', 'pt-BR', 'fr'],
    });
    expect(result).toBe('fr');
  });

  test('returns null when no match found', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['zh-CN', 'ja-JP'],
      configLocales: ['en-US', 'pt-BR'],
    });
    expect(result).toBe(null);
  });

  test('returns null when navigator is undefined', () => {
    const result = getMatchingLocale({
      navigatorLanguages: undefined,
      configLocales: ['en-US', 'pt-BR'],
    });
    expect(result).toBe(null);
  });

  test('returns null when navigator.languages is undefined', () => {
    vi.stubGlobal('navigator', {});
    setupLocalesConfig(['en-US', 'pt-BR']);
    expect(findBestMatchingLocale()).toBe(null);
  });
});

describe('setLocale("auto")', () => {
  test('loads best matching locale', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'en-US'] });

    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: 'en-US',
    });

    void controller.setLocale('auto');
    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('pt-BR');
    expect(controller.invokedLoaderIds).toEqual(['en-US', 'pt-BR']);
  });

  test('falls back when no match', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['zh-CN', 'ja-JP'] });

    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: 'en-US',
      persistenceKey: 'test-auto-fallback',
    });

    void controller.setLocale('auto');
    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en-US');
    expect(controller.invokedLoaderIds).toEqual(['en-US']);
  });

  test('setLocale auto uses resolved fallback when no browser match', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });

    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: 'en-US',
      persistenceKey: 'test-auto-uses-fallback',
    });

    void controller.setLocale('auto');
    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en-US');
    expect(controller.invokedLoaderIds).toEqual(['en-US']);
  });
});

describe('fallbackLocale tuple ["auto", T]', () => {
  test('auto-detects locale on initialization when match found', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'en-US'] });

    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: ['auto', 'en-US'],
      persistenceKey: 'test-auto-init',
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('pt-BR');
    expect(controller.invokedLoaderIds).toEqual(['pt-BR']);
  });

  test('uses explicit fallback when no match found', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['zh-CN', 'ja-JP'] });

    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: ['auto', 'en-US'],
      persistenceKey: 'test-auto-explicit-fallback',
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en-US');
    expect(controller.invokedLoaderIds).toEqual(['en-US']);
  });

  test('persisted locale takes precedence over auto fallback', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'en-US'] });

    localStorage.setItem('test-persisted-precedence', 'en-US');

    const controller = createTestController({
      locales: { 'en-US': {}, 'pt-BR': {} },
      fallbackLocale: ['auto', 'pt-BR'],
      persistenceKey: 'test-persisted-precedence',
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getLoadedLocale()).toBe('en-US');
    expect(controller.invokedLoaderIds).toEqual(['en-US']);
  });
});

describe('matching priority', () => {
  test('priority 1: exact match takes precedence', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en-US'],
      configLocales: ['en', 'en-US', 'en-GB'],
    });
    expect(result).toBe('en-US');
  });

  test('priority 2: browser regional to our base takes precedence over browser base to our regional', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en-GB'],
      configLocales: ['en', 'en-US'],
    });
    expect(result).toBe('en');
  });

  test('priority 3: browser base matches our regional when no exact or base match', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['en'],
      configLocales: ['fr', 'en-US', 'pt-BR'],
    });
    expect(result).toBe('en-US');
  });

  test('first matching locale in navigator.languages wins', () => {
    const result = getMatchingLocale({
      navigatorLanguages: ['de-DE', 'fr-FR', 'en-US'],
      configLocales: ['en-US', 'fr', 'de'],
    });
    expect(result).toBe('de');
  });
});
