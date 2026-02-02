import { invariant, isPromise } from '@ls-stack/utils/assertions';
import { sleep } from '@ls-stack/utils/sleep';
import { typedObjectEntries } from '@ls-stack/utils/typingFnUtils';
import { i18nitialize, type I18nOptions, type Locale } from '../src/main';

export function createTestController<
  L extends Record<string, Locale | Error | Promise<Locale>>,
>({
  fallbackLocale,
  locales,
  loadingTime = 100,
  persistenceKey = 'test',
  ...options
}: Omit<
  I18nOptions<keyof L & string>,
  'persistenceKey' | 'fallbackLocale' | 'locales'
> & {
  fallbackLocale?: keyof L & string;
  locales: L;
  loadingTime?: number;
  persistenceKey?: string;
}) {
  const normalizedLocales = typedObjectEntries(locales).map(
    ([id, localeOrError]) => ({
      id: id as keyof L & string,
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
    persistenceKey,
    ...options,
    fallbackLocale: fallbackLocale ?? firstLocaleId,
    locales: normalizedLocales,
  });
}
