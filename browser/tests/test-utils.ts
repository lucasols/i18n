import { i18nitialize, type I18nOptions } from '../src/main';

export function createTestController<T extends string>(
  options: Omit<I18nOptions<T>, 'persistenceKey'>,
) {
  return i18nitialize({
    persistenceKey: 'test',
    ...options,
  });
}
