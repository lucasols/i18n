import {
  analyzeTranslations,
  compileLocale,
  compileLocaleModule,
  getIdsFileState,
  isTranslationSourceFile,
  parseIdsFile,
  serializeIdsFile,
  transformTranslations,
  TranslationRegistry,
} from '@ls-stack/i18n-core/compiler';
import { describe, expect, test } from 'vitest';

function compileSource(
  code: string,
  {
    fileName = '/app/src/Inbox.tsx',
    devFallbacks = false,
    sourcemap = true,
  } = {},
) {
  const analysis = analyzeTranslations(fileName, code);
  const registry = TranslationRegistry.fromKeys(analysis.calls);
  const result = transformTranslations({
    fileName,
    code,
    analysis,
    devFallbacks,
    sourcemap,
    getId: (call) => {
      const id = registry.getId(call.hash, call.plural);
      if (id === undefined) throw new Error(`Missing id for ${call.hash}`);
      return id;
    },
  });

  return { registry, code: result?.code ?? null, map: result?.map ?? null };
}

describe('analyzeTranslations', () => {
  test('finds all translation kinds with the same hashes used by the runtime', () => {
    const { calls } = analyzeTranslations(
      '/app/src/Inbox.tsx',
      `
        import { __, __jsx, __p, __pjsx } from '@ls-stack/i18n';

        export function Inbox({ user, count }: Props) {
          return (
            <div title={__\`Inbox\`}>
              {__\`Hello \${user.name}, welcome back!~~formal\`}
              {__p(count)\`You have # unread messages\`}
              {__jsx\`Message \${<strong>{user.name}</strong>} directly\`}
              {__pjsx(count)\`# files in \${<em>{folder}</em>}\`}
            </div>
          );
        }
      `,
    );

    expect(
      calls.map(({ hash, plural, jsx }) => ({ hash, plural, jsx })),
    ).toEqual([
      { hash: 'Inbox', plural: false, jsx: false },
      { hash: 'Hello {1}, welcome back!~~formal', plural: false, jsx: false },
      { hash: 'You have # unread messages', plural: true, jsx: false },
      { hash: 'Message {1} directly', plural: false, jsx: true },
      { hash: '# files in {1}', plural: true, jsx: true },
    ]);
  });

  test('flags calls with a literal {n} in their text', () => {
    const { calls } = analyzeTranslations(
      '/app/src/Templates.tsx',
      `
        export function TemplateHelp({ field, count }: Props) {
          return [
            __\`Use {1} to insert the customer name\`,
            __\`Type \${field} or {2} in the subject\`,
            __p(count)\`# templates use {1} and \${field}\`,
            __\`Hello \${field}, welcome back!\`,
            __\`Use {name} or {} for the default value\`,
          ];
        }
      `,
    );

    expect(
      calls.map(({ hash, literalPlaceholder }) => ({
        hash,
        literalPlaceholder,
      })),
    ).toEqual([
      { hash: 'Use {1} to insert the customer name', literalPlaceholder: true },
      { hash: 'Type {1} or {2} in the subject', literalPlaceholder: true },
      // the literal {1} and the interpolation get the same placeholder
      { hash: '# templates use {1} and {1}', literalPlaceholder: true },
      { hash: 'Hello {1}, welcome back!', literalPlaceholder: false },
      {
        hash: 'Use {name} or {} for the default value',
        literalPlaceholder: false,
      },
    ]);
  });

  test('ignores member calls and calls that are not translations', () => {
    const { calls } = analyzeTranslations(
      '/app/src/server.ts',
      `
        const label = i18n.__\`Server side label\`;
        const css = styled.div\`color: red;\`;
        const multi = __p(count, other)\`# items\`;
        const value = foo__\`not a translation\`;
      `,
    );

    expect(calls).toEqual([]);
  });

  test('ignores translation functions declared in the file', () => {
    const { calls } = analyzeTranslations(
      '/app/src/emails/welcomeEmail.ts',
      `
        import { __jsx } from '@ls-stack/i18n';

        export function getWelcomeEmail(i18n: I18n, name: string) {
          const { __, __p } = i18n;

          return {
            subject: __\`Welcome to the team, \${name}\`,
            body: __p(3)\`You have # pending invites\`,
            footer: __jsx\`Sent by \${<strong>Acme</strong>}\`,
          };
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Sent by {1}']);
  });

  test('only ignores the calls inside the scope of the local declaration', () => {
    const { calls } = analyzeTranslations(
      '/app/src/ChannelList.tsx',
      `
        import { __ } from '@ls-stack/i18n';

        export function ChannelList({ channels }: Props) {
          return (
            <section>
              <h2>{__\`Channels\`}</h2>
              {channels.map((_, __) => <Row key={__} />)}
              {channels.length === 0 && __\`You have no channels\`}
            </section>
          );
        }

        export function getInviteEmail(i18n: I18n) {
          if (i18n.isServer) {
            const { __ } = i18n;
            return __\`Server invite\`;
          }

          return __\`Join the channel\`;
        }

        export function getFooter() {
          try {
            return __\`Sent by Acme\`;
          } catch (__) {
            return __\`Unknown sender\`;
          }
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual([
      'Channels',
      'You have no channels',
      'Join the channel',
      'Sent by Acme',
    ]);
  });

  test('declarations are hoisted to the start of their scope', () => {
    const { calls } = analyzeTranslations(
      '/app/src/legacy.ts',
      `
        export function getTitle() {
          return __\`Title\`;
          function __() {
            return 'custom';
          }
        }

        export const subtitle = __\`Subtitle\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Subtitle']);
  });

  test('the name of a named function expression only shadows inside it', () => {
    const { calls } = analyzeTranslations(
      '/app/src/legacy.ts',
      `
        export const upper = function __(strings: TemplateStringsArray) {
          return strings.join('').toUpperCase() + __\`Suffix\`;
        };

        export const title = __\`Title\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Title']);
  });

  test('computed method names are not shadowed by the method parameters', () => {
    const { calls } = analyzeTranslations(
      '/app/src/profileFields.ts',
      `
        export const fields = {
          [__\`Display name\`](__: string) {
            return __.trim();
          },
          get [__\`Email\`]() {
            return '';
          },
        };
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Display name', 'Email']);
  });

  test('method decorators are not shadowed by the method parameters', () => {
    const { calls } = analyzeTranslations(
      '/app/src/settingsForm.ts',
      `
        export class SettingsForm {
          @label(__\`Save settings\`)
          submit(__: SubmitEvent) {
            return __.target;
          }
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Save settings']);
  });

  test('parameter decorators are not shadowed by the method parameters', () => {
    const { calls } = analyzeTranslations(
      '/app/src/profileForm.ts',
      `
        export class ProfileForm {
          constructor(@label(__\`Display name\`) __: string) {
            this.name = __;
          }

          rename(@label(__\`New name\`) __: string) {
            return __.trim();
          }
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual([
      'Display name',
      'New name',
    ]);
  });

  test('ambient declarations do not shadow the translation functions', () => {
    const { calls } = analyzeTranslations(
      '/app/src/legacyBanner.ts',
      `
        declare const __: (strings: TemplateStringsArray) => string;
        declare function __p(count: number): typeof __;
        declare namespace legacy {
          const __jsx: typeof __;
        }

        export const title = __\`Legacy banner\`;
        export const items = (count: number) => __p(count)\`# items\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual([
      'Legacy banner',
      '# items',
    ]);
  });

  test('leaves calls with syntax errors untouched', () => {
    const missingExpression = analyzeTranslations(
      '/app/src/Greeting.tsx',
      'export const greeting = __`Hello ${} again`; const ok = __`Saved`;',
    );
    const unterminatedTemplate = analyzeTranslations(
      '/app/src/Greeting.tsx',
      'export const Greeting = () => <p>{__`Hello ${user</p>; }',
    );
    const missingCount = analyzeTranslations(
      '/app/src/Inbox.ts',
      'export const unread = __p()`# unread`;',
    );
    const unterminatedNoSubstitution = analyzeTranslations(
      '/app/src/Inbox.ts',
      'export const title = __`Inbox',
    );

    expect(missingExpression.calls.map((call) => call.hash)).toEqual(['Saved']);
    expect(unterminatedTemplate.calls).toEqual([]);
    expect(missingCount.calls).toEqual([]);
    expect(unterminatedNoSubstitution.calls).toEqual([]);
  });

  test('var declarations in the body do not shadow parameter initializers', () => {
    const { calls } = analyzeTranslations(
      '/app/src/header.ts',
      `
        export function getHeader(title = __\`Untitled\`) {
          var __ = (strings: TemplateStringsArray) => strings.join('');
          return title + __\`Custom\`;
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Untitled']);
  });

  test('finds translations with comments before the template', () => {
    const { calls } = analyzeTranslations(
      '/app/src/Toolbar.tsx',
      `
        const saved = __ /* shown after autosave */ \`Saved\`;
        const pending = __p /* count */ (count)\`# pending changes\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual([
      'Saved',
      '# pending changes',
    ]);
  });

  test('parses .ts files with generic arrow functions', () => {
    const { calls } = analyzeTranslations(
      '/app/src/utils.ts',
      `
        const identity = <T>(value: T) => value;
        export const label = identity(__\`Saved\`);
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Saved']);
  });

  test('skips parsing files without translations', () => {
    expect(
      analyzeTranslations(
        '/app/src/math.ts',
        'export const sum = (a, b) => a + b;',
      ),
    ).toEqual({ calls: [], insertPos: 0 });
  });

  test('names in comments and strings do not change the result', () => {
    const { calls } = analyzeTranslations(
      '/app/src/Settings.tsx',
      `
        // __ is replaced by the vite plugin
        const docs = 'use __p for plurals';
        export function Settings() {
          /* __jsx renders elements */
          return [docs, __\`Settings\`];
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Settings']);
  });

  test('declarations spelled with unicode escapes still shadow the translation functions', () => {
    const { calls } = analyzeTranslations(
      '/app/src/legacy.ts',
      `
        export function legacyLabel(i18n: I18n) {
          const \\u005f_ = i18n.translate;
          return __\`Legacy\`;
        }
        export const title = __\`Title\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Title']);
  });

  test('declarations with an escaped letter in the name still shadow the translation functions', () => {
    const { calls } = analyzeTranslations(
      '/app/src/notes.tsx',
      `
        export function renderNote(highlight: Tag, text: string) {
          const __js\\u0078 = highlight;
          return __jsx\`Note: \${text}\`;
        }
        export const title = __\`Notes\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Notes']);
  });

  test('optional chain and `new` tagged templates are left untouched', () => {
    const { calls } = analyzeTranslations(
      '/app/src/Toolbar.tsx',
      `
        export function getToolbarLabels(count: number) {
          return [
            __?.\`Undo\`,
            __p?.(count)\`# changes\`,
            new __\`Redo\`,
            __\`Save\`,
          ];
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Save']);
  });

  test('enums named like the translation functions shadow them', () => {
    const { calls } = analyzeTranslations(
      '/app/src/legacy.ts',
      `
        export function getLegacyLabels() {
          enum __ { Saved = 'saved' }
          return __\`Saved\`;
        }

        export const title = __\`Title\`;
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual(['Title']);
  });

  test('namespaces named like the translation functions do not shadow them', () => {
    // a namespace can't be called, so `__` still refers to the global function
    const { calls } = analyzeTranslations(
      '/app/src/help.ts',
      `
        namespace __p {
          export type Form = 'one' | 'other';
        }

        export function getHelpLabel(count: number, form: __p.Form) {
          return form === 'one' ? __\`One article\` : __p(count)\`# articles\`;
        }
      `,
    );

    expect(calls.map((call) => call.hash)).toEqual([
      'One article',
      '# articles',
    ]);
  });

  test('declaration and CommonJS files are not translation sources', () => {
    expect(
      [
        'src/Inbox.tsx',
        'src/utils.mts',
        'src/format.mjs',
        'src/legacy.cjs',
        'src/config.cts',
        'src/env.d.ts',
        'src/env.d.mts',
      ].filter((file) => isTranslationSourceFile(file)),
    ).toEqual(['src/Inbox.tsx', 'src/utils.mts', 'src/format.mjs']);
  });
});

describe('transformTranslations', () => {
  test('the runtime imports do not collide with identifiers spelled with escapes', () => {
    const { code } = compileSource(
      [
        'const __i18\\u006e__t = 42;',
        'export const answer = __i18\\u006e__t;',
        'export const label = __`Saved`;',
      ].join('\n'),
    );

    expect(code?.split('\n')[0]).toBe(
      "import { __l as __i18n1__l } from '@ls-stack/i18n';const __i18\\u006e__t = 42;",
    );
    expect(code).toContain('export const label = __i18n1__l[0];');
  });

  test('replaces tagged templates with id based calls', () => {
    const { code } = compileSource(
      [
        `import { __, __jsx, __p, __pjsx } from '@ls-stack/i18n';`,
        `export const title = __\`Inbox\`;`,
        `export const welcome = (name: string) => __\`Hello \${name}, welcome back!\`;`,
        `export const unread = (count: number) => __p(count)\`You have # unread messages\`;`,
        `export const link = (name: string) => __jsx\`Message \${<strong>{name}</strong>} directly\`;`,
        `export const files = (count: number, folder: string) => __pjsx(count)\`# files in \${<em>{folder}</em>}\`;`,
      ].join('\n'),
    );

    expect(code).toBe(
      [
        `import { __l as __i18n__l, __t as __i18n__t, __tp as __i18n__tp, __tjsx as __i18n__tjsx, __tpjsx as __i18n__tpjsx } from '@ls-stack/i18n';import { __, __jsx, __p, __pjsx } from '@ls-stack/i18n';`,
        `export const title = __i18n__l[2];`,
        `export const welcome = (name: string) => __i18n__t(1, name);`,
        `export const unread = (count: number) => __i18n__tp(4, count);`,
        `export const link = (name: string) => __i18n__tjsx(3, <strong>{name}</strong>);`,
        `export const files = (count: number, folder: string) => __i18n__tpjsx(0, count, <em>{folder}</em>);`,
      ].join('\n'),
    );
  });

  test('transforms nested translations', () => {
    const { code, registry } = compileSource(
      'const summary = __`${channel} has ${__p(members)`# members`}`;',
    );

    expect(registry.keys).toEqual([
      { hash: '# members', plural: true },
      { hash: '{1} has {2}', plural: false },
    ]);
    expect(code).toContain(
      'const summary = __i18n__t(1, channel, __i18n__tp(0, members));',
    );
  });

  test('keeps comma expressions as a single argument', () => {
    const { code } = compileSource(
      'const label = __`Step ${track(), step} of ${total}`;',
    );

    expect(code).toContain('__i18n__t(0, (track(), step), total)');
  });

  test('inserts the runtime import after directives', () => {
    const { code } = compileSource(
      `'use client';\nexport const label = __\`Saved\`;`,
    );

    expect(code).toBe(
      `'use client';import { __l as __i18n__l } from '@ls-stack/i18n';\nexport const label = __i18n__l[0];`,
    );
  });

  test('inserts the runtime import after the hashbang', () => {
    const { code } = compileSource(
      `#!/usr/bin/env node\n'use strict';\nconsole.info(__\`Saved\`);`,
      { fileName: '/app/src/cli.ts' },
    );

    expect(code).toBe(
      `#!/usr/bin/env node\n'use strict';import { __l as __i18n__l } from '@ls-stack/i18n';\nconsole.info(__i18n__l[0]);`,
    );

    const { code: withoutDirectives } = compileSource(
      `#!/usr/bin/env node\nconsole.info(__\`Saved\`);`,
      { fileName: '/app/src/cli.ts' },
    );

    expect(withoutDirectives).toBe(
      `#!/usr/bin/env node\nimport { __l as __i18n__l } from '@ls-stack/i18n';console.info(__i18n__l[0]);`,
    );
  });

  test('inserts the runtime import after a directive without a semicolon', () => {
    const { code } = compileSource(
      `'use client'\nexport const label = __\`Saved\`;`,
    );

    expect(code).toBe(
      `'use client';import { __l as __i18n__l } from '@ls-stack/i18n';\nexport const label = __i18n__l[0];`,
    );
  });

  test('keeps the line numbers of the code, multiline translations included', () => {
    const source = [
      `'use client';`,
      `export function getEmptyInbox(name: string, count: number) {`,
      `  const title = __\`You have no messages,`,
      `    \${name}\`;`,
      `  const hint = __p(count)\`# archived conversations`,
      `    can be restored\`;`,
      `  return { title, hint, missing: getMissingLabel() };`,
      `}`,
    ].join('\n');

    const { code } = compileSource(source, { sourcemap: false });
    const lines = code?.split('\n') ?? [];

    expect(lines).toHaveLength(8);
    expect(lines[2]).toBe('  const title = __i18n__t(1, ');
    expect(lines[3]).toBe('name);');
    expect(lines[4]).toBe('  const hint = __i18n__tp(0, count');
    expect(lines[5]).toBe(');');
    expect(lines[6]).toBe(
      '  return { title, hint, missing: getMissingLabel() };',
    );
  });

  test('translations without interpolations read the compiled strings', () => {
    const { code } = compileSource(
      [
        `export const Header = () => (`,
        `  <header title={__\`Direct Messages\`}>{__jsx\`Archived conversations\`}</header>`,
        `);`,
        `export const empty = (count: number) => __p(count)\`# unread messages\`;`,
      ].join('\n'),
    );

    expect(code).toBe(
      [
        `import { __l as __i18n__l, __tp as __i18n__tp } from '@ls-stack/i18n';export const Header = () => (`,
        `  <header title={__i18n__l[2]}>{__i18n__l[1]}</header>`,
        `);`,
        `export const empty = (count: number) => __i18n__tp(0, count);`,
      ].join('\n'),
    );
  });

  test('keeps the line numbers of multiline translations without interpolations', () => {
    const source = [
      `export function getHint() {`,
      `  const hint = __\`Archived conversations`,
      `    can be restored\`;`,
      `  return hint;`,
      `}`,
    ].join('\n');

    const { code } = compileSource(source, { sourcemap: false });
    const lines = code?.split('\n') ?? [];

    expect(lines).toHaveLength(5);
    expect(lines[1]).toBe('  const hint = __i18n__l[0');
    expect(lines[2]).toBe('];');
    expect(lines[3]).toBe('  return hint;');
  });

  test('runtime imports do not collide with identifiers of the file', () => {
    const { code } = compileSource(
      'const __i18n__t = 1;\nexport const label = __`Saved`;',
    );

    expect(code).toBe(
      [
        `import { __l as __i18n1__l } from '@ls-stack/i18n';const __i18n__t = 1;`,
        'export const label = __i18n1__l[0];',
      ].join('\n'),
    );
  });

  test('registers the source strings as fallbacks on the dev server', () => {
    const { code } = compileSource(
      [
        'const welcome = __`Hello ${name}, welcome back!~~formal`;',
        'const terms = __`$terms_of_service`;',
        'const sameWelcome = __`Hello ${name}, welcome back!~~formal`;',
      ].join('\n'),
      { devFallbacks: true },
    );

    expect(code?.split('\n')[0]).toBe(
      `import { __t as __i18n__t, __l as __i18n__l, __registerDevFallbacks as __i18n__registerDevFallbacks } from '@ls-stack/i18n';__i18n__registerDevFallbacks([[1,"Hello {1}, welcome back!"],[0,"…"]]);const welcome = __i18n__t(1, name);`,
    );
    expect(code).toContain('const terms = __i18n__l[0];');
  });

  test('generates source maps pointing to the original code', () => {
    const { map } = compileSource('export const label = __`Saved`;');

    expect(map?.sources).toEqual(['/app/src/Inbox.tsx']);
    expect(map?.sourcesContent).toEqual(['export const label = __`Saved`;']);
  });

  test('skips the source map when it is disabled, the code is the same', () => {
    const source = [
      'export function getInboxLabels(count: number, name: string) {',
      '  return [__`Inbox`, __p(count)`# unread messages from ${name}`];',
      '}',
    ].join('\n');

    const withMap = compileSource(source);
    const withoutMap = compileSource(source, { sourcemap: false });

    expect(withoutMap.map).toBeNull();
    expect(withoutMap.code).toBe(withMap.code);
    expect(withMap.map).not.toBeNull();
  });
});

describe('TranslationRegistry', () => {
  test('ids are deterministic regardless of the scan order', () => {
    const keys = [
      { hash: 'Remove bookmark', plural: false },
      { hash: 'Bookmarked', plural: false },
      { hash: '# members', plural: true },
      { hash: 'Bookmarked', plural: false },
    ];

    const registry = TranslationRegistry.fromKeys(keys);
    const reversedRegistry = TranslationRegistry.fromKeys([...keys].reverse());

    expect(registry.keys).toEqual([
      { hash: '# members', plural: true },
      { hash: 'Bookmarked', plural: false },
      { hash: 'Remove bookmark', plural: false },
    ]);
    expect(reversedRegistry.keys).toEqual(registry.keys);
  });

  test('the same hash used as plural and string gets different ids', () => {
    const registry = TranslationRegistry.fromKeys([
      { hash: '# members', plural: true },
      { hash: '# members', plural: false },
    ]);

    expect(registry.getId('# members', false)).toBe(0);
    expect(registry.getId('# members', true)).toBe(1);
  });

  test('new translations are appended without changing existing ids', () => {
    const registry = TranslationRegistry.fromKeys([
      { hash: 'Bookmarked', plural: false },
      { hash: 'Remove bookmark', plural: false },
    ]);

    expect(registry.add('Archive conversation', false)).toBe(2);
    expect(registry.getId('Bookmarked', false)).toBe(0);
    expect(registry.add('Bookmarked', false)).toBe(0);
    expect(registry.size).toBe(3);
  });
});

describe('stable ids', () => {
  const inboxKeys = [
    { hash: 'Bookmarked', plural: false },
    { hash: 'Direct Messages', plural: false },
    { hash: 'Remove bookmark', plural: false },
    { hash: 'You have # unread messages', plural: true },
  ];

  function getIdsOf(registry: TranslationRegistry) {
    return parseIdsFile(serializeIdsFile(registry));
  }

  test('adding a translation keeps the ids of the existing ones', () => {
    const stableIds = getIdsOf(TranslationRegistry.fromKeys(inboxKeys));

    const registry = TranslationRegistry.fromKeys(
      [...inboxKeys, { hash: 'Archive conversation', plural: false }],
      stableIds,
    );

    for (const { hash, plural } of inboxKeys) {
      expect(registry.getId(hash, plural)).toBe(
        stableIds.get(`${plural ? 'p' : 's'}:${hash}`),
      );
    }
    expect(registry.getId('Archive conversation', false)).toBe(4);
    expect(getIdsFileState(registry, stableIds)).toBe('outdated');
  });

  test('removing a translation leaves a free id compiled to 0', () => {
    const stableIds = getIdsOf(TranslationRegistry.fromKeys(inboxKeys));

    const registry = TranslationRegistry.fromKeys(
      inboxKeys.filter((key) => key.hash !== 'Direct Messages'),
      stableIds,
    );

    expect(registry.getId('Bookmarked', false)).toBe(0);
    expect(registry.getId('Remove bookmark', false)).toBe(2);
    expect(registry.getId('You have # unread messages', true)).toBe(3);
    expect(
      compileLocale(registry, {
        Bookmarked: 'Salvo',
        'Direct Messages': 'Mensagens diretas',
        'Remove bookmark': 'Remover dos salvos',
      }),
    ).toEqual(['Salvo', 0, 'Remover dos salvos', 'You have # unread messages']);
  });

  test('new translations take the free ids in hash order', () => {
    const stableIds = getIdsOf(TranslationRegistry.fromKeys(inboxKeys));
    const keys = [
      ...inboxKeys.filter((key) => key.hash !== 'Direct Messages'),
      { hash: 'Mute channel', plural: false },
      { hash: 'Archive conversation', plural: false },
    ];

    const registry = TranslationRegistry.fromKeys(keys, stableIds);
    const reversedRegistry = TranslationRegistry.fromKeys(
      [...keys].reverse(),
      stableIds,
    );

    expect(registry.getId('Archive conversation', false)).toBe(1);
    expect(registry.getId('Mute channel', false)).toBe(4);
    expect(reversedRegistry.keys).toEqual(registry.keys);
  });

  test('an id taken by translations added in two merged branches is resolved deterministically', () => {
    const base = getIdsOf(TranslationRegistry.fromKeys(inboxKeys));
    const archiveBranch = getIdsOf(
      TranslationRegistry.fromKeys(
        [...inboxKeys, { hash: 'Archive conversation', plural: false }],
        base,
      ),
    );
    const muteBranch = getIdsOf(
      TranslationRegistry.fromKeys(
        [...inboxKeys, { hash: 'Mute channel', plural: false }],
        base,
      ),
    );
    const merged = new Map([...archiveBranch, ...muteBranch]);

    expect(merged.get('s:Archive conversation')).toBe(4);
    expect(merged.get('s:Mute channel')).toBe(4);

    const mergedKeys = [
      ...inboxKeys,
      { hash: 'Mute channel', plural: false },
      { hash: 'Archive conversation', plural: false },
    ];
    const registry = TranslationRegistry.fromKeys(mergedKeys, merged);

    expect(registry.getId('Archive conversation', false)).toBe(4);
    expect(registry.getId('Mute channel', false)).toBe(5);
    expect(
      TranslationRegistry.fromKeys([...mergedKeys].reverse(), merged).keys,
    ).toEqual(registry.keys);
    // the build resolves it the same way until the file is updated
    expect(getIdsFileState(registry, merged)).toBe('duplicated-ids');
    expect(getIdsFileState(registry, getIdsOf(registry))).toBe('up-to-date');
  });

  test('an id taken by two translations is kept by the first one in the order of the file', () => {
    const merged = new Map([
      ['s:Bookmarked', 0],
      ['p:You have # unread messages', 0],
    ]);
    const keys = [
      { hash: 'You have # unread messages', plural: true },
      { hash: 'Bookmarked', plural: false },
    ];

    const registry = TranslationRegistry.fromKeys(keys, merged);

    expect(registry.getId('Bookmarked', false)).toBe(0);
    expect(registry.getId('You have # unread messages', true)).toBe(1);
    expect([...parseIdsFile(serializeIdsFile(registry)).keys()]).toEqual([
      's:Bookmarked',
      'p:You have # unread messages',
    ]);
  });

  test('the ids file lists one translation per line sorted by hash', () => {
    const registry = TranslationRegistry.fromKeys([
      { hash: 'Remove bookmark', plural: false },
      { hash: '# members', plural: true },
      { hash: 'Bookmarked', plural: false },
    ]);

    expect(serializeIdsFile(registry)).toBe(
      [
        '{',
        '  "version": 1,',
        '  "ids": {',
        '    "p:# members": 0,',
        '    "s:Bookmarked": 1,',
        '    "s:Remove bookmark": 2',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
  });

  test('invalid ids files are rejected', () => {
    expect(() => parseIdsFile('{ "ids": {} }')).toThrow('Invalid ids file');
    expect(() =>
      parseIdsFile('{ "version": 1, "ids": { "s:Bookmarked": -1 } }'),
    ).toThrow('Invalid id of "s:Bookmarked"');
    expect(() =>
      parseIdsFile('{ "version": 1, "ids": { "Bookmarked": 0 } }'),
    ).toThrow('Invalid id of "Bookmarked"');
    // would fill the locales with millions of free ids
    expect(() =>
      parseIdsFile('{ "version": 1, "ids": { "s:Bookmarked": 50000000 } }'),
    ).toThrow('Invalid id of "s:Bookmarked"');
  });
});

describe('compileLocale', () => {
  const registry = TranslationRegistry.fromKeys([
    { hash: 'Direct Messages', plural: false },
    { hash: 'Hello {1}, welcome back!~~formal', plural: false },
    { hash: 'Export as PDF', plural: false },
    { hash: '$terms_of_service', plural: false },
    { hash: 'You have # unread messages', plural: true },
    { hash: '# files in {1}', plural: true },
    { hash: '# members', plural: true },
  ]);

  test('compiles translations to an array indexed by id', () => {
    const compiled = compileLocale(registry, {
      'Direct Messages': 'Mensagens diretas',
      'Hello {1}, welcome back!~~formal': 'Seja bem-vindo novamente, {1}!',
      $terms_of_service: 'Ao usar este app você concorda com os termos.',
      'You have # unread messages': {
        zero: 'Você não tem mensagens não lidas',
        one: 'Você tem uma mensagem não lida',
        '+2': 'Você tem # mensagens não lidas',
        many: 'Você tem muitas mensagens não lidas',
        manyLimit: 99,
      },
      '# files in {1}': { one: '1 arquivo em {1}', '+2': '# arquivos em {1}' },
      'Archived conversations': 'Conversas arquivadas',
    });

    expect(compiled).toEqual([
      [0, '1 arquivo em {1}', '# arquivos em {1}'],
      '# members',
      'Ao usar este app você concorda com os termos.',
      'Mensagens diretas',
      'Export as PDF',
      'Seja bem-vindo novamente, {1}!',
      [
        'Você não tem mensagens não lidas',
        'Você tem uma mensagem não lida',
        'Você tem # mensagens não lidas',
        'Você tem muitas mensagens não lidas',
        99,
      ],
    ]);
  });

  test('applies the same fallbacks as the uncompiled runtime', () => {
    const compiled = compileLocale(registry, {
      'Direct Messages': '',
      'Hello {1}, welcome back!~~formal': null,
      'Export as PDF': { '+2': 'invalid plural' },
      'You have # unread messages': 'not a plural',
      '# files in {1}': { '+2': null, many: 'muitos', manyLimit: 0 },
    });

    expect(compiled).toEqual([
      [0, 0, '# files in {1}'],
      '# members',
      '…',
      'Direct Messages',
      'Export as PDF',
      'Hello {1}, welcome back!',
      'You have # unread messages',
    ]);
  });

  test('the compiled locale module is smaller than the source locale', () => {
    const locale = {
      'Direct Messages': 'Mensagens diretas',
      'You have # unread messages': {
        zero: 'Você não tem mensagens não lidas',
        one: 'Você tem uma mensagem não lida',
        '+2': 'Você tem # mensagens não lidas',
      },
      'Archived conversations': 'Conversas arquivadas',
    };

    const moduleCode = compileLocaleModule(registry, locale);

    expect(moduleCode.startsWith('export default JSON.parse(')).toBe(true);
    expect(moduleCode).not.toContain('Archived conversations');
    expect(moduleCode).not.toContain('Conversas arquivadas');
    expect(moduleCode).not.toContain('"Direct Messages"');
  });

  test('throws on invalid locale files', () => {
    expect(() => compileLocale(registry, ['not', 'a', 'locale'])).toThrow(
      'Invalid locale file, expected a JSON object',
    );
  });
});
