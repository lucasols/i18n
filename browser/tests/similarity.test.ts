import type { PluralTranslation } from '@ls-stack/i18n-core';
import { findSimilarTranslations } from '@ls-stack/i18n-core/cli';
import { expect, test } from 'vitest';

test('finds matches by token overlap', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['Welcome back', 'Bem-vindo de volta'],
      ['Goodbye', 'Tchau'],
    ]);

    const matches = findSimilarTranslations('Welcome to app', existing);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.key).toBe('Welcome back');
  });

test('finds plural translations by shared tokens', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['# active users', { zero: 'No users', one: '1 user', '+2': '# users' }],
      ['Hello', 'Olá'],
    ]);

    const matches = findSimilarTranslations('# total users', existing);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.key).toBe('# active users');
  });

test('returns empty array when no translations exist', () => {
    const matches = findSimilarTranslations(
      'Hello',
      new Map<string, string | PluralTranslation>(),
    );

    expect(matches).toEqual([]);
  });

test('respects maxResults limit', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['Test one', 'Um'],
      ['Test two', 'Dois'],
      ['Test three', 'Três'],
      ['Test four', 'Quatro'],
      ['Test five', 'Cinco'],
    ]);

    const matches = findSimilarTranslations('Test query', existing, 3);

    expect(matches.length).toBeLessThanOrEqual(3);
  });

test('handles dotted and camelCase tokens', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['errors.networkError', 'Network error'],
      ['errors.diskFull', 'Disk full'],
    ]);

    const matches = findSimilarTranslations('errors.networkTimeout', existing);

    expect(matches[0]?.key).toBe('errors.networkError');
  });

test('normalizes placeholders and digits', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['Hello {1}', 'Olá {1}'],
      ['Hello #', 'Olá #'],
      ['Goodbye', 'Tchau'],
    ]);

    const matches = findSimilarTranslations('Hello {2}', existing);

    const topKeys = matches.slice(0, 2).map((match) => match.key);
    expect(topKeys).toEqual(expect.arrayContaining(['Hello {1}', 'Hello #']));
    expect(topKeys).not.toContain('Goodbye');
  });

test('prefers translation-consistent examples when key scores tie', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['Reset password link', 'Redefinir senha pelo link'],
      ['Reset password email', 'Redefinir senha pelo link'],
      ['Reset password SMS', 'Redefinir senha por código'],
    ]);

    const matches = findSimilarTranslations('Reset password link', existing);

    const keys = matches.map((match) => match.key);
    expect(keys[0]).toBe('Reset password link');
    expect(keys.indexOf('Reset password email')).toBeLessThan(
      keys.indexOf('Reset password SMS'),
    );
  });

test('short strings still match via grams', () => {
    const existing = new Map<string, string | PluralTranslation>([
      ['OK!', 'Ok!'],
      ['Cancel', 'Cancelar'],
    ]);

    const matches = findSimilarTranslations('OK', existing);

    expect(matches[0]?.key).toBe('OK!');
  });
