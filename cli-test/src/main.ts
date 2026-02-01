import { i18nitialize } from '../../server/src/main.js';

const i18n = i18nitialize({
  locales: {
    pt: {},
    es: {},
    en: {},
  },
});

export const { __: ___, __p: ___p } = i18n.with('pt');

export const translation = ___`Hello World`;

export const pluralTranslation = ___p(1)`# Hello World`;

export const translationWithInterpolation = ___`Hello ${'World'}`;

export const pluralTranslationWithInterpolation = ___p(1)`# Hello ${'World'}`;

export const translationWithMultipleInterpolations = ___`Hello ${'World'} ${'foo'}`;

export const alternateTranslation = ___`Hello World~~2`;
