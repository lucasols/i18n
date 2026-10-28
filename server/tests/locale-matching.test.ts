import { describe, expect, test } from 'vitest';
import { i18nitialize } from '../src/main';

function createI18n() {
  return i18nitialize({
    locales: {
      en: {},
      pt: { hello: 'olá', 'hello {1}': 'olá {1}' },
      es: { hello: 'hola', 'hello {1}': 'hola {1}' },
    },
  });
}

describe('toAvailableLocale', () => {
  test('matches exact locale ids', () => {
    const i18n = createI18n();

    expect(i18n.toAvailableLocale('en')).toBe('en');
    expect(i18n.toAvailableLocale('pt')).toBe('pt');
    expect(i18n.toAvailableLocale('es')).toBe('es');
  });

  test('matches regional language tags to their base language', () => {
    const i18n = createI18n();

    expect(i18n.toAvailableLocale('pt-BR')).toBe('pt');
    expect(i18n.toAvailableLocale('pt-PT')).toBe('pt');
    expect(i18n.toAvailableLocale('es-419')).toBe('es');
    expect(i18n.toAvailableLocale('en-US')).toBe('en');
    expect(i18n.toAvailableLocale('zh-Hant-TW')).toBe('en');
  });

  test('ignores case, surrounding whitespace and underscore separators', () => {
    const i18n = createI18n();

    expect(i18n.toAvailableLocale('PT')).toBe('pt');
    expect(i18n.toAvailableLocale('pt_BR')).toBe('pt');
    expect(i18n.toAvailableLocale('ES_mx')).toBe('es');
    expect(i18n.toAvailableLocale(' pt-br ')).toBe('pt');
  });

  test('returns the first locale when the tag is unknown or empty', () => {
    const i18n = createI18n();

    expect(i18n.toAvailableLocale('fr-FR')).toBe('en');
    expect(i18n.toAvailableLocale('')).toBe('en');
    expect(i18n.toAvailableLocale(null)).toBe('en');
    expect(i18n.toAvailableLocale(undefined)).toBe('en');
  });

  test('does not match locales that only contain the tag as a substring', () => {
    const i18n = createI18n();

    expect(i18n.toAvailableLocale('opt')).toBe('en');
    expect(i18n.toAvailableLocale('est')).toBe('en');
  });

  test('uses the configured fallbackLocale', () => {
    const i18n = i18nitialize({
      locales: { en: {}, pt: {} },
      fallbackLocale: 'pt',
    });

    expect(i18n.toAvailableLocale('de-DE')).toBe('pt');
    expect(i18n.toAvailableLocale(undefined)).toBe('pt');
    expect(i18n.toAvailableLocale('en-GB')).toBe('en');
  });

  test('matches regional locale ids', () => {
    const i18n = i18nitialize({
      locales: { 'en-US': {}, 'pt-BR': {}, 'es-MX': {}, es: {} },
    });

    expect(i18n.toAvailableLocale('pt-br')).toBe('pt-BR');
    expect(i18n.toAvailableLocale('pt')).toBe('pt-BR');
    expect(i18n.toAvailableLocale('pt-PT')).toBe('pt-BR');
    expect(i18n.toAvailableLocale('en-GB')).toBe('en-US');
    expect(i18n.toAvailableLocale('es-MX')).toBe('es-MX');
    // the locale without region wins for other regions
    expect(i18n.toAvailableLocale('es-AR')).toBe('es');
    expect(i18n.toAvailableLocale('fr')).toBe('en-US');
  });

  test('throws when no locales are configured', () => {
    const i18n = i18nitialize({ locales: {} });

    expect(() => i18n.toAvailableLocale('pt-BR')).toThrow(
      'No locales configured',
    );
  });
});

describe('withUnknownLocale', () => {
  test('translates with the closest available locale', () => {
    const i18n = createI18n();

    expect(i18n.withUnknownLocale('pt-BR').__`hello`).toBe('olá');
    expect(i18n.withUnknownLocale('es-419').__`hello ${'Ana'}`).toBe(
      'hola Ana',
    );
    expect(i18n.withUnknownLocale('fr-FR').__`hello`).toBe('hello');
    expect(i18n.withUnknownLocale(undefined).__`hello`).toBe('hello');
  });

  test('supports destructuring the translation functions', () => {
    const i18n = createI18n();

    const { __ } = i18n.withUnknownLocale('pt_BR');

    expect(__`hello ${'Ana'}`).toBe('olá Ana');
  });
});

describe('locale instances', () => {
  test('reuses one instance per locale instead of allocating on every call', () => {
    const i18n = createI18n();

    const ptInstance = i18n.with('pt');

    expect(i18n.with('pt')).toBe(ptInstance);
    expect(i18n.withUnknownLocale('pt-BR')).toBe(ptInstance);
    expect(i18n.withUnknownLocale('PT_pt')).toBe(ptInstance);
    expect(i18n.with('es')).not.toBe(ptInstance);
  });
});
