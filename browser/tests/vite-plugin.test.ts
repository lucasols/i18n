import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
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

function getViteConfig(root = fixtureRoot): InlineConfig {
  return {
    root,
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

/** Copy of the fixture app outside the repo, importing the runtime by its package name */
async function createFixtureCopy(): Promise<{ tmpDir: string; root: string }> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ls-stack-i18n-vite-'));
  const root = path.join(tmpDir, 'app');

  await cp(fixtureRoot, root, {
    recursive: true,
    filter: (src) => path.basename(src) !== 'dist',
  });

  const entries = await readdir(path.join(root, 'src'), {
    recursive: true,
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;

    const file = path.join(entry.parentPath, entry.name);
    const code = await readFile(file, 'utf-8');
    await writeFile(
      file,
      code.replace(/'(?:\.\.\/)+src\/main'/g, "'@ls-stack/i18n'"),
    );
  }

  return { tmpDir, root };
}

function getBuildOptions(root: string): InlineConfig['build'] {
  return {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: path.join(root, 'src/main.ts'),
      preserveEntrySignatures: 'exports-only',
      external: [/^react(\/.*)?$/],
      output: { entryFileNames: '[name].js' },
    },
  };
}

function waitForBuildEnd(watcher: Rollup.RollupWatcher): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = (event: Rollup.RollupWatcherEvent) => {
      if (event.code === 'BUNDLE_END') {
        void event.result.close();
      } else if (event.code === 'ERROR') {
        watcher.off('event', onEvent);
        reject(new Error(event.error.message, { cause: event.error }));
      } else if (event.code === 'END') {
        watcher.off('event', onEvent);
        resolve();
      }
    };

    watcher.on('event', onEvent);
  });
}

/** Reads the compiled translation used by an exported `() => __\`...\`` function */
async function readBuiltTranslation(
  root: string,
  exportName: string,
  locale: string,
): Promise<unknown> {
  const buildDir = path.join(root, 'dist');
  const main = await readFile(path.join(buildDir, 'main.js'), 'utf-8');

  const id = new RegExp(
    `function ${exportName}\\(\\) \\{\\s*return \\w+\\((\\d+)\\)`,
  ).exec(main)?.[1];
  const localeFile = new RegExp(
    `import\\("\\./(assets/${locale}-[\\w-]+\\.js)"\\)`,
  ).exec(main)?.[1];

  if (id === undefined || localeFile === undefined) {
    throw new Error(`Translation of ${exportName} not found in the build`);
  }

  const localeModule: unknown = await import(
    pathToFileURL(path.join(buildDir, localeFile)).href
  );

  if (
    typeof localeModule !== 'object' ||
    localeModule === null ||
    !('default' in localeModule) ||
    !Array.isArray(localeModule.default)
  ) {
    throw new Error(`Invalid ${locale} locale chunk`);
  }

  const compiled: unknown[] = localeModule.default;
  const translation: unknown = compiled[Number(id)];
  return translation;
}

describe('vite build of a copy of the app', { timeout: 30_000 }, () => {
  let tmpDir = '';
  let root = '';

  beforeAll(async () => {
    ({ tmpDir, root } = await createFixtureCopy());
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('translation ids stay stable on watch rebuilds', async () => {
    const watcher = await build({
      ...getViteConfig(root),
      build: { ...getBuildOptions(root), watch: {} },
    });

    if (Array.isArray(watcher) || 'output' in watcher) {
      throw new Error('Expected a watch build');
    }

    try {
      await waitForBuildEnd(watcher);

      expect(await readBuiltTranslation(root, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );

      const chatMenuFile = path.join(root, 'src/chat/chatMenu.tsx');
      const chatMenu = await readFile(chatMenuFile, 'utf-8');
      const rebuild = waitForBuildEnd(watcher);

      await writeFile(
        chatMenuFile,
        `${chatMenu}\nexport function getArchiveLabel() {\n  return __\`Archive conversation\`;\n}\n`,
      );
      await rebuild;

      expect(await readBuiltTranslation(root, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
      expect(await readBuiltTranslation(root, 'getTermsOfService', 'en')).toBe(
        'By using this app you agree to our terms of service.',
      );
      expect(await readBuiltTranslation(root, 'getArchiveLabel', 'pt')).toBe(
        'Archive conversation',
      );
    } finally {
      await watcher.close();
    }
  });

  test('compiles the locales when the root is a symlink', async () => {
    const linkRoot = path.join(tmpDir, 'app-link');
    await symlink(root, linkRoot, 'dir');

    await build({
      ...getViteConfig(linkRoot),
      build: getBuildOptions(linkRoot),
    });

    expect(await readBuiltTranslation(linkRoot, 'getExportLabel', 'pt')).toBe(
      'Export as PDF',
    );
    expect(await readBuiltTranslation(root, 'getTermsOfService', 'en')).toBe(
      'By using this app you agree to our terms of service.',
    );
  });
});
