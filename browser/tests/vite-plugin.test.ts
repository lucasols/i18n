import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
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
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { i18nVitePlugin, type I18nVitePluginOptions } from '../src/vite';

const fixtureRoot = path.join(import.meta.dirname, 'fixtures/vite-app');
const outDir = path.join(fixtureRoot, 'dist');
const runtimeEntry = path.join(import.meta.dirname, '../src/main.ts');
const isCaseInsensitiveFs = existsSync(path.join(fixtureRoot, 'LOCALES'));

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

function getViteConfig(
  root = fixtureRoot,
  pluginOptions: Partial<I18nVitePluginOptions> = {},
): InlineConfig {
  return {
    root,
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        {
          find: /^@ls-stack\/i18n$/,
          replacement: runtimeEntry,
        },
      ],
    },
    plugins: [i18nVitePlugin({ localesDir: 'locales', ...pluginOptions })],
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

async function withFixtureCopy(
  run: (root: string) => Promise<void>,
): Promise<void> {
  const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

  try {
    await run(copyRoot);
  } finally {
    await rm(copyDir, { recursive: true, force: true });
  }
}

async function replaceInFile(
  file: string,
  search: string,
  replacement: string,
): Promise<void> {
  const content = await readFile(file, 'utf-8');
  if (!content.includes(search)) throw new Error(`"${search}" not in ${file}`);
  await writeFile(file, content.replaceAll(search, replacement));
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

/**
 * Writes the file and waits for the rebuild. The file watchers are set up
 * asynchronously after the first build, so the write is repeated if the
 * rebuild doesn't start.
 */
async function writeAndWaitForRebuild(
  watcher: Rollup.RollupWatcher,
  file: string,
  content: string,
): Promise<void> {
  const rebuild = waitForBuildEnd(watcher);
  const rebuildState = { started: false };
  const onStart = (event: Rollup.RollupWatcherEvent) => {
    if (event.code === 'START') rebuildState.started = true;
  };

  watcher.on('event', onStart);

  try {
    for (let attempt = 0; !rebuildState.started && attempt < 10; attempt++) {
      await writeFile(file, content);
      await Promise.race([
        rebuild,
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  } finally {
    watcher.off('event', onStart);
  }

  await rebuild;
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

      await writeAndWaitForRebuild(
        watcher,
        chatMenuFile,
        `${chatMenu}\nexport function getArchiveLabel() {\n  return __\`Archive conversation\`;\n}\n`,
      );

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

  test('scans multiple source directories', async () => {
    const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

    try {
      const sharedDir = path.join(copyDir, 'packages/ui');
      await cp(
        path.join(copyRoot, 'src/legal.ts'),
        path.join(sharedDir, 'legal.ts'),
      );
      await rm(path.join(copyRoot, 'src/legal.ts'));

      const mainFile = path.join(copyRoot, 'src/main.ts');
      const main = await readFile(mainFile, 'utf-8');
      await writeFile(
        mainFile,
        main.replace("'./legal'", "'../../packages/ui/legal'"),
      );

      await build({
        ...getViteConfig(copyRoot, { srcDir: ['src', '../packages/ui'] }),
        build: getBuildOptions(copyRoot),
      });

      expect(
        await readBuiltTranslation(copyRoot, 'getTermsOfService', 'en'),
      ).toBe('By using this app you agree to our terms of service.');
      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
    } finally {
      await rm(copyDir, { recursive: true, force: true });
    }
  });

  test('compiles symlinked locale files', async () => {
    const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

    try {
      const sharedLocale = path.join(copyDir, 'translations/pt.json');
      await cp(path.join(copyRoot, 'locales/pt.json'), sharedLocale);
      await rm(path.join(copyRoot, 'locales/pt.json'));
      await symlink(sharedLocale, path.join(copyRoot, 'locales/pt.json'));

      await build({
        ...getViteConfig(copyRoot),
        build: getBuildOptions(copyRoot),
      });

      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
    } finally {
      await rm(copyDir, { recursive: true, force: true });
    }
  });

  test('scans symlinked source files and directories', async () => {
    const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

    try {
      const sharedDir = path.join(copyDir, 'shared');
      await mkdir(sharedDir, { recursive: true });
      await cp(
        path.join(copyRoot, 'src/legal.ts'),
        path.join(sharedDir, 'legal.ts'),
      );
      await cp(path.join(copyRoot, 'src/chat'), path.join(sharedDir, 'chat'), {
        recursive: true,
      });
      await rm(path.join(copyRoot, 'src/legal.ts'));
      await rm(path.join(copyRoot, 'src/chat'), { recursive: true });
      await symlink(
        path.join(sharedDir, 'legal.ts'),
        path.join(copyRoot, 'src/legal.ts'),
      );
      await symlink(
        path.join(sharedDir, 'chat'),
        path.join(copyRoot, 'src/chat'),
        'dir',
      );
      // links back to srcDir and to the linked directory must not loop the scan
      await symlink(
        path.join(copyRoot, 'src'),
        path.join(sharedDir, 'chat/src'),
        'dir',
      );
      await symlink(
        path.join(sharedDir, 'chat'),
        path.join(sharedDir, 'chat/chat'),
        'dir',
      );

      await build({
        ...getViteConfig(copyRoot),
        build: getBuildOptions(copyRoot),
      });

      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );

      const assets = await readdir(path.join(copyRoot, 'dist/assets'));
      const ptChunk = assets.find((file) => /^pt-[\w-]+\.js$/.test(file));
      if (!ptChunk) throw new Error('pt locale chunk not found');

      const ptLocale = await readFile(
        path.join(copyRoot, 'dist/assets', ptChunk),
        'utf-8',
      );
      expect(ptLocale).toContain('Mensagens diretas');
    } finally {
      await rm(copyDir, { recursive: true, force: true });
    }
  });

  test('skips broken and looping symlinks in the source directory', async () => {
    const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

    try {
      // left behind by a removed workspace package
      await symlink(
        path.join(copyDir, 'removed-package/index.ts'),
        path.join(copyRoot, 'src/removed.ts'),
      );
      await symlink(
        path.join(copyRoot, 'src/loop-b'),
        path.join(copyRoot, 'src/loop-a'),
        'dir',
      );
      await symlink(
        path.join(copyRoot, 'src/loop-a'),
        path.join(copyRoot, 'src/loop-b'),
        'dir',
      );

      await build({
        ...getViteConfig(copyRoot),
        build: getBuildOptions(copyRoot),
      });

      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
    } finally {
      await rm(copyDir, { recursive: true, force: true });
    }
  });

  test('a wrapper package with its own copy of the runtime uses the runtime of the app', async () => {
    const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

    try {
      // `packages/i18n` sets up the locales of the app, but its own
      // `@ls-stack/i18n` dependency resolves to a different copy
      const wrapperDir = path.join(copyDir, 'packages/i18n');
      const runtimeCopy = path.join(wrapperDir, 'runtime-copy.ts');
      await mkdir(wrapperDir, { recursive: true });
      await writeFile(
        runtimeCopy,
        "export function i18nitialize() {\n  return 'wrapper runtime copy';\n}\n",
      );
      await writeFile(
        path.join(wrapperDir, 'index.ts'),
        (
          await readFile(path.join(copyRoot, 'src/i18n.ts'), 'utf-8')
        ).replaceAll("'../locales/", "'../../app/locales/"),
      );
      await writeFile(
        path.join(copyRoot, 'src/i18n.ts'),
        "export { i18n } from '../../packages/i18n/index';\n",
      );

      const wrapperDirs = [wrapperDir, await realpath(wrapperDir)];
      const config = getViteConfig(copyRoot);

      await build({
        ...config,
        resolve: {},
        plugins: [
          ...(config.plugins ?? []),
          {
            name: 'workspace-dependencies',
            resolveId(source, importer) {
              if (source !== '@ls-stack/i18n' || !importer) return null;

              const isWrapper = wrapperDirs.some((dir) =>
                importer.startsWith(`${dir}/`),
              );

              return isWrapper ? runtimeCopy : runtimeEntry;
            },
          },
        ],
        build: getBuildOptions(copyRoot),
      });

      const main = await readFile(path.join(copyRoot, 'dist/main.js'), 'utf-8');
      expect(main).not.toContain('wrapper runtime copy');
      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
    } finally {
      await rm(copyDir, { recursive: true, force: true });
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

  test('fails the build when localesDir has no locale files', async () => {
    await expect(
      build({
        ...getViteConfig(root, { localesDir: 'src/locales' }),
        build: getBuildOptions(root),
      }),
    ).rejects.toThrow('No locale JSON files found');
  });

  test('fails the build when a locale is imported without the .json extension', async () => {
    await withFixtureCopy(async (copyRoot) => {
      await replaceInFile(
        path.join(copyRoot, 'src/i18n.ts'),
        "import('../locales/pt.json')",
        "import('../locales/pt')",
      );

      await expect(
        build({ ...getViteConfig(copyRoot), build: getBuildOptions(copyRoot) }),
      ).rejects.toThrow('was imported without being compiled');
    });
  });

  test('warns when translations are compiled but no locale file is imported', async () => {
    await withFixtureCopy(async (copyRoot) => {
      const i18nFile = path.join(copyRoot, 'src/i18n.ts');
      await replaceInFile(
        i18nFile,
        "() => import('../locales/en.json')",
        'async () => ({ default: {} })',
      );
      await replaceInFile(
        i18nFile,
        "() => import('../locales/pt.json')",
        'async () => ({ default: {} })',
      );

      const warnings: string[] = [];
      const buildOptions = getBuildOptions(copyRoot);

      await build({
        ...getViteConfig(copyRoot),
        build: {
          ...buildOptions,
          rollupOptions: {
            ...buildOptions?.rollupOptions,
            onwarn: (warning) => {
              warnings.push(warning.message);
            },
          },
        },
      });

      expect(
        warnings.some((warning) => warning.includes('no locale file from')),
      ).toBe(true);
    });
  });

  test('compiles locale files with a UTF-8 BOM', async () => {
    await withFixtureCopy(async (copyRoot) => {
      const ptFile = path.join(copyRoot, 'locales/pt.json');

      await replaceInFile(
        ptFile,
        '"Direct Messages": "Mensagens diretas",',
        '"Direct Messages": "Mensagens diretas",\n  "Export as PDF": "Exportar como PDF",',
      );
      await writeFile(ptFile, `\uFEFF${await readFile(ptFile, 'utf-8')}`);

      await build({
        ...getViteConfig(copyRoot),
        build: getBuildOptions(copyRoot),
      });

      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Exportar como PDF',
      );
    });
  });

  test('scans files inside dot directories of srcDir', async () => {
    await withFixtureCopy(async (copyRoot) => {
      await mkdir(path.join(copyRoot, 'src/.generated'));
      await writeFile(
        path.join(copyRoot, 'src/.generated/labels.ts'),
        "import { __ } from '@ls-stack/i18n';\n\nexport function getGeneratedLabel() {\n  return __`Generated label`;\n}\n",
      );
      await writeFile(
        path.join(copyRoot, 'src/main.ts'),
        `${await readFile(path.join(copyRoot, 'src/main.ts'), 'utf-8')}export * from './.generated/labels';\n`,
      );

      await build({
        ...getViteConfig(copyRoot),
        build: getBuildOptions(copyRoot),
      });

      expect(
        await readBuiltTranslation(copyRoot, 'getGeneratedLabel', 'pt'),
      ).toBe('Generated label');
    });
  });

  test('compiled packages outside the app use the runtime of the app', async () => {
    const { tmpDir: copyDir, root: copyRoot } = await createFixtureCopy();

    try {
      // `packages/i18n` re-exports the translation functions and is the only
      // package, besides the app, that depends on `@ls-stack/i18n`
      const wrapperDir = path.join(copyDir, 'packages/i18n');
      const uiDir = path.join(copyDir, 'packages/ui');
      await mkdir(wrapperDir, { recursive: true });
      await mkdir(uiDir, { recursive: true });
      await writeFile(
        path.join(wrapperDir, 'index.ts'),
        "export { __ } from '@ls-stack/i18n';\n",
      );
      await writeFile(
        path.join(uiDir, 'legal.ts'),
        (await readFile(path.join(copyRoot, 'src/legal.ts'), 'utf-8')).replace(
          "'@ls-stack/i18n'",
          "'../i18n/index'",
        ),
      );
      await rm(path.join(copyRoot, 'src/legal.ts'));
      await replaceInFile(
        path.join(copyRoot, 'src/main.ts'),
        "'./legal'",
        "'../../packages/ui/legal'",
      );

      const dependentDirs = await Promise.all(
        [copyRoot, wrapperDir].map(async (dir) => [dir, await realpath(dir)]),
      );
      const config = getViteConfig(copyRoot, {
        srcDir: ['src', '../packages/ui'],
      });

      await build({
        ...config,
        resolve: {},
        plugins: [
          {
            name: 'workspace-dependencies',
            enforce: 'pre',
            resolveId(source, importer) {
              if (source !== '@ls-stack/i18n' || !importer) return null;

              const hasDependency = dependentDirs
                .flat()
                .some((dir) => importer.startsWith(`${dir}/`));

              return hasDependency ? runtimeEntry : null;
            },
          },
          ...(config.plugins ?? []),
        ],
        build: getBuildOptions(copyRoot),
      });

      expect(
        await readBuiltTranslation(copyRoot, 'getTermsOfService', 'en'),
      ).toBe('By using this app you agree to our terms of service.');
      expect(await readBuiltTranslation(copyRoot, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
    } finally {
      await rm(copyDir, { recursive: true, force: true });
    }
  });

  test.skipIf(!isCaseInsensitiveFs)(
    'compiles the locales when the localesDir casing differs from the disk',
    async () => {
      await build({
        ...getViteConfig(root, { localesDir: 'Locales' }),
        build: getBuildOptions(root),
      });

      expect(await readBuiltTranslation(root, 'getExportLabel', 'pt')).toBe(
        'Export as PDF',
      );
    },
  );

  test('fails in library builds', async () => {
    await expect(
      build({
        ...getViteConfig(root),
        build: {
          ...getBuildOptions(root),
          lib: { entry: path.join(root, 'src/main.ts'), formats: ['es'] },
        },
      }),
    ).rejects.toThrow("i18nVitePlugin() can't be used in library builds");
  });
});

describe('vite dev server file changes', { timeout: 30_000 }, () => {
  let tmpDir = '';
  let root = '';
  let server: ViteDevServer;

  beforeAll(async () => {
    ({ tmpDir, root } = await createFixtureCopy());
    server = await createServer({
      ...getViteConfig(root),
      appType: 'custom',
      server: { middlewareMode: true, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
    });
  });

  afterAll(async () => {
    await server.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('compiles symlinked locale files added while the server runs', async () => {
    const importer = path.join(root, 'src/i18n.ts');

    expect(
      (await server.pluginContainer.resolveId('../locales/pt.json', importer))
        ?.id,
    ).toBe('\0ls-stack-i18n-locale/pt');

    const sharedLocale = path.join(tmpDir, 'translations/es.json');
    const localeLink = path.join(root, 'locales/es.json');
    await mkdir(path.dirname(sharedLocale));
    await writeFile(sharedLocale, '{ "Export as PDF": "Exportar a PDF" }\n');
    await symlink(sharedLocale, localeLink);
    server.watcher.emit('add', localeLink);

    expect(
      (await server.pluginContainer.resolveId('../locales/es.json', importer))
        ?.id,
    ).toBe('\0ls-stack-i18n-locale/es');
  });

  test('editing a locale file reloads the page', async () => {
    const app = await server.ssrLoadModule('/src/main.ts');
    if (!isFixtureApp(app)) throw new Error('Invalid dev app');
    await app.i18n.setLocale('pt');

    const ptLocaleModule = server.moduleGraph.getModuleById(
      '\0ls-stack-i18n-locale/pt',
    );
    expect(ptLocaleModule?.ssrTransformResult).toBeTruthy();

    const send = vi.spyOn(server.ws, 'send');
    const ptFile = path.join(root, 'locales/pt.json');
    await replaceInFile(ptFile, 'Mensagens diretas', 'Conversas diretas');
    server.watcher.emit('change', ptFile);

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
    });
    expect(ptLocaleModule?.ssrTransformResult).toBeNull();

    send.mockRestore();
  });
});
