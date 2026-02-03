/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { i18nitialize, resetState } from '../src/main';
import { createTestController } from './test-utils';

beforeEach(() => {
  resetState();
  vi.useRealTimers();
  localStorage.clear();
});

describe('regionLocale inference', () => {
  test('locale with region is used directly without further inference', async () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'en-GB', 'en'],
    });

    const controller = createTestController({
      locales: { 'en-US': {} },
    });

    await controller.setLocale('en-US');

    expect(controller.getRegionLocale()).toBe('en-US');
  });

  test('locale without region finds first matching region from navigator.languages', async () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'en-GB', 'en-US'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en-GB');
  });

  test('falls back to locale id when no matching region found in navigator.languages', async () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'fr-FR'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en');
  });
});

describe('regionLocale DOM integration', () => {
  test('sets document.documentElement.lang to inferred regionLocale when locale loads', async () => {
    vi.stubGlobal('navigator', {
      languages: ['en-AU', 'en'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(document.documentElement.lang).toBe('en-AU');
  });

  test('sets document.documentElement.lang to locale with region directly', async () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR'],
    });

    const controller = createTestController({
      locales: { 'en-US': {} },
    });

    await controller.setLocale('en-US');

    expect(document.documentElement.lang).toBe('en-US');
  });
});

describe('getRegionLocale fallback chain', () => {
  test('returns state.regionLocale after locale loads', async () => {
    vi.stubGlobal('navigator', {
      languages: ['en-US'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en-US');
  });

  test('returns activeLocale when no regionLocale in state', async () => {
    vi.stubGlobal('navigator', {
      languages: ['fr-FR'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });

    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en');
  });

  test('returns region locale based on fallbackLocale and browser locales when no locale loaded', () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'en-GB', 'en-US'],
    });

    const controller = i18nitialize({
      persistenceKey: 'test-fallback',
      fallbackLocale: 'en',
      locales: [],
    });

    expect(controller.getRegionLocale()).toBe('en-GB');
  });

  test('returns en-US as final fallback when no locale loaded and no fallbackLocale matches browser locales', () => {
    vi.stubGlobal('navigator', {
      languages: ['fr-FR', 'de-DE'],
    });

    const controller = i18nitialize({
      persistenceKey: 'test-fallback',
      fallbackLocale: 'en',
      locales: [],
    });

    expect(controller.getRegionLocale()).toBe('en');
  });
});

