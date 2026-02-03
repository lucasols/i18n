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
import { getI18nUsagesInCode } from './findMissingTranslations';

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

const MISSING_TRANSLATIONS_KEY = '👇 missing translations 👇';
const MISSING_TRANSLATION_VALUE = '🛑 delete this line 🛑';

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
      missingHashs.delete(hash);

      if (allStringTranslationHashs.has(hash)) {
        const isUnnededDefaultHash =
          isDefaultLocale && localeTranslations[hash] === null;

        if (!isUnnededDefaultHash) {
          extraHashs.delete(hash);
        }
      } else if (allPluralTranslationHashs.has(hash)) {
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
      }
    }

    if (
      missingHashs.size > 0 ||
      extraHashs.size > 0 ||
      invalidPluralTranslations.length > 0
    ) {
      if (!fix) {
        hasError = true;

        if (invalidPluralTranslations.length > 0) {
          log.error(
            `❌ ${basename} has invalid plural translations: `,
            invalidPluralTranslations,
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
        if (
          missingHashs.size === 0 &&
          extraHashs.size === 1 &&
          extraHashs.has(MISSING_TRANSLATIONS_KEY)
        ) {
          log.error(`❌ ${basename} has missing translations`);
        } else {
          delete localeTranslations[''];

          if (
            !localeTranslations[MISSING_TRANSLATIONS_KEY] &&
            missingHashs.size > 0
          ) {
            localeTranslations[MISSING_TRANSLATIONS_KEY] =
              MISSING_TRANSLATION_VALUE;
          }

          if (missingHashs.size > 0) {
            for (const hash of missingHashs) {
              localeTranslations[hash] =
                allPluralTranslationHashs.has(hash) ?
                  {
                    zero: 'No x',
                    one: '1 x',
                    '+2': '# x',
                    many: 'A lot of x',
                    manyLimit: 50,
                  }
                : null;
            }
          }

          if (extraHashs.size > 0) {
            for (const hash of extraHashs) {
              if (hash === MISSING_TRANSLATIONS_KEY) continue;

              delete localeTranslations[hash];
            }
          }

          localeTranslations[''] = '';

          if (missingHashs.size > 0) {
            log.info(`🟠 ${basename} translations keys were added`);
          } else {
            log.info(`✅ ${basename} translations fixed`);
          }

          fs.writeFileSync(fullPath, JSON.stringify(localeTranslations, null, 2));
        }
      }
    } else {
      log.info(`✅ ${basename} translations are up to date`);
    }
  }

  return { hasError };
}
