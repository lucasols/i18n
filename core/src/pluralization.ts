import type { PluralTranslation } from './types';

export function selectPluralForm(
  num: number,
  pluralTranslation: PluralTranslation,
): string | null {
  if (num === 0 && pluralTranslation.zero) {
    return pluralTranslation.zero;
  }

  if (num === 1 && pluralTranslation.one) {
    return pluralTranslation.one;
  }

  if (
    pluralTranslation.manyLimit &&
    pluralTranslation.many &&
    num > pluralTranslation.manyLimit
  ) {
    return pluralTranslation.many;
  }

  if (pluralTranslation['+2']) {
    return pluralTranslation['+2'].replace('#', String(num));
  }

  return null;
}
