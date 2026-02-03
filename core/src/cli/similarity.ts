import type { PluralTranslation } from '../types';

export type SimilarityMatch = {
  key: string;
  translation: string | PluralTranslation;
  score: number;
};

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();

  const words = text.toLowerCase().split(/[\s\-_{}#~$]+/);
  for (const word of words) {
    if (word.length > 0) {
      tokens.add(word);
    }
  }

  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i <= normalized.length - 3; i++) {
    tokens.add(`ng:${normalized.slice(i, i + 3)}`);
  }

  return tokens;
}

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 0;

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function commonPrefixScore(a: string, b: string): number {
  const normalizedA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedB = b.toLowerCase().replace(/[^a-z0-9]/g, '');

  let prefixLen = 0;
  const minLen = Math.min(normalizedA.length, normalizedB.length);

  for (let i = 0; i < minLen; i++) {
    if (normalizedA[i] === normalizedB[i]) {
      prefixLen++;
    } else {
      break;
    }
  }

  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  return maxLen === 0 ? 0 : prefixLen / maxLen;
}

export function findSimilarTranslations(
  sourceKey: string,
  existingTranslations: Map<string, string | PluralTranslation>,
  maxResults = 5,
): SimilarityMatch[] {
  if (existingTranslations.size === 0) {
    return [];
  }

  const sourceTokens = tokenize(sourceKey);
  const matches: SimilarityMatch[] = [];

  for (const [key, translation] of existingTranslations) {
    const keyTokens = tokenize(key);

    const jaccard = jaccardSimilarity(sourceTokens, keyTokens);
    const prefix = commonPrefixScore(sourceKey, key);

    const score = jaccard * 0.7 + prefix * 0.3;

    if (score > 0.1) {
      matches.push({ key, translation, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, maxResults);
}
