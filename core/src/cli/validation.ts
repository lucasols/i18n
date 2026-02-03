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
import type { AITranslator, TranslationContext } from './ai-translator';
import {
  getI18nUsagesInCode,
  type I18nUsagesResult,
  type TranslationUsage,
} from './findMissingTranslations';
import { createSimilarityIndex, findSimilarFromIndex } from './similarity';

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

export type ValidationRuleName =
  | 'constant-translation'
  | 'unnecessary-plural'
  | 'jsx-without-interpolation'
  | 'jsx-without-jsx-nodes'
  | 'unnecessary-interpolated-affix'
  | 'max-translation-id-size';

export type RuleSeverity = 'error' | 'warning' | 'off';

export type ValidationRuleConfig = {
  [K in ValidationRuleName]?: RuleSeverity;
};

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
  rules?: ValidationRuleConfig;
  maxTranslationIdSize?: number;
};

const pluralTranslationSchema = rc_object({
  manyLimit: rc_number.optional(),
  zero: rc_string.optional(),
  one: rc_string.optional(),
  '+2': rc_union(rc_string, rc_null),
  many: rc_string.optional(),
});

const translationValueSchema = rc_union(
  rc_string,
  rc_null,
  pluralTranslationSchema,
);

const translationFileSchema = rc_record(translationValueSchema);

type PluralTranslation = {
  manyLimit?: number;
  zero?: string;
  one?: string;
  '+2': string | null;
  many?: string;
};

type TranslationValue = string | null | PluralTranslation;

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

  let hash = sortedKeys.length | 0;

  for (const key of sortedKeys) {
    hash = ((hash << 5) - hash + key.length) | 0;

    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    hash = ((hash << 5) - hash + 0xff) | 0;
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

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

function hasInterpolationPlaceholder(hash: string): boolean {
  return /\{[0-9]+\}/.test(hash);
}

function getInterpolationPrefix(value: string): string {
  const match = value.match(/^(.*?)\{[0-9]+\}/);
  return match ? (match[1] ?? '') : '';
}

function getInterpolationSuffix(value: string): string {
  const match = value.match(/\{[0-9]+\}([^{]*)$/);
  return match ? (match[1] ?? '') : '';
}

function isPluralOnlyPlus2(value: Record<string, unknown>): boolean {
  return (
    value.zero === undefined &&
    value.one === undefined &&
    value.many === undefined
  );
}

function getStringValue(value: TranslationValue | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return value['+2'];
}

type ValidationIssue = {
  rule: ValidationRuleName;
  hash: string;
  message: string;
  locations: Array<{ file: string; line: number; column: number }>;
};

function formatIssue(
  issue: ValidationIssue,
  severity: 'error' | 'warning',
  srcPath: string,
): string {
  const icon = severity === 'error' ? '❌' : '⚠️';
  const location = issue.locations[0];
  if (location) {
    const relativePath = path.relative(
      path.dirname(srcPath),
      path.join(srcPath, location.file),
    );
    return `${icon} ${relativePath}:${location.line}:${location.column} ${issue.message}`;
  }
  return `${icon} ${issue.message}`;
}

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
    rules = {},
    maxTranslationIdSize = 80,
  } = options;

  const getRuleSeverity = (rule: ValidationRuleName): RuleSeverity => {
    return rules[rule] ?? 'error';
  };

  const allStringTranslationHashs = new Set<string>();
  const allPluralTranslationHashs = new Set<string>();
  let hasError = false;

  const srcPath =
    path.isAbsolute(srcDir) ? srcDir : path.join(process.cwd(), srcDir);

  const globalUsageMap = new Map<string, TranslationUsage>();
  const globalJsxStringTranslations = new Set<string>();
  const globalJsxPluralTranslations = new Set<string>();
  const globalPrimitiveOnlyJsx = new Set<string>();

  for await (const entry of fs.scanDir(srcPath, {
    fileFilter: (entry) =>
      entry.path.endsWith('.ts') || entry.path.endsWith('.tsx'),
  })) {
    const { fullPath } = entry;

    const fileTextContent = fs.readFileSync(fullPath, 'utf-8');

    const relativePath = path.relative(srcPath, fullPath);
    const i18nUsages: I18nUsagesResult = getI18nUsagesInCode(
      relativePath,
      fileTextContent,
    );

    for (const hash of i18nUsages.stringTranslations) {
      allStringTranslationHashs.add(hash);
    }

    for (const hash of i18nUsages.pluralTranslations) {
      allPluralTranslationHashs.add(hash);
    }

    for (const hash of i18nUsages.jsxStringTranslations) {
      globalJsxStringTranslations.add(hash);
    }

    for (const hash of i18nUsages.jsxPluralTranslations) {
      globalJsxPluralTranslations.add(hash);
    }

    for (const hash of i18nUsages.primitiveOnlyJsx) {
      globalPrimitiveOnlyJsx.add(hash);
    }

    for (const [hash, usage] of i18nUsages.usageMap) {
      const existing = globalUsageMap.get(hash);
      if (existing) {
        existing.locations.push(...usage.locations);
        if (!usage.hasOnlyPrimitiveInterpolations) {
          existing.hasOnlyPrimitiveInterpolations = false;
        }
      } else {
        globalUsageMap.set(hash, { ...usage });
      }
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

  const allLocaleTranslations = new Map<
    string,
    Record<string, TranslationValue>
  >();
  const localeFiles: Array<{ fullPath: string; basename: string }> = [];

  for await (const entry of fs.scanDir(configPath, {
    fileFilter: (entry) => entry.path.endsWith('.json'),
  })) {
    localeFiles.push(entry);
  }

  for (const { fullPath, basename } of localeFiles) {
    const fileParseResult = rc_parse(
      JSON.parse(fs.readFileSync(fullPath, 'utf-8')),
      translationFileSchema,
    );
    if (!fileParseResult.ok) {
      log.error(`❌ ${basename} has invalid format:`, fileParseResult.errors);
      hasError = true;
      continue;
    }
    const localeId = basename.replace('.json', '');
    allLocaleTranslations.set(localeId, fileParseResult.value);
  }

  const validationIssues: ValidationIssue[] = [];

  const allHashes = new Set([
    ...allStringTranslationHashs,
    ...allPluralTranslationHashs,
  ]);

  for (const hash of allHashes) {
    const isSpecial = hash.startsWith('$') || hash.includes('~~');
    if (isSpecial) continue;

    const usage = globalUsageMap.get(hash);
    const locations = usage?.locations ?? [];

    const maxIdSizeSeverity = getRuleSeverity('max-translation-id-size');
    if (maxIdSizeSeverity !== 'off' && hash.length > maxTranslationIdSize) {
      const truncated = hash.length > 40 ? `${hash.slice(0, 37)}...` : hash;
      validationIssues.push({
        rule: 'max-translation-id-size',
        hash,
        message: `translation ID exceeds ${maxTranslationIdSize} chars (${hash.length}): "${truncated}". Use a $shortId instead, e.g.: __\`$myKey\``,
        locations,
      });
    }

    const constantSeverity = getRuleSeverity('constant-translation');
    if (constantSeverity !== 'off') {
      const values: string[] = [];
      for (const [, translations] of allLocaleTranslations) {
        const value = translations[hash];
        const strValue = getStringValue(value);
        if (strValue !== null) {
          values.push(strValue);
        }
      }

      if (values.length >= 2 && new Set(values).size === 1) {
        validationIssues.push({
          rule: 'constant-translation',
          hash,
          message: `constant translation "${hash}" has the same value in all locales. Either translate it differently per locale, or move it to code if it doesn't need translation`,
          locations,
        });
      }
    }

    const unnecessaryPluralSeverity = getRuleSeverity('unnecessary-plural');
    if (
      unnecessaryPluralSeverity !== 'off' &&
      allPluralTranslationHashs.has(hash)
    ) {
      let allOnlyPlus2 = true;
      let hasAnyPluralTranslation = false;

      for (const [, translations] of allLocaleTranslations) {
        const value = translations[hash];
        if (value !== null && value !== undefined && isObject(value)) {
          hasAnyPluralTranslation = true;
          if (!isPluralOnlyPlus2(value)) {
            allOnlyPlus2 = false;
            break;
          }
        }
      }

      if (hasAnyPluralTranslation && allOnlyPlus2) {
        validationIssues.push({
          rule: 'unnecessary-plural',
          hash,
          message: `unnecessary plural "${hash}" only uses the +2 form in all locales. Use __\`# items\` with interpolation instead of __p(count)\`# items\`, or add zero/one/many forms if needed`,
          locations,
        });
      }
    }

    const jsxWithoutInterpolationSeverity = getRuleSeverity(
      'jsx-without-interpolation',
    );
    if (jsxWithoutInterpolationSeverity !== 'off') {
      const isJsx =
        globalJsxStringTranslations.has(hash) ||
        globalJsxPluralTranslations.has(hash);
      if (isJsx && !hasInterpolationPlaceholder(hash)) {
        validationIssues.push({
          rule: 'jsx-without-interpolation',
          hash,
          message: `__jsx used without interpolations for "${hash}". Use __\`${hash}\` instead since there are no JSX elements to interpolate`,
          locations,
        });
      }
    }

    const jsxWithoutJsxNodesSeverity = getRuleSeverity('jsx-without-jsx-nodes');
    if (jsxWithoutJsxNodesSeverity !== 'off') {
      const isJsx =
        globalJsxStringTranslations.has(hash) ||
        globalJsxPluralTranslations.has(hash);
      const isPrimitiveOnly = globalPrimitiveOnlyJsx.has(hash);
      if (isJsx && isPrimitiveOnly && hasInterpolationPlaceholder(hash)) {
        validationIssues.push({
          rule: 'jsx-without-jsx-nodes',
          hash,
          message: `__jsx used but all interpolations are primitives (strings/numbers) for "${hash}". Use __\`...\` instead of __jsx\`...\` when not interpolating JSX elements`,
          locations,
        });
      }
    }

    const unnecessaryAffixSeverity = getRuleSeverity(
      'unnecessary-interpolated-affix',
    );
    if (
      unnecessaryAffixSeverity !== 'off' &&
      hasInterpolationPlaceholder(hash)
    ) {
      const prefixes: string[] = [];
      const suffixes: string[] = [];

      for (const [, translations] of allLocaleTranslations) {
        const value = translations[hash];
        const strValue = getStringValue(value);
        if (strValue !== null) {
          prefixes.push(getInterpolationPrefix(strValue));
          suffixes.push(getInterpolationSuffix(strValue));
        }
      }

      if (prefixes.length >= 2) {
        const uniquePrefixes = new Set(prefixes);
        if (uniquePrefixes.size === 1 && prefixes[0] !== '') {
          validationIssues.push({
            rule: 'unnecessary-interpolated-affix',
            hash,
            message: `prefix "${prefixes[0]}" before interpolation in "${hash}" is identical in all locales. Move it outside the translation: "${prefixes[0]}" + __\`...\``,
            locations,
          });
        }
      }

      if (suffixes.length >= 2) {
        const uniqueSuffixes = new Set(suffixes);
        if (uniqueSuffixes.size === 1 && suffixes[0] !== '') {
          validationIssues.push({
            rule: 'unnecessary-interpolated-affix',
            hash,
            message: `suffix "${suffixes[0]}" after interpolation in "${hash}" is identical in all locales. Move it outside the translation: __\`...\` + "${suffixes[0]}"`,
            locations,
          });
        }
      }
    }
  }

  for (const issue of validationIssues) {
    const severity = getRuleSeverity(issue.rule);
    if (severity === 'off') continue;

    const message = formatIssue(issue, severity, srcPath);
    if (severity === 'error') {
      hasError = true;
      log.error(message);
    } else {
      log.info(message);
    }
  }

  for (const { fullPath, basename } of localeFiles) {
    const invalidPluralTranslations: string[] = [];
    const invalidSpecialTranslations: string[] = [];
    const incompletePluralTranslations: string[] = [];

    const localeId = basename.replace('.json', '');
    const localeTranslations = allLocaleTranslations.get(localeId);

    if (!localeTranslations) {
      continue;
    }

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
          isDefaultLocale && (isNullTranslation || translationValue === hash);

        const isIncompleteNonDefaultTranslation =
          defaultLocale !== undefined && !isDefaultLocale && isNullTranslation;

        if (isUnneededDefaultHash) {
          missingHashs.delete(hash);
        } else if (!isIncompleteNonDefaultTranslation) {
          missingHashs.delete(hash);
          extraHashs.delete(hash);
        }

        const isVariantOrPlaceholder =
          hash.includes('~~') || hash.startsWith('$');
        if (isVariantOrPlaceholder && translationValue === hash) {
          invalidSpecialTranslations.push(hash);
        }
      } else if (allPluralTranslationHashs.has(hash)) {
        missingHashs.delete(hash);
        extraHashs.delete(hash);

        const pluralValue = localeTranslations[hash];
        if (pluralValue !== undefined && !isObject(pluralValue)) {
          invalidPluralTranslations.push(hash);
          delete localeTranslations[hash];

          if (fix) {
            missingHashs.add(hash);
          }
        } else if (
          !isDefaultLocale &&
          isObject(pluralValue) &&
          pluralValue['+2'] === null
        ) {
          incompletePluralTranslations.push(hash);
        }
      } else {
        missingHashs.delete(hash);
      }
    }

    if (
      missingHashs.size > 0 ||
      extraHashs.size > 0 ||
      invalidPluralTranslations.length > 0 ||
      invalidSpecialTranslations.length > 0 ||
      incompletePluralTranslations.length > 0
    ) {
      if (!fix) {
        hasError = true;

        if (invalidPluralTranslations.length > 0) {
          log.error(
            `❌ ${basename} has invalid plural translations: `,
            invalidPluralTranslations,
          );
        }

        if (incompletePluralTranslations.length > 0) {
          log.error(
            `❌ ${basename} has incomplete plural translations ('+2' is null, which is only allowed in the default locale): `,
            incompletePluralTranslations,
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
            const similarityIndex = createSimilarityIndex(
              existingTranslationsMap,
            );
            for (const hash of missingHashs) {
              const isPlural = allPluralTranslationHashs.has(hash);
              const similarTranslations = findSimilarFromIndex(
                similarityIndex,
                hash,
              );
              contexts.push({
                sourceKey: hash,
                targetLocale,
                isPlural,
                similarTranslations,
              });
            }

            try {
              const {
                translations: aiResults,
                model,
                usage,
              } = await aiTranslator.translateBatch(contexts);

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

              if (model || usage) {
                const parts: string[] = [];
                if (model) parts.push(`Model: ${model}`);
                if (usage)
                  parts.push(
                    `Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`,
                  );
                log.info(`   ${parts.join(' | ')}`);
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
