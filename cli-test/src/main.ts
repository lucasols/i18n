import { i18nitialize } from '../../server/src/main';

const i18n = i18nitialize({
  locales: {
    pt: {},
    es: {},
    en: {},
  },
});

export const { __, __p } = i18n.with('pt');

export const translation = __`Hello World`;

export const pluralTranslation = __p(1)`# Hello World`;

export const translationWithInterpolation = __`Hello ${'World'}`;

export const pluralTranslationWithInterpolation = __p(1)`# Hello ${'World'}`;

export const translationWithMultipleInterpolations = __`Hello ${'World'} ${'foo'}`;

export const alternateTranslation = __`Hello World~~2`;
