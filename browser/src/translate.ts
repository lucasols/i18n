import {
  createHashAndFallbackTranslation,
  interpolate,
  selectPluralForm,
} from '@ls-stack/i18n-core';
import { createElement, Fragment, type ReactNode } from 'react';
import { getState } from './state.js';
import type { JsxInterpolation } from './types.js';

export function __(
  strings: TemplateStringsArray,
  ...exprs: (string | number)[]
): string {
  const [hash, fallbackTranslation] = createHashAndFallbackTranslation(
    strings,
    exprs,
  );

  const { translations } = getState();

  if (!translations) {
    return fallbackTranslation;
  }

  const selectedTranslation = translations[hash];

  if (selectedTranslation === undefined) {
    return fallbackTranslation;
  }

  if (typeof selectedTranslation === 'string' && selectedTranslation) {
    return interpolate(selectedTranslation, exprs) || fallbackTranslation;
  }

  if (selectedTranslation) {
    console.error(
      'Invalid translation, this translation should use the plural `__p` method',
    );
  }

  return fallbackTranslation;
}

export function __p(num: number) {
  return (
    strings: TemplateStringsArray,
    ...exprs: (string | number)[]
  ): string => {
    const [hash, fallbackTranslation] = createHashAndFallbackTranslation(
      strings,
      exprs,
    );

    const { translations } = getState();

    if (!translations) {
      return fallbackTranslation;
    }

    const selectedTranslation = translations[hash];

    if (selectedTranslation === undefined) {
      return fallbackTranslation;
    }

    if (
      typeof selectedTranslation === 'object' &&
      selectedTranslation !== null
    ) {
      const translation = selectPluralForm(num, selectedTranslation);

      if (translation === null) {
        console.error(`No plural configured for hash: ${hash}`);
        return fallbackTranslation;
      }

      return interpolate(translation, exprs) || fallbackTranslation;
    }

    if (selectedTranslation) {
      console.error(
        'Invalid translation, this translation should use the `__` method',
      );
    }

    return fallbackTranslation;
  };
}

function interpolateJsx(
  translation: string,
  exprs: JsxInterpolation[],
): ReactNode {
  if (exprs.length === 0) {
    return translation;
  }

  const parts: ReactNode[] = [];
  const translationParts = translation.split(/{(\d+)}/);

  for (let i = 0; i < translationParts.length; i++) {
    const part = translationParts[i];

    if (i % 2 === 0) {
      if (part) parts.push(part);
    } else {
      const interpolationPos = Number(part);
      const expr = exprs[interpolationPos - 1];
      if (expr !== undefined) parts.push(expr);
    }
  }

  return createElement(Fragment, null, ...parts);
}

export function __jsx(
  strings: TemplateStringsArray,
  ...exprs: JsxInterpolation[]
): ReactNode {
  const strExprs: (string | number)[] = exprs.map((e, i) =>
    typeof e === 'string' || typeof e === 'number' ? e : `{${i + 1}}`,
  );

  const [hash, fallbackTranslation] = createHashAndFallbackTranslation(
    strings,
    strExprs,
  );

  const { translations } = getState();

  if (!translations) {
    return interpolateJsx(fallbackTranslation, exprs);
  }

  const selectedTranslation = translations[hash];

  if (selectedTranslation === undefined) {
    return interpolateJsx(fallbackTranslation, exprs);
  }

  if (typeof selectedTranslation === 'string' && selectedTranslation) {
    return interpolateJsx(selectedTranslation, exprs);
  }

  if (selectedTranslation) {
    console.error(
      'Invalid translation, this translation should use the plural `__pjsx` method',
    );
  }

  return interpolateJsx(fallbackTranslation, exprs);
}

export function __pjsx(num: number) {
  return (
    strings: TemplateStringsArray,
    ...exprs: JsxInterpolation[]
  ): ReactNode => {
    const strExprs: (string | number)[] = exprs.map((e, i) =>
      typeof e === 'string' || typeof e === 'number' ? e : `{${i + 1}}`,
    );

    const [hash, fallbackTranslation] = createHashAndFallbackTranslation(
      strings,
      strExprs,
    );

    const { translations } = getState();

    if (!translations) {
      return interpolateJsx(fallbackTranslation, exprs);
    }

    const selectedTranslation = translations[hash];

    if (selectedTranslation === undefined) {
      return interpolateJsx(fallbackTranslation, exprs);
    }

    if (
      typeof selectedTranslation === 'object' &&
      selectedTranslation !== null
    ) {
      const translation = selectPluralForm(num, selectedTranslation);

      if (translation === null) {
        console.error(`No plural configured for hash: ${hash}`);
        return interpolateJsx(fallbackTranslation, exprs);
      }

      return interpolateJsx(translation, exprs);
    }

    if (selectedTranslation) {
      console.error(
        'Invalid translation, this translation should use the `__jsx` method',
      );
    }

    return interpolateJsx(fallbackTranslation, exprs);
  };
}
