export function interpolate(
  translation: string,
  exprs: (string | number)[],
): string {
  if (exprs.length === 0) {
    return translation;
  }

  let result = '';
  const translationParts = translation.split(/{(\d+)}/);

  for (let i = 0; i < translationParts.length; i++) {
    const part = translationParts[i];

    if (i % 2 === 0) {
      result += part;
    } else {
      const interpolationPos = Number(part);
      result += exprs[interpolationPos - 1];
    }
  }

  return result;
}
