/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { __date, __num, i18nitialize, resetState } from '../src/main';
import { configure, getRegionLocale } from '../src/state';
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

  test('returns inferred region locale from persisted locale before loading', () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'en-GB', 'en-US'],
    });

    localStorage.setItem('test-persisted', 'en');

    const controller = i18nitialize({
      persistenceKey: 'test-persisted',
      fallbackLocale: 'pt',
      locales: [{ id: 'en', loader: () => Promise.resolve({ default: {} }) }],
    });

    expect(controller.getRegionLocale()).toBe('en-GB');
  });

  test('persisted locale takes priority over fallbackLocale for region inference', () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'en-GB'],
    });

    localStorage.setItem('test-priority', 'pt');

    const controller = i18nitialize({
      persistenceKey: 'test-priority',
      fallbackLocale: 'en',
      locales: [{ id: 'pt', loader: () => Promise.resolve({ default: {} }) }],
    });

    expect(controller.getRegionLocale()).toBe('pt-BR');
  });

  test('returns region locale based on fallbackLocale and browser locales when no locale loaded', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.stubGlobal('navigator', {
      languages: ['pt-BR', 'en-GB', 'en-US'],
    });

    const controller = i18nitialize({
      persistenceKey: 'test-fallback',
      fallbackLocale: 'en',
      locales: [],
    });

    expect(controller.getRegionLocale()).toBe('en-GB');

    await new Promise((resolve) => setTimeout(resolve, 0));
    errorSpy.mockRestore();
  });
  test('throws in dev when no locale loaded and no fallbackLocale configured', () => {
    configure({
      locales: [],
      persistenceKey: 'test-dev-fallback',
      fallbackLocale: null,
      dev: true,
    });

    expect(() => getRegionLocale()).toThrowError(/No locale configured/i);
  });
});

describe('formatters use inferred region locale', () => {
  test('__date formats with en-US style (MM/DD/YY)', async () => {
    vi.stubGlobal('navigator', {
      languages: ['en-US', 'en'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en-US');

    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = __date(date, { dateStyle: 'short' });
    expect(formatted).toMatch(/1\/15\/24/);
  });

  test('__date formats with en-GB style (DD/MM/YYYY)', async () => {
    vi.stubGlobal('navigator', {
      languages: ['en-GB', 'en'],
    });

    const controller = createTestController({
      locales: { en: {} },
    });
    await controller.setLocale('en');

    expect(controller.getRegionLocale()).toBe('en-GB');

    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = __date(date, { dateStyle: 'short' });
    expect(formatted).toMatch(/15\/01\/2024/);
  });

  test('__num formats with region-specific decimal separator', async () => {
    vi.stubGlobal('navigator', {
      languages: ['pt-BR'],
    });

    const controller = createTestController({
      locales: { pt: {} },
    });
    await controller.setLocale('pt');

    expect(controller.getRegionLocale()).toBe('pt-BR');

    const formatted = __num(1234.56);
    expect(formatted).toMatch(/1\.234,56/);
  });
});
