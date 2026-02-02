import { invariant, isPromise } from '@ls-stack/utils/assertions';
import { sleep } from '@ls-stack/utils/sleep';
import { typedObjectEntries } from '@ls-stack/utils/typingFnUtils';
import { i18nitialize, type I18nOptions, type Locale } from '../src/main';

export function createTestController<T extends string>({
  fallbackLocale,
  locales,
  loadingTime = 100,
  ...options
}: Omit<I18nOptions<T>, 'persistenceKey' | 'fallbackLocale' | 'locales'> & {
  fallbackLocale?: T;
  locales: Record<T, Locale | Error | Promise<Locale>>;
  loadingTime?: number;
}) {
  const normalizedLocales = typedObjectEntries(locales).map(
    ([id, localeOrError]) => ({
      id,
      loader: async (): Promise<{ default: Locale }> => {
        await sleep(loadingTime);

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

  invariant(normalizedLocales[0], 'At least one locale is required');

  const firstLocaleId = normalizedLocales[0].id;

  return i18nitialize({
    persistenceKey: 'test',
    ...options,
    fallbackLocale: fallbackLocale ?? firstLocaleId,
    locales: normalizedLocales,
  });
}
