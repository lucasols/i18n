import type { DefaultLocalePluralTranslation } from '../types';

type SimilarityTranslation = string | DefaultLocalePluralTranslation;

export type SimilarityMatch = {
  key: string;
  translation: SimilarityTranslation;
  score: number;
};

type SimilarityEntry = {
  key: string;
  translation: SimilarityTranslation;
  wordTokens: Set<string>;
  gramTokens: Set<string>;
  normalizedKey: string;
  wordWeightSum: number;
  translationTokens: Set<string>;
};

type SimilarityIndex = {
  entries: SimilarityEntry[];
  tokenToEntries: Map<string, number[]>;
  idf: Map<string, number>;
  maxIdf: number;
};

const NUM_TOKEN = '__num__';
const NUM_TOKEN_PLACEHOLDER = 'numtoken';

function normalizePlaceholders(text: string): string {
  let normalized = text.replace(/\{[^}]*\}/g, ` ${NUM_TOKEN} `);
  normalized = normalized.replace(/#/g, ` ${NUM_TOKEN} `);
  normalized = normalized.replace(/\d+/g, ` ${NUM_TOKEN} `);
  return normalized;
}

function splitCamelCase(text: string): string {
  return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function tokenizeWords(text: string): Set<string> {
  let normalized = normalizePlaceholders(text);
  normalized = splitCamelCase(normalized);
  normalized = normalized.toLowerCase();
  normalized = normalized.replaceAll(NUM_TOKEN, ` ${NUM_TOKEN_PLACEHOLDER} `);
  normalized = normalized.replace(/[^a-z0-9]+/g, ' ');

  const tokens = new Set<string>();
  for (const rawToken of normalized.trim().split(/\s+/)) {
    if (!rawToken) continue;
    const token =
      rawToken === NUM_TOKEN_PLACEHOLDER ? NUM_TOKEN : rawToken;
    if (token.length >= 2 || token === NUM_TOKEN) {
      tokens.add(token);
    }
  }

  return tokens;
}

function normalizeForGrams(text: string): string {
  let normalized = normalizePlaceholders(text);
  normalized = splitCamelCase(normalized);
  normalized = normalized.toLowerCase();
  normalized = normalized.replaceAll(NUM_TOKEN, NUM_TOKEN_PLACEHOLDER);
  normalized = normalized.replace(/[^a-z0-9]+/g, '');
  return normalized;
}

function tokenizeGrams(text: string): Set<string> {
  const normalized = normalizeForGrams(text);
  const tokens = new Set<string>();

  if (normalized.length >= 3) {
    for (let i = 0; i <= normalized.length - 3; i++) {
      tokens.add(`ng:${normalized.slice(i, i + 3)}`);
    }
  } else if (normalized.length === 2) {
    tokens.add(`ng2:${normalized}`);
  } else if (normalized.length === 1) {
    tokens.add(`ng1:${normalized}`);
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

function commonPrefixScoreNormalized(a: string, b: string): number {
  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);

  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      prefixLen++;
    } else {
      break;
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : prefixLen / maxLen;
}

function getTokenWeight(
  token: string,
  idf: Map<string, number>,
  maxIdf: number,
): number {
  return idf.get(token) ?? maxIdf;
}

function sumTokenWeights(
  tokens: Set<string>,
  idf: Map<string, number>,
  maxIdf: number,
): number {
  let sum = 0;
  for (const token of tokens) {
    sum += getTokenWeight(token, idf, maxIdf);
  }
  return sum;
}

function weightedJaccard(
  set1: Set<string>,
  set2: Set<string>,
  idf: Map<string, number>,
  maxIdf: number,
  set1WeightSum?: number,
  set2WeightSum?: number,
): number {
  if (set1.size === 0 && set2.size === 0) return 0;

  const weightSum1 =
    set1WeightSum ?? sumTokenWeights(set1, idf, maxIdf);
  const weightSum2 =
    set2WeightSum ?? sumTokenWeights(set2, idf, maxIdf);

  let intersectionWeight = 0;
  if (set1.size <= set2.size) {
    for (const token of set1) {
      if (set2.has(token)) {
        intersectionWeight += getTokenWeight(token, idf, maxIdf);
      }
    }
  } else {
    for (const token of set2) {
      if (set1.has(token)) {
        intersectionWeight += getTokenWeight(token, idf, maxIdf);
      }
    }
  }

  const union = weightSum1 + weightSum2 - intersectionWeight;
  return union === 0 ? 0 : intersectionWeight / union;
}

function toTranslationText(translation: SimilarityTranslation): string {
  if (typeof translation === 'string') return translation;

  const parts: string[] = [];
  if (translation.zero) parts.push(translation.zero);
  if (translation.one) parts.push(translation.one);
  if (translation['+2']) parts.push(translation['+2']);
  if (translation.many) parts.push(translation.many);
  return parts.join(' ');
}

export function createSimilarityIndex(
  existingTranslations: Map<string, SimilarityTranslation>,
): SimilarityIndex {
  const entries: SimilarityEntry[] = [];
  const tokenToEntries = new Map<string, number[]>();
  const documentFrequency = new Map<string, number>();

  for (const [key, translation] of existingTranslations) {
    const wordTokens = tokenizeWords(key);
    const gramTokens = tokenizeGrams(key);
    const normalizedKey = normalizeForGrams(key);
    const translationTokens = tokenizeWords(toTranslationText(translation));
    const entryIndex = entries.length;

    for (const token of wordTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      const existing = tokenToEntries.get(token);
      if (existing) {
        existing.push(entryIndex);
      } else {
        tokenToEntries.set(token, [entryIndex]);
      }
    }

    entries.push({
      key,
      translation,
      wordTokens,
      gramTokens,
      normalizedKey,
      wordWeightSum: 0,
      translationTokens,
    });
  }

  const totalDocuments = entries.length;
  const idf = new Map<string, number>();
  for (const [token, count] of documentFrequency) {
    idf.set(token, Math.log((totalDocuments + 1) / (count + 1)) + 1);
  }

  const maxIdf = Math.log((totalDocuments + 1) / 1) + 1;

  for (const entry of entries) {
    entry.wordWeightSum = sumTokenWeights(entry.wordTokens, idf, maxIdf);
  }

  return {
    entries,
    tokenToEntries,
    idf,
    maxIdf,
  };
}

export function findSimilarFromIndex(
  index: SimilarityIndex,
  sourceKey: string,
  maxResults = 5,
): SimilarityMatch[] {
  if (index.entries.length === 0) {
    return [];
  }

  const sourceTokens = tokenizeWords(sourceKey);
  const sourceGrams = tokenizeGrams(sourceKey);
  const sourceNormalized = normalizeForGrams(sourceKey);
  const sourceWeightSum = sumTokenWeights(
    sourceTokens,
    index.idf,
    index.maxIdf,
  );

  let candidateIndexes: number[] = [];
  if (sourceTokens.size > 0) {
    const candidateSet = new Set<number>();
    for (const token of sourceTokens) {
      const matches = index.tokenToEntries.get(token);
      if (!matches) continue;
      for (const entryIndex of matches) {
        candidateSet.add(entryIndex);
      }
    }

    candidateIndexes =
      candidateSet.size === 0 ?
        index.entries.map((_entry, idx) => idx)
      : Array.from(candidateSet);
  } else {
    candidateIndexes = index.entries.map((_entry, idx) => idx);
  }

  const scored: { index: number; keyScore: number }[] = [];
  for (const entryIndex of candidateIndexes) {
    const entry = index.entries[entryIndex];
    if (!entry) {
      continue;
    }
    const wordScore = weightedJaccard(
      sourceTokens,
      entry.wordTokens,
      index.idf,
      index.maxIdf,
      sourceWeightSum,
      entry.wordWeightSum,
    );
    const gramScore = jaccardSimilarity(sourceGrams, entry.gramTokens);
    const prefixScore = commonPrefixScoreNormalized(
      sourceNormalized,
      entry.normalizedKey,
    );

    const keyScore = wordScore * 0.65 + gramScore * 0.25 + prefixScore * 0.1;

    if (keyScore >= 0.12) {
      scored.push({ index: entryIndex, keyScore });
    }
  }

  if (scored.length === 0) {
    return [];
  }

  scored.sort((a, b) => b.keyScore - a.keyScore);

  const topCount = Math.min(20, scored.length);
  const topEntry = scored[0];
  if (!topEntry) {
    return [];
  }
  const referenceTokens =
    index.entries[topEntry.index]?.translationTokens ?? new Set<string>();

  const finalCandidates: {
    index: number;
    finalScore: number;
    keyScore: number;
  }[] = [];

  for (let i = 0; i < topCount; i++) {
    const scoredEntry = scored[i];
    if (!scoredEntry) {
      continue;
    }
    const entry = index.entries[scoredEntry.index];
    if (!entry) {
      continue;
    }
    let translationScore = 0;

    if (referenceTokens.size > 0 && entry.translationTokens.size > 0) {
      translationScore = jaccardSimilarity(
        referenceTokens,
        entry.translationTokens,
      );
    }

    const finalScore = scoredEntry.keyScore * 0.85 + translationScore * 0.15;
    finalCandidates.push({
      index: scoredEntry.index,
      finalScore,
      keyScore: scoredEntry.keyScore,
    });
  }

  for (let i = topCount; i < scored.length; i++) {
    const scoredEntry = scored[i];
    if (!scoredEntry) {
      continue;
    }
    finalCandidates.push({
      index: scoredEntry.index,
      finalScore: scoredEntry.keyScore,
      keyScore: scoredEntry.keyScore,
    });
  }

  finalCandidates.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    if (b.keyScore !== a.keyScore) {
      return b.keyScore - a.keyScore;
    }
    const aKey = index.entries[a.index]?.key ?? '';
    const bKey = index.entries[b.index]?.key ?? '';
    return aKey.localeCompare(bKey);
  });

  const results: SimilarityMatch[] = [];
  for (const candidate of finalCandidates.slice(0, maxResults)) {
    const entry = index.entries[candidate.index];
    if (!entry) continue;
    results.push({
      key: entry.key,
      translation: entry.translation,
      score: candidate.finalScore,
    });
  }
  return results;
}

export function findSimilarTranslations(
  sourceKey: string,
  existingTranslations: Map<string, SimilarityTranslation>,
  maxResults = 5,
): SimilarityMatch[] {
  if (existingTranslations.size === 0) {
    return [];
  }

  const index = createSimilarityIndex(existingTranslations);
  return findSimilarFromIndex(index, sourceKey, maxResults);
}
