import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Children, isValidElement, type ReactNode } from 'react';
import {
  build,
  createServer,
  type InlineConfig,
  type Rollup,
  type ViteDevServer,
} from 'vite';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { i18nVitePlugin } from '../src/vite';

const fixtureRoot = path.join(import.meta.dirname, 'fixtures/vite-app');
const outDir = path.join(fixtureRoot, 'dist');

type FixtureApp = typeof import('./fixtures/vite-app/src/main');

const fixtureExports = [
  'i18n',
  'getChatMenuLabels',
  'getUnreadLabel',
  'getWelcomeMessage',
  'getMemberLink',
  'getFilesLabel',
  'getChannelSummary',
  'getTermsOfService',
  'getExportLabel',
] as const satisfies (keyof FixtureApp)[];

function isFixtureApp(value: unknown): value is FixtureApp {
  return (
    typeof value === 'object' &&
    value !== null &&
    fixtureExports.every((key) => key in value)
  );
}

function getViteConfig(): InlineConfig {
  return {
    root: fixtureRoot,
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        {
          find: /^@ls-stack\/i18n$/,
          replacement: path.join(import.meta.dirname, '../src/main.ts'),
        },
      ],
    },
    plugins: [i18nVitePlugin({ localesDir: 'locales' })],
  };
}

function renderToText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);

  if (!isValidElement<{ children?: ReactNode }>(node)) return '';

  const children = Children.toArray(node.props.children)
    .map(renderToText)
    .join('');

  return typeof node.type === 'string' ?
      `<${node.type}>${children}</${node.type}>`
    : children;
}

function collectMessages(app: FixtureApp) {
  return {
    chatMenu: app.getChatMenuLabels(),
    unread: [0, 1, 5, 100].map((count) => app.getUnreadLabel(count)),
    welcome: app.getWelcomeMessage('Ana', false),
    formalWelcome: app.getWelcomeMessage('Ana', true),
    memberLink: renderToText(app.getMemberLink('Ana')),
    files: [0, 1, 3].map((count) =>
      renderToText(app.getFilesLabel(count, 'Docs')),
    ),
    channel: app.getChannelSummary('#general', 12),
    terms: app.getTermsOfService(),
    exportLabel: app.getExportLabel(),
  };
}

const expectedEnMessages = {
  chatMenu: [
    'Direct Messages',
    'You have no direct messages',
    'Bookmarked',
    'You have no bookmarked conversations',
    'Remove bookmark',
  ],
  unread: [
    'You have no unread messages',
    'You have one unread message',
    'You have 5 unread messages',
    'You have a lot of unread messages',
  ],
  welcome: 'Hello Ana, welcome back!',
  formalWelcome: 'Hello Ana, welcome back!',
  memberLink: 'Message <strong>Ana</strong> directly',
  files: [
    '0 files in <em>Docs</em>',
    '1 file in <em>Docs</em>',
    '3 files in <em>Docs</em>',
  ],
  channel: '#general has 12 members',
  terms: 'By using this app you agree to our terms of service.',
  exportLabel: 'Export as PDF',
};

const expectedPtMessages = {
  chatMenu: [
    'Mensagens diretas',
    'Você não tem mensagens diretas',
    'Salvos',
    'Você não tem conversas salvas',
    'Remover dos salvos',
  ],
  unread: [
    'Você não tem mensagens não lidas',
    'Você tem uma mensagem não lida',
    'Você tem 5 mensagens não lidas',
    'Você tem muitas mensagens não lidas',
  ],
  welcome: 'Olá Ana, bem-vindo de volta!',
  formalWelcome: 'Seja bem-vindo novamente, Ana!',
  memberLink: 'Enviar mensagem direta para <strong>Ana</strong>',
  files: [
    'Nenhum arquivo em <em>Docs</em>',
    '1 arquivo em <em>Docs</em>',
    '3 arquivos em <em>Docs</em>',
  ],
  channel: '#general tem 12 membros',
  terms: '…',
  exportLabel: 'Export as PDF',
};

const englishSourceStrings = [
  'Direct Messages',
  'You have no direct messages',
  'You have no bookmarked conversations',
  'Remove bookmark',
  'You have one unread message',
  'welcome back!',
  'Message {1} directly',
  'files in {1}',
  '# members',
  '$terms_of_service',
  'Export as PDF',
];

test('uncompiled fixture app renders the expected messages', async () => {
  const app = await import('./fixtures/vite-app/src/main');

  await app.i18n.setLocale('en');
  expect(collectMessages(app)).toEqual(expectedEnMessages);

  await app.i18n.setLocale('pt');
  expect(collectMessages(app)).toEqual(expectedPtMessages);
});

describe('vite build', { timeout: 30_000 }, () => {
  let chunks: Rollup.OutputChunk[] = [];

  function getChunk(name: string): Rollup.OutputChunk {
    const chunk = chunks.find((c) => c.name === name);
    if (!chunk) throw new Error(`Chunk "${name}" not found`);
    return chunk;
  }

  beforeAll(async () => {
    const result = await build({
      ...getViteConfig(),
      build: {
        outDir,
        emptyOutDir: true,
        rollupOptions: {
          input: path.join(fixtureRoot, 'src/main.ts'),
          preserveEntrySignatures: 'exports-only',
          external: [/^react(\/.*)?$/],
          output: { entryFileNames: '[name].js' },
        },
      },
    });

    const outputs = Array.isArray(result) ? result : [result];

    for (const output of outputs) {
      if (!('output' in output)) continue;

      for (const item of output.output) {
        if (item.type === 'chunk') chunks.push(item);
      }
    }
  });

  afterAll(async () => {
    chunks = [];
    await rm(outDir, { recursive: true, force: true });
  });

  test('app code does not contain the source strings or tagged templates', () => {
    const appChunks = chunks.filter((c) => c.name !== 'en' && c.name !== 'pt');

    expect(appChunks.length).toBeGreaterThan(0);

    for (const chunk of appChunks) {
      for (const sourceString of englishSourceStrings) {
        expect(chunk.code).not.toContain(sourceString);
      }
      expect(chunk.code).not.toMatch(/__(p|jsx|pjsx)?(\([^)]*\))?`/);
    }
  });

  test('each locale is a separate chunk without translation keys', async () => {
    const ptChunk = getChunk('pt');
    const enChunk = getChunk('en');

    expect(ptChunk.code).toContain('Mensagens diretas');
    for (const sourceString of [
      'You have no direct messages',
      'You have no bookmarked conversations',
      'Remove bookmark',
      'welcome back!',
    ]) {
      expect(ptChunk.code).not.toContain(sourceString);
    }

    expect(enChunk.code).toContain('You have no bookmarked conversations');
    expect(enChunk.code).not.toContain('Mensagens diretas');

    const ptSource = await readFile(
      path.join(fixtureRoot, 'locales/pt.json'),
      'utf-8',
    );
    expect(ptChunk.code.length).toBeLessThan(ptSource.length * 0.7);
  });

  test('unused translations are dropped', () => {
    const ptChunk = getChunk('pt');

    expect(ptChunk.code).not.toContain('Archived conversations');
    expect(ptChunk.code).not.toContain('Conversas arquivadas');
  });

  test('built app renders the same messages as the uncompiled runtime', async () => {
    const app: unknown = await import(
      pathToFileURL(path.join(outDir, 'main.js')).href
    );

    if (!isFixtureApp(app)) throw new Error('Invalid built app');

    expect(app.getExportLabel()).toBe('');

    await app.i18n.setLocale('en');
    expect(collectMessages(app)).toEqual(expectedEnMessages);

    await app.i18n.setLocale('pt');
    expect(collectMessages(app)).toEqual(expectedPtMessages);
  });
});

describe('vite dev server', { timeout: 30_000 }, () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      ...getViteConfig(),
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true },
    });
  });

  afterAll(async () => {
    await server.close();
  });

  test('transforms the translations before other plugins run', async () => {
    const result = await server.transformRequest('/src/chat/chatMenu.tsx');

    expect(result?.code).not.toMatch(/__(p|jsx|pjsx)?(\([^)]*\))?`/);
    expect(result?.code).toContain('__i18n__t(');
    expect(result?.code).toContain('__i18n__tpjsx(');
    expect(result?.code).toContain('__i18n__registerDevFallbacks(');
  });

  test('keeps directives at the top of the file', async () => {
    const result = await server.transformRequest('/src/legal.ts');

    expect(result?.code.trimStart().startsWith('"use client"')).toBe(true);
  });

  test('app renders the same messages as the uncompiled runtime', async () => {
    const app = await server.ssrLoadModule('/src/main.ts');

    if (!isFixtureApp(app)) throw new Error('Invalid dev app');

    await app.i18n.setLocale('en');
    expect(collectMessages(app)).toEqual(expectedEnMessages);

    await app.i18n.setLocale('pt');
    expect(collectMessages(app)).toEqual(expectedPtMessages);
  });

  test('translations added while the server is running get new ids and fallbacks', async () => {
    const file = path.join(fixtureRoot, 'src/chat/chatMenu.tsx');
    const ptLocaleModule = server.moduleGraph.getModuleById(
      '\0ls-stack-i18n-locale/pt',
    );

    expect(ptLocaleModule?.ssrTransformResult).toBeTruthy();

    const result = await server.pluginContainer.transform(
      `export const archiveLabel = __\`Archive conversation\`;`,
      file,
    );

    const match = /__i18n__t\((\d+)\)/.exec(result.code);
    const newId = Number(match?.[1]);

    expect(newId).toBe(14);
    expect(result.code).toMatch(
      /__i18n__registerDevFallbacks\(\[\[14,\s*"Archive conversation"\]\]\)/,
    );
    expect(ptLocaleModule?.ssrTransformResult).toBeNull();
  });
});
