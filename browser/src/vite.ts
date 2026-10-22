import {
  analyzeTranslations,
  compileLocaleModule,
  RUNTIME_MODULE,
  transformTranslations,
  TranslationRegistry,
  type TranslationAnalysis,
  type TranslationKey,
} from '@ls-stack/i18n-core/compiler';
import { realpathSync, type Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizePath, type Plugin, type ViteDevServer } from 'vite';

export type I18nVitePluginOptions = {
  /** Directory with the locale JSON files, relative to the vite root */
  localesDir: string;
  /**
   * Directories scanned for translations, relative to the vite root
   * @default 'src'
   */
  srcDir?: string | string[];
};

const PLUGIN_NAME = 'ls-stack-i18n';
const VIRTUAL_LOCALE_PREFIX = '\0ls-stack-i18n-locale/';
const SOURCE_FILE_REGEX = /\.[cm]?[jt]sx?$/;

function removeQuery(id: string): string {
  const queryPos = id.indexOf('?');
  return queryPos === -1 ? id : id.slice(0, queryPos);
}

function isSourceFile(file: string): boolean {
  return SOURCE_FILE_REGEX.test(file) && !file.endsWith('.d.ts');
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'EISDIR')
  );
}

/**
 * Vite resolves imports to the real path unless `preserveSymlinks` is set, the
 * native version also returns the real casing on case insensitive file systems
 */
function getRealPath(filePath: string): string {
  try {
    return normalizePath(realpathSync.native(filePath));
  } catch {
    return normalizePath(filePath);
  }
}

const IGNORED_DIRS: ReadonlySet<string> = new Set(['node_modules', '.git']);

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/** Walks the directory without descending into ignored directories */
async function forEachSourceFile(
  dir: string,
  callback: (file: string) => Promise<void>,
): Promise<void> {
  let entries: Dirent[];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = `${dir}/${entry.name}`;

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await forEachSourceFile(fullPath, callback);
        }
      } else if (entry.isFile() && isSourceFile(entry.name)) {
        await callback(fullPath);
      }
    }),
  );
}

type CachedAnalysis = { code: string; analysis: TranslationAnalysis };

/**
 * Compiles the translations at build time and on the dev server:
 * - `` __`Hello ${name}` `` calls are replaced with id based calls `__t(3, name)`
 * - locale JSON files imported by the locale loaders are compiled to arrays
 *   indexed by the translation ids, without the source strings as keys
 *
 * Must be placed before `@vitejs/plugin-react` so the React Compiler only sees
 * the compiled calls.
 */
export function i18nVitePlugin({
  localesDir,
  srcDir = 'src',
}: I18nVitePluginOptions): Plugin {
  let isBuild = false;
  /** Scanned source directories */
  let srcRoots: string[] = [];
  let localesPath = '';
  /** Configured and real paths, ids may use either */
  let srcPaths: string[] = [];
  let localesPaths: string[] = [];
  /** Real paths of symlinked locale files and their locale names */
  const localeRealPaths = new Map<string, string>();
  let devServer: ViteDevServer | null = null;
  let registry: TranslationRegistry | null = null;
  let registryPromise: Promise<TranslationRegistry> | null = null;
  /** Rescan of the locale files after files are added or removed in localesDir */
  let localeRescan: Promise<void> | null = null;
  /** Importer used to resolve the runtime from the app root */
  let rootImporter = '';
  /** Files with compiled calls, their runtime import is resolved from the app root */
  const compiledFiles = new Set<string>();

  const analysisCache = new Map<string, CachedAnalysis>();
  const loadedLocaleIds = new Set<string>();
  let localeFilesCount = 0;
  let hasCompiledCalls = false;

  async function scanLocaleFiles(): Promise<void> {
    localeRealPaths.clear();
    localeFilesCount = 0;

    let entries: string[];
    try {
      entries = await readdir(localesPath);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;

      localeFilesCount++;

      const file = `${localesPath}/${entry}`;
      const realPath = getRealPath(file);

      if (realPath !== file) {
        localeRealPaths.set(realPath, path.posix.basename(entry, '.json'));
      }
    }
  }

  async function scanSourceDir(
    srcRoot: string,
    keys: TranslationKey[],
  ): Promise<void> {
    await forEachSourceFile(srcRoot, async (file) => {
      let code: string;

      try {
        code = await readFile(file, 'utf-8');
      } catch (error) {
        if (isMissingFileError(error)) return;
        throw error;
      }

      const analysis = analyzeTranslations(file, code);

      if (analysis.calls.length === 0) return;

      analysisCache.set(file, { code, analysis });

      for (const call of analysis.calls) {
        keys.push(call);
      }
    });
  }

  async function scanTranslations(): Promise<TranslationRegistry> {
    analysisCache.clear();

    const keys: TranslationKey[] = [];

    await Promise.all([
      scanLocaleFiles(),
      ...srcRoots.map((srcRoot) => scanSourceDir(srcRoot, keys)),
    ]);

    // ids are kept on watch rebuilds, unchanged modules keep their cached transforms
    if (registry) {
      registry.addKeys(keys);
    } else {
      registry = TranslationRegistry.fromKeys(keys);
    }

    return registry;
  }

  function startScan(): Promise<TranslationRegistry> {
    const scan = scanTranslations();
    registryPromise = scan;

    scan.catch(() => {
      if (registryPromise === scan) registryPromise = null;
    });

    return scan;
  }

  function getRegistry(): Promise<TranslationRegistry> {
    return registryPromise ?? startScan();
  }

  /** Waits for the scans that find the locale files, including symlinked ones */
  async function waitForLocaleScan(): Promise<void> {
    await getRegistry();
    if (localeRescan) await localeRescan;
  }

  function isInLocalesDir(file: string): boolean {
    return (
      file.endsWith('.json') &&
      localesPaths.includes(path.posix.dirname(normalizePath(file)))
    );
  }

  function getLocaleName(file: string): string | null {
    if (!file.endsWith('.json')) return null;

    if (localesPaths.includes(path.posix.dirname(file))) {
      return path.posix.basename(file, '.json');
    }

    return localeRealPaths.get(file) ?? null;
  }

  function getAnalysis(file: string, code: string): TranslationAnalysis {
    const cached = analysisCache.get(file);

    if (cached) {
      analysisCache.delete(file);
      if (cached.code === code) return cached.analysis;
    }

    return analyzeTranslations(file, code);
  }

  function invalidateLocaleModules(): void {
    if (!devServer) return;

    for (const id of loadedLocaleIds) {
      const mod = devServer.moduleGraph.getModuleById(id);
      if (mod) devServer.moduleGraph.invalidateModule(mod);
    }
  }

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',

    configResolved(config) {
      isBuild = config.command === 'build';

      if (isBuild && config.build.lib) {
        throw new Error(
          `[${PLUGIN_NAME}] i18nVitePlugin() can't be used in library builds, the compiled translation ids only match the locales of the app build that compiled them. Use it in the app that consumes the library`,
        );
      }

      rootImporter = `${normalizePath(config.root)}/index.html`;

      const { preserveSymlinks } = config.resolve;
      const resolvePath = (dir: string): string =>
        normalizePath(path.resolve(config.root, dir));

      const configuredSrcPaths = (
        Array.isArray(srcDir) ? srcDir : [srcDir]).map(resolvePath);
      const configuredLocalesPath = resolvePath(localesDir);

      srcRoots =
        preserveSymlinks ? configuredSrcPaths : (
          configuredSrcPaths.map(getRealPath)
        );
      localesPath =
        preserveSymlinks ?
          configuredLocalesPath
        : getRealPath(configuredLocalesPath);

      srcPaths = [...new Set([...srcRoots, ...configuredSrcPaths])];
      localesPaths = [...new Set([localesPath, configuredLocalesPath])];

      const ownIndex = config.plugins.findIndex((p) => p.name === PLUGIN_NAME);
      const reactIndex = config.plugins.findIndex((p) =>
        p.name.startsWith('vite:react'),
      );

      if (reactIndex !== -1 && reactIndex < ownIndex) {
        config.logger.warn(
          `[${PLUGIN_NAME}] i18nVitePlugin() should be placed before react() in the vite plugins, so React Compiler receives the compiled translations`,
        );
      }
    },

    configureServer(server) {
      devServer = server;

      // symlinked locale files added while the server runs need their real path
      const onLocaleFilesChange = (file: string) => {
        if (!isInLocalesDir(file)) return;

        localeRescan = scanLocaleFiles();
      };

      server.watcher.on('add', onLocaleFilesChange);
      server.watcher.on('unlink', onLocaleFilesChange);
    },

    async buildStart() {
      await startScan();

      if (localeFilesCount === 0) {
        const message = `No locale JSON files found in "${localesPath}", check the localesDir option`;

        if (isBuild) this.error(message);
        else this.warn(message);
      }
    },

    buildEnd() {
      analysisCache.clear();
    },

    generateBundle() {
      if (hasCompiledCalls && loadedLocaleIds.size === 0) {
        this.warn(
          `Translations were compiled but no locale file from "${localesPath}" was imported, the locale loaders must import the JSON files from localesDir (e.g. \`() => import('./locales/pt.json')\`) or every translation renders empty`,
        );
      }
    },

    async resolveId(source, importer, options) {
      if (source.startsWith(VIRTUAL_LOCALE_PREFIX)) return source;

      // the runtime of compiled files outside the app (e.g. monorepo packages)
      // must be the same instance configured by the app
      if (
        source === RUNTIME_MODULE &&
        importer &&
        compiledFiles.has(removeQuery(importer))
      ) {
        return this.resolve(source, rootImporter, {
          ...options,
          skipSelf: true,
        });
      }

      if (!importer || !source.endsWith('.json')) return null;

      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });

      if (!resolved || resolved.external) return null;

      await waitForLocaleScan();
      const localeName = getLocaleName(removeQuery(resolved.id));

      if (localeName === null) return null;

      return `${VIRTUAL_LOCALE_PREFIX}${localeName}`;
    },

    async load(id) {
      if (!id.startsWith(VIRTUAL_LOCALE_PREFIX)) {
        if (id.startsWith('\0') || !removeQuery(id).endsWith('.json')) {
          return null;
        }

        await waitForLocaleScan();

        if (getLocaleName(removeQuery(id)) !== null) {
          const message = `Locale file "${id}" was imported without being compiled, the compiled translations render empty with it. Import it with the ".json" extension and no query, e.g. \`import('./locales/pt.json')\``;

          if (isBuild) return this.error(message);
          this.warn(message);
        }

        return null;
      }

      const file = `${localesPath}/${id.slice(VIRTUAL_LOCALE_PREFIX.length)}.json`;

      this.addWatchFile(file);
      const realPath = getRealPath(file);
      if (realPath !== file) this.addWatchFile(realPath);
      loadedLocaleIds.add(id);

      const [currentRegistry, content] = await Promise.all([
        getRegistry(),
        readFile(file, 'utf-8'),
      ]);

      try {
        // vite's JSON loader also accepts files with a BOM
        const locale: unknown = JSON.parse(stripBom(content));
        return compileLocaleModule(currentRegistry, locale);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return this.error(`Failed to compile locale "${file}": ${message}`);
      }
    },

    async transform(code, id) {
      if (id.startsWith('\0') || id.includes('/node_modules/')) return null;

      const file = removeQuery(id);

      if (!isSourceFile(file)) return null;

      const analysis = getAnalysis(file, code);

      if (analysis.calls.length === 0) return null;

      hasCompiledCalls = true;
      const currentRegistry = await getRegistry();
      const sizeBefore = currentRegistry.size;
      const isInSrcDir = srcPaths.some((dir) => file.startsWith(`${dir}/`));

      const result = transformTranslations({
        fileName: file,
        code,
        analysis,
        devFallbacks: !isBuild,
        getId: (call) => {
          const translationId = currentRegistry.getId(call.hash, call.plural);
          if (translationId !== undefined) return translationId;

          if (isBuild) {
            return this.error(
              `Translation "${call.hash}" was not found when scanning "${srcRoots.join('", "')}", check the srcDir option`,
              call.start,
            );
          }

          if (!isInSrcDir) {
            this.warn(
              `Translation "${call.hash}" is outside of "${srcRoots.join('", "')}" and will fail in the build, check the srcDir option`,
              call.start,
            );
          }

          return currentRegistry.add(call.hash, call.plural);
        },
      });

      if (currentRegistry.size !== sizeBefore) invalidateLocaleModules();

      compiledFiles.add(file);
      return result;
    },

    handleHotUpdate({ file, server }) {
      const localeName = getLocaleName(file);

      if (localeName === null) return;

      const mod = server.moduleGraph.getModuleById(
        `${VIRTUAL_LOCALE_PREFIX}${localeName}`,
      );

      if (!mod) return;

      // a hot update would keep the loaded translations of the active locale,
      // `setLocale` doesn't reload the locale that is already loaded
      server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
