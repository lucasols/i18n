export function createHashAndFallbackTranslation(
  strings: TemplateStringsArray,
  exprs: (string | number)[],
): readonly [hash: string, fallbackTranslation: string] {
  let hash = '';
  let fallbackTranslation = '';

  for (let i = 0; i < strings.length; i++) {
    const string = strings[i] ?? '';
    const expr = exprs[i];

    hash += string + (i !== strings.length - 1 ? `{${i + 1}}` : '');
    fallbackTranslation += string + (expr ?? '');
  }

  if (fallbackTranslation.includes('~~')) {
    fallbackTranslation = fallbackTranslation.split('~~')[0] ?? fallbackTranslation;
  }

  return [hash, fallbackTranslation] as const;
}
