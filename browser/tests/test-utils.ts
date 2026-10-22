import {
  analyzeTranslations,
  compileLocale,
  TranslationRegistry,
} from '@ls-stack/i18n-core/compiler';
import { invariant, isPromise } from '@ls-stack/utils/assertions';
import { sleep } from '@ls-stack/utils/sleep';
import { typedObjectEntries } from '@ls-stack/utils/typingFnUtils';
import {
  i18nitialize,
  type CompiledLocale,
  type I18nOptions,
  type Locale,
} from '../src/main';

type TestLocale = Locale | CompiledLocale;

export function createTestController<
  L extends Record<string, TestLocale | Error | Promise<TestLocale>>,
>({
  fallbackLocale,
  locales,
  loadingTime = 100,
  loadingTimes,
  persistenceKey = 'test',
  ...options
}: Omit<
  I18nOptions<keyof L & string>,
  'persistenceKey' | 'fallbackLocale' | 'locales'
> & {
  fallbackLocale?: (keyof L & string) | ['auto', keyof L & string];
  locales: L;
  loadingTime?: number;
  loadingTimes?: Partial<Record<keyof L & string, number>>;
  persistenceKey?: string | false;
}) {
  const invokedLoaderIds: string[] = [];

  const normalizedLocales = typedObjectEntries(locales).map(
    ([id, localeOrError]) => ({
      id: id as keyof L & string,
      loader: async (): Promise<{ default: TestLocale }> => {
        invokedLoaderIds.push(id as string);

        const delay = loadingTimes?.[id as keyof L & string] ?? loadingTime;
        await sleep(delay);

        if (isPromise(localeOrError)) {
          return { default: await localeOrError };
        }

        if (localeOrError instanceof Error) {
          throw localeOrError;
        }
        return { default: localeOrError };
      },
    }),
  );

  invariant(
    loadingTime > 0,
    'loadingTime must be greater than 0 to reflect real-world behavior',
  );

  invariant(normalizedLocales[0], 'At least one locale is required');

  const firstLocaleId = normalizedLocales[0].id;

  const controller = i18nitialize({
    persistenceKey,
    ...options,
    fallbackLocale: fallbackLocale ?? firstLocaleId,
    locales: normalizedLocales,
  });

  return Object.assign(controller, {
    invokedLoaderIds,
  });
}

/**
 * Compiles the translations used by the source code like the vite plugin does,
 * returning the compiled locale factory and the id of each translation.
 */
export function createTestCompiler(source: string) {
  const analysis = analyzeTranslations('/app/src/App.tsx', source);
  const registry = TranslationRegistry.fromKeys(analysis.calls);

  return {
    registry,
    compile: (locale: Locale): CompiledLocale =>
      compileLocale(registry, locale),
    id: (hash: string, { plural = false } = {}): number => {
      const id = registry.getId(hash, plural);
      invariant(
        id !== undefined,
        `Translation "${hash}" is not used in source`,
      );
      return id;
    },
  };
}
