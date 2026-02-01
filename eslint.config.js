// @ts-check
import eslint from '@eslint/js';
import { extendedLintPlugin } from '@ls-stack/extended-lint';
import vitest from '@vitest/eslint-plugin';
import eslintUnicornPlugin from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

const OFF = 0;
const ERROR = 2;

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { process: true },
    },
  },
  {
    plugins: {
      '@lucasols/extended-lint': extendedLintPlugin,
      unicorn: eslintUnicornPlugin,
      vitest,
    },

    rules: {
      'no-warning-comments': [ERROR, { terms: ['FIX:'] }],
      'no-constant-binary-expression': ERROR,
      'object-shorthand': ERROR,
      'no-useless-rename': ERROR,
      'no-param-reassign': ERROR,
      'prefer-template': ERROR,
      'prefer-const': [ERROR, { destructuring: 'all' }],

      'no-prototype-builtins': OFF,
      'no-inner-declarations': OFF,
      'no-undef': OFF,
      'no-console': [ERROR, { allow: ['warn', 'error', 'info'] }],
      'no-restricted-imports': [
        ERROR,
        {
          patterns: [
            {
              group: ['*.test'],
              message: 'Do not import test files',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        ERROR,
        {
          selector: 'CallExpression[callee.property.name="only"]',
          message: 'No test.only',
        },
        {
          selector: 'CallExpression[callee.property.name="todo"]',
          message: 'No test.todo',
        },
      ],
      'no-implicit-coercion': [
        ERROR,
        { disallowTemplateShorthand: true, allow: ['!!'] },
      ],

      /* typescript */
      '@typescript-eslint/no-unnecessary-condition': ERROR,
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      '@typescript-eslint/no-unused-expressions': ERROR,
      '@typescript-eslint/no-unused-vars': [
        ERROR,
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-shadow': [
        ERROR,
        { ignoreOnInitialization: true, allow: ['expect'] },
      ],
      '@typescript-eslint/no-unsafe-call': ERROR,

      /* vitest */
      'vitest/expect-expect': ERROR,
      'vitest/no-identical-title': ERROR,

      /* extended-lint */
      '@lucasols/extended-lint/no-unused-type-props-in-args': ERROR,
      '@lucasols/extended-lint/no-unnecessary-describe': ERROR,
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
);
