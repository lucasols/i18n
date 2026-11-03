import { i18nitialize } from '../../../../src/main';

export const i18n = i18nitialize({
  locales: [
    { id: 'en', loader: () => import('../locales/en.json') },
    { id: 'pt', loader: () => import('../locales/pt.json') },
  ],
  persistenceKey: false,
  fallbackLocale: 'en',
});
