import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { readdirp, type EntryInfo } from 'readdirp';
import {
  rc_null,
  rc_number,
  rc_object,
  rc_parse,
  rc_record,
  rc_string,
  rc_union,
} from 'runcheck';
import type { PluralTranslation } from '../types';
import type { AITranslator, TranslationContext } from './ai-translator';
import { getI18nUsagesInCode } from './findMissingTranslations';
import { findSimilarTranslations } from './similarity';

export type FileSystem = {
  readFileSync: (path: string, encoding: 'utf-8') => string;
  writeFileSync: (path: string, content: string) => void;
  scanDir: (
    dirPath: string,
    options: { fileFilter: (entry: { path: string }) => boolean },
  ) =>
    | AsyncIterable<{ fullPath: string; basename: string }>
    | Iterable<{ fullPath: string; basename: string }>;
};

export type Logger = Pick<Console, 'log' | 'error' | 'info'>;

export type ValidationOptions = {
  configDir: string;
  srcDir: string;
  defaultLocale?: string;
  fix?: boolean;
  noColor?: boolean;
  colorFn?: (color: 'red', text: string) => string;
  fs?: FileSystem;
  log?: Logger;
  aiTranslator?: AITranslator;
};

const pluralTranslationSchema = rc_object({
  manyLimit: rc_number.optional(),
  zero: rc_string.optional(),
  one: rc_string.optional(),
  '+2': rc_string,
  many: rc_string.optional(),
});

const translationValueSchema = rc_union(
  rc_string,
  rc_null,
  pluralTranslationSchema,
);

const translationFileSchema = rc_record(translationValueSchema);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const LEGACY_MISSING_MARKER = '👇 missing translations 👇';
const MISSING_START_MARKER = '👇 missing start 👇';
const MISSING_END_MARKER = '👆 missing end 👆';
const MISSING_MARKER_VALUE = '🛑 delete this line 🛑';

function isMarkerKey(key: string): boolean {
  return (
    key === LEGACY_MISSING_MARKER ||
    key === MISSING_START_MARKER ||
    key === MISSING_END_MARKER
  );
}

function calculateInsertPosition(
  missingKeys: string[],
  totalKeys: number,
): number {
  if (totalKeys === 0) return 0;

  const sortedKeys = [...missingKeys].sort();

  // Start with key count for initial entropy
  let hash = sortedKeys.length | 0;

  for (const key of sortedKeys) {
    // Mix in key length first (adds entropy for same-char-sum keys)
    hash = ((hash << 5) - hash + key.length) | 0;

    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    hash = ((hash << 5) - hash + 0xff) | 0;
  }

  // MurmurHash3-style finalizer with proper 32-bit multiplication
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  // Use unsigned right shift to ensure positive (avoids Math.abs edge case)
  return (hash >>> 0) % totalKeys;
}

function buildOrderedTranslations(
  existing: Record<string, unknown>,
  missing: Map<string, unknown>,
  insertPosition: number,
  addMarkers = true,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const existingKeys = Object.keys(existing).filter(
    (k) => k !== '' && !isMarkerKey(k),
  );

  let inserted = false;
  for (let i = 0; i < existingKeys.length; i++) {
    if (i === insertPosition && !inserted && missing.size > 0) {
      if (addMarkers) {
        result[MISSING_START_MARKER] = MISSING_MARKER_VALUE;
      }
      for (const [key, value] of missing) {
        result[key] = value;
      }
      if (addMarkers) {
        result[MISSING_END_MARKER] = MISSING_MARKER_VALUE;
      }
      inserted = true;
    }
    const key = existingKeys[i];
    if (key !== undefined) {
      result[key] = existing[key];
    }
  }

  if (!inserted && missing.size > 0) {
    if (addMarkers) {
      result[MISSING_START_MARKER] = MISSING_MARKER_VALUE;
    }
    for (const [key, value] of missing) {
      result[key] = value;
    }
    if (addMarkers) {
      result[MISSING_END_MARKER] = MISSING_MARKER_VALUE;
    }
  }

  result[''] = '';
  return result;
}

export const defaultFs: FileSystem = {
  readFileSync: (filePath, encoding) => readFileSync(filePath, encoding),
  writeFileSync: (filePath, content) => writeFileSync(filePath, content),
  async *scanDir(dirPath, options) {
    for await (const entry_ of readdirp(dirPath, {
      fileFilter: options.fileFilter,
      directoryFilter: (entry) =>
        !entry.path.includes('node_modules') && !entry.path.includes('.git'),
    })) {
      const entry = entry_ as EntryInfo;
      yield { fullPath: entry.fullPath, basename: entry.basename };
    }
  },
};

export async function validateTranslations(
  options: ValidationOptions,
): Promise<{ hasError: boolean }> {
  const {
    configDir,
    srcDir,
    defaultLocale,
    fix = false,
    noColor = false,
    colorFn = (_, text) => text,
    fs = defaultFs,
    log = console,
    aiTranslator,
  } = options;

  const allStringTranslationHashs = new Set<string>();
  const allPluralTranslationHashs = new Set<string>();
  let hasError = false;

  const srcPath =
    path.isAbsolute(srcDir) ? srcDir : path.join(process.cwd(), srcDir);
  for await (const entry of fs.scanDir(srcPath, {
    fileFilter: (entry) =>
      entry.path.endsWith('.ts') || entry.path.endsWith('.tsx'),
  })) {
    const { fullPath, basename } = entry;

    const fileTextContent = fs.readFileSync(fullPath, 'utf-8');

    const i18nUsages = getI18nUsagesInCode(basename, fileTextContent);

    for (const hash of i18nUsages.stringTranslations) {
      allStringTranslationHashs.add(hash);
    }

    for (const hash of i18nUsages.pluralTranslations) {
      allPluralTranslationHashs.add(hash);
    }
  }

  if (
    allStringTranslationHashs.size === 0 &&
    allPluralTranslationHashs.size === 0
  ) {
    log.error('❌ No translations found in dir: ', srcDir);
    return { hasError: true };
  }

  const configPath =
    path.isAbsolute(configDir) ? configDir : (
      path.join(process.cwd(), configDir)
    );
  for await (const entry of fs.scanDir(configPath, {
    fileFilter: (entry) => entry.path.endsWith('.json'),
  })) {
    const { fullPath, basename } = entry;
    const invalidPluralTranslations: string[] = [];
    const invalidSpecialTranslations: string[] = [];

    const fileParseResult = rc_parse(
      JSON.parse(fs.readFileSync(fullPath, 'utf-8')),
      translationFileSchema,
    );
    if (!fileParseResult.ok) {
      log.error(`❌ ${basename} has invalid format:`, fileParseResult.errors);
      hasError = true;
      continue;
    }
    const localeTranslations = fileParseResult.value;

    const isDefaultLocale = basename === `${defaultLocale}.json`;

    const localeFileHashs = Object.keys(localeTranslations);

    const extraHashs = new Set(localeFileHashs);
    const missingHashs = new Set([
      ...(isDefaultLocale ? [] : [...allStringTranslationHashs]),
      ...allPluralTranslationHashs,
    ]);

    extraHashs.delete('');

    for (const hash of localeFileHashs) {
      if (allStringTranslationHashs.has(hash)) {
        const translationValue = localeTranslations[hash];
        const isNullTranslation = translationValue === null;

        const isUnneededDefaultHash =
          isDefaultLocale &&
          (isNullTranslation || translationValue === hash);

        const isIncompleteNonDefaultTranslation =
          defaultLocale !== undefined && !isDefaultLocale && isNullTranslation;

        if (isUnneededDefaultHash) {
          missingHashs.delete(hash);
        } else if (isIncompleteNonDefaultTranslation) {
          // Keep in missingHashs (still needs translation)
          // Keep in extraHashs (remove from current position, re-add under marker)
        } else {
          missingHashs.delete(hash);
          extraHashs.delete(hash);
        }

        const isVariantOrPlaceholder = hash.includes('~~') || hash.startsWith('$');
        if (isVariantOrPlaceholder && translationValue === hash) {
          invalidSpecialTranslations.push(hash);
        }
      } else if (allPluralTranslationHashs.has(hash)) {
        missingHashs.delete(hash);
        extraHashs.delete(hash);

        if (
          localeTranslations[hash] !== undefined &&
          !isObject(localeTranslations[hash])
        ) {
          invalidPluralTranslations.push(hash);
          delete localeTranslations[hash];

          if (fix) {
            missingHashs.add(hash);
          }
        }
      } else {
        missingHashs.delete(hash);
      }
    }

    if (
      missingHashs.size > 0 ||
      extraHashs.size > 0 ||
      invalidPluralTranslations.length > 0 ||
      invalidSpecialTranslations.length > 0
    ) {
      if (!fix) {
        hasError = true;

        if (invalidPluralTranslations.length > 0) {
          log.error(
            `❌ ${basename} has invalid plural translations: `,
            invalidPluralTranslations,
          );
        }

        if (invalidSpecialTranslations.length > 0) {
          log.error(
            `❌ ${basename} has invalid special translations (value equals key): `,
            invalidSpecialTranslations,
          );
        }

        if (missingHashs.size > 0 || extraHashs.size > 0) {
          const parts: string[] = [];

          if (missingHashs.size) {
            const countStr =
              noColor ?
                String(missingHashs.size)
              : colorFn('red', String(missingHashs.size));
            parts.push(`missing ${countStr}`);
          }

          if (extraHashs.size) {
            const countStr =
              noColor ?
                String(extraHashs.size)
              : colorFn('red', String(extraHashs.size));
            parts.push(`extra ${countStr}`);
          }

          log.error(
            `❌ ${basename} has invalid translations: ${parts.join(', ')}`,
          );
        }
      } else {
        if (invalidSpecialTranslations.length > 0) {
          log.error(
            `❌ ${basename} has invalid special translations (value equals key): `,
            invalidSpecialTranslations,
          );
        } else if (
          missingHashs.size === 0 &&
          extraHashs.size > 0 &&
          [...extraHashs].every((k) => isMarkerKey(k))
        ) {
          log.error(`❌ ${basename} has missing translations`);
        } else {
          const cleanedExisting: Record<string, unknown> = {};
          for (const key of Object.keys(localeTranslations)) {
            if (key === '' || isMarkerKey(key) || extraHashs.has(key)) {
              continue;
            }
            cleanedExisting[key] = localeTranslations[key];
          }

          const missingMap = new Map<string, unknown>();
          let useAIMarkers = true;

          if (aiTranslator && missingHashs.size > 0) {
            const targetLocale = basename.replace('.json', '');

            const existingTranslationsMap = new Map<
              string,
              string | PluralTranslation
            >();
            for (const [key, value] of Object.entries(cleanedExisting)) {
              if (
                typeof value === 'string' ||
                (typeof value === 'object' && value !== null)
              ) {
                existingTranslationsMap.set(
                  key,
                  value as string | PluralTranslation,
                );
              }
            }

            const contexts: TranslationContext[] = [];
            for (const hash of missingHashs) {
              const isPlural = allPluralTranslationHashs.has(hash);
              const similarTranslations = findSimilarTranslations(
                hash,
                existingTranslationsMap,
              );
              contexts.push({
                sourceKey: hash,
                targetLocale,
                isPlural,
                similarTranslations,
              });
            }

            try {
              const aiResults = await aiTranslator.translateBatch(contexts);

              for (const hash of missingHashs) {
                const aiResult = aiResults.get(hash);
                if (aiResult) {
                  if (aiResult.type === 'plural') {
                    missingMap.set(hash, aiResult.value);
                  } else {
                    missingMap.set(hash, aiResult.value);
                  }
                } else {
                  const fallbackValue =
                    allPluralTranslationHashs.has(hash) ?
                      {
                        zero: 'No x',
                        one: '1 x',
                        '+2': '# x',
                        many: undefined,
                        manyLimit: undefined,
                      }
                    : null;
                  missingMap.set(hash, fallbackValue);
                }
              }

              useAIMarkers = false;
            } catch {
              for (const hash of missingHashs) {
                const value =
                  allPluralTranslationHashs.has(hash) ?
                    {
                      zero: 'No x',
                      one: '1 x',
                      '+2': '# x',
                      many: undefined,
                      manyLimit: undefined,
                    }
                  : null;
                missingMap.set(hash, value);
              }
            }
          } else {
            for (const hash of missingHashs) {
              const value =
                allPluralTranslationHashs.has(hash) ?
                  {
                    zero: 'No x',
                    one: '1 x',
                    '+2': '# x',
                    many: undefined,
                    manyLimit: undefined,
                  }
                : null;
              missingMap.set(hash, value);
            }
          }

          const existingKeysCount = Object.keys(cleanedExisting).length;
          const insertPosition = calculateInsertPosition(
            [...missingHashs],
            existingKeysCount,
          );

          const orderedTranslations = buildOrderedTranslations(
            cleanedExisting,
            missingMap,
            insertPosition,
            useAIMarkers,
          );

          if (missingHashs.size > 0) {
            if (aiTranslator && !useAIMarkers) {
              log.info(`✅ ${basename} translations were AI-generated`);
            } else {
              log.info(`🟠 ${basename} translations keys were added`);
            }
          } else {
            log.info(`✅ ${basename} translations fixed`);
          }

          fs.writeFileSync(
            fullPath,
            JSON.stringify(orderedTranslations, null, 2),
          );
        }
      }
    } else {
      log.info(`✅ ${basename} translations are up to date`);
    }
  }

  return { hasError };
}
