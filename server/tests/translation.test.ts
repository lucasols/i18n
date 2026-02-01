import { beforeAll, describe, expect, test } from 'vitest';
import { i18nitialize } from '../src/index.js';

let i18n = i18nitialize({
  locales: {
    pt: {
      hello: 'olá',
      'hello {1}': 'olá {1}',
      'multiple {1} interpolations {2}': 'multiplas {1} interpolações {2}',
    },
    es: {
      hello: 'hola',
      'hello {1}': 'hola {1}',
      'inverted {1} placeholders {2}': '{2} interpolación {1} invertida',
    },
    en: {},
  },
});

describe('translation', () => {
  describe('basic translation', () => {
    test('simple translation', () => {
      const { __ } = i18n.with('pt');

      expect(__`hello`).toBe('olá');

      const es = i18n.with('es');

      expect(es.__`hello`).toBe('hola');
    });

    test('when no translation is found, fallback to hash', () => {
      const { __ } = i18n.with('en');

      expect(__`hello`).toBe('hello');
    });
  });

  describe('interpolation', () => {
    test('simple interpolation', () => {
      const { __ } = i18n.with('pt');

      expect(__`hello ${'world'}`).toBe('olá world');
    });

    test('when no translation is found, fallback to hash', () => {
      const { __ } = i18n.with('en');

      expect(__`hello ${'fallback'}`).toBe('hello fallback');
    });

    test('multiple interpolations', () => {
      const { __ } = i18n.with('pt');

      expect(__`multiple ${'world'} interpolations ${'foo'}`).toBe(
        'multiplas world interpolações foo',
      );
    });

    test('inverted placeholders', () => {
      const { __ } = i18n.with('es');

      expect(__`inverted ${'world'} placeholders ${'foo'}`).toBe(
        'foo interpolación world invertida',
      );
    });
  });

  describe('pluralization', () => {
    beforeAll(() => {
      i18n = i18nitialize({
        locales: {
          pt: {
            '# apples': {
              one: 'uma maçã',
              '+2': '# maçãs',
              zero: 'nenhuma maçã',
              many: 'muitas maçãs',
              manyLimit: 10,
            },
            test: 'test',
          },
          en: {
            '# apples': {
              one: 'one apple',
              '+2': '# apples',
              zero: 'no apples',
              many: 'many apples',
              manyLimit: 10,
            },
          },
        },
      });
    });

    test('simple pluralization', () => {
      const { __p } = i18n.with('pt');

      expect(__p(1)`# apples`).toBe('uma maçã');
      expect(__p(2)`# apples`).toBe('2 maçãs');
      expect(__p(3)`# apples`).toBe('3 maçãs');
      expect(__p(0)`# apples`).toBe('nenhuma maçã');
      expect(__p(11)`# apples`).toBe('muitas maçãs');
      expect(__p(10)`# apples`).toBe('10 maçãs');

      const en = i18n.with('en');

      expect(en.__p(1)`# apples`).toBe('one apple');
      expect(en.__p(2)`# apples`).toBe('2 apples');
      expect(en.__p(3)`# apples`).toBe('3 apples');
      expect(en.__p(0)`# apples`).toBe('no apples');
      expect(en.__p(11)`# apples`).toBe('many apples');
    });

    test('fallback to hash when no translation is found', () => {
      const { __p } = i18n.with('pt');

      expect(__p(1)`# unknown`).toBe('# unknown');
    });

    test('using invalid method should throw an error', () => {
      const { __ } = i18n.with('pt');

      expect(() => __`# apples`).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid translation, this translation should use the plural \`__p\` method]`,
      );
    });

    test('using __p on invalid translation should throw an error', () => {
      const { __p } = i18n.with('pt');

      expect(() => __p(1)`test`).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid translation, this translation should use the \`__\` method]`,
      );
    });
  });

  describe('translation variations', () => {
    beforeAll(() => {
      i18n = i18nitialize({
        locales: {
          pt: {
            'hello {1}': 'olá {1}',
            'hello {1}~~formal': 'olá {1}, como vai?',
          },
          en: {},
        },
      });
    });

    test('simple translation', () => {
      const { __ } = i18n.with('pt');

      expect(__`hello {1}`).toBe('olá {1}');
      expect(__`hello {1}~~formal`).toBe('olá {1}, como vai?');
    });

    test('when no translation is found, fallback to hash', () => {
      const { __ } = i18n.with('en');

      expect(__`hello {1}~~formal`).toBe('hello {1}');
    });
  });
});
