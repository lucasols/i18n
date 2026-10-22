import {
  analyzeTranslations,
  compileLocaleModule,
  QUICK_CHECK_REGEX,
  RUNTIME_MODULE,
  transformTranslations,
  TranslationRegistry,
  type TranslationAnalysis,
  type TranslationKey,
} from '@ls-stack/i18n-core/compiler';
import { realpathSync, type Dirent, type Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
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

// hook filters skip the JS hooks for unrelated modules (vite >= 6.3), the
// handlers keep their own checks for older versions
const VIRTUAL_LOCALE_ID_REGEX = /^\0ls-stack-i18n-locale\//;
const RUNTIME_MODULE_REGEX = /^@ls-stack\/i18n$/;
const SOURCE_ID_REGEX = /\.[cm]?[jt]sx?(?:$|\?)/;
const JSON_ID_REGEX = /\.json(?:$|\?)/;

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

type WalkOptions = {
  /** Walks symlinks by their own path instead of the real path */
  preserveSymlinks: boolean;
  /** Real paths of the walked symlinked directories, prevents cycles */
  visitedDirs: Set<string>;
};

async function getStats(file: string): Promise<Stats | null> {
  try {
    return await stat(file);
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

/**
 * Walks the directory without descending into ignored directories. Symlinks
 * are followed and, like vite resolves imports, walked by their real path
 * unless `preserveSymlinks` is set.
 */
async function forEachSourceFile(
  dir: string,
  realDir: string,
  options: WalkOptions,
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
      if (IGNORED_DIRS.has(entry.name)) return;

      const fullPath = `${dir}/${entry.name}`;

      if (entry.isDirectory()) {
        await forEachSourceFile(
          fullPath,
          `${realDir}/${entry.name}`,
          options,
          callback,
        );
        return;
      }

      if (entry.isFile()) {
        if (isSourceFile(entry.name)) await callback(fullPath);
        return;
      }

      if (!entry.isSymbolicLink()) return;

      const stats = await getStats(fullPath);
      if (!stats) return;

      const target = getRealPath(fullPath);

      if (stats.isDirectory()) {
        const isCycle =
          target === realDir ||
          realDir.startsWith(`${target}/`) ||
          options.visitedDirs.has(target);

        if (isCycle) return;

        options.visitedDirs.add(target);
        await forEachSourceFile(
          options.preserveSymlinks ? fullPath : target,
          target,
          options,
          callback,
        );
      } else if (stats.isFile() && isSourceFile(entry.name)) {
        await callback(options.preserveSymlinks ? fullPath : target);
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
  let preserveSymlinks = false;
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
  /** Size and modification time of the scanned files, used on watch rebuilds */
  const scannedFiles = new Map<string, { size: number; mtimeMs: number }>();

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
    { isWatchBuild, isRebuild }: { isWatchBuild: boolean; isRebuild: boolean },
  ): Promise<void> {
    const walkOptions: WalkOptions = {
      preserveSymlinks,
      visitedDirs: new Set([getRealPath(srcRoot)]),
    };

    await forEachSourceFile(srcRoot, srcRoot, walkOptions, async (file) => {
      if (isWatchBuild) {
        const stats = await getStats(file);
        if (!stats) return;

        const previous = scannedFiles.get(file);
        scannedFiles.set(file, { size: stats.size, mtimeMs: stats.mtimeMs });

        // the registry keeps the keys of the previous builds
        if (
          isRebuild &&
          previous?.size === stats.size &&
          previous.mtimeMs === stats.mtimeMs
        ) {
          return;
        }
      }

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

  /**
   * `isWatchBuild` keeps the size and modification time of the files, so the
   * rebuilds only read the changed files
   */
  async function scanTranslations(
    isWatchBuild: boolean,
  ): Promise<TranslationRegistry> {
    analysisCache.clear();

    const keys: TranslationKey[] = [];

    const scanOptions = { isWatchBuild, isRebuild: registry !== null };

    await Promise.all([
      scanLocaleFiles(),
      ...srcRoots.map((srcRoot) => scanSourceDir(srcRoot, keys, scanOptions)),
    ]);

    // ids are kept on watch rebuilds, unchanged modules keep their cached transforms
    if (registry) {
      registry.addKeys(keys);
    } else {
      registry = TranslationRegistry.fromKeys(keys);
    }

    return registry;
  }

  function startScan(isWatchBuild = false): Promise<TranslationRegistry> {
    const scan = scanTranslations(isWatchBuild);
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

      preserveSymlinks = config.resolve.preserveSymlinks;
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

        const rescan = scanLocaleFiles();
        localeRescan = rescan;

        rescan.catch((error: unknown) => {
          if (localeRescan === rescan) localeRescan = null;

          const message =
            error instanceof Error ? error.message : String(error);
          server.config.logger.error(
            `[${PLUGIN_NAME}] Failed to scan the locale files: ${message}`,
          );
        });
      };

      server.watcher.on('add', onLocaleFilesChange);
      server.watcher.on('unlink', onLocaleFilesChange);
    },

    async buildStart() {
      await startScan(isBuild && this.meta.watchMode);

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

    resolveId: {
      filter: {
        id: [VIRTUAL_LOCALE_ID_REGEX, RUNTIME_MODULE_REGEX, /\.json$/],
      },
      async handler(source, importer, options) {
        if (source.startsWith(VIRTUAL_LOCALE_PREFIX)) return source;

        // the app must have a single runtime instance, imports from monorepo
        // packages or wrappers with their own copy would get a runtime the app
        // never configures
        if (source === RUNTIME_MODULE) {
          if (!importer) return null;

          const rootRuntime = await this.resolve(source, rootImporter, {
            ...options,
            skipSelf: true,
          });

          // packages that the app root can't resolve keep their own resolution
          return rootRuntime;
        }

        if (!importer || !source.endsWith('.json')) return null;

        const resolved = await this.resolve(source, importer, {
          ...options,
          skipSelf: true,
        });

        if (!resolved || resolved.external) return resolved;

        await waitForLocaleScan();
        const localeName = getLocaleName(removeQuery(resolved.id));

        if (localeName === null) return resolved;

        return `${VIRTUAL_LOCALE_PREFIX}${localeName}`;
      },
    },

    load: {
      filter: { id: [VIRTUAL_LOCALE_ID_REGEX, JSON_ID_REGEX] },
      async handler(id) {
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
          const message =
            error instanceof Error ? error.message : String(error);
          return this.error(`Failed to compile locale "${file}": ${message}`);
        }
      },
    },

    transform: {
      filter: {
        id: { include: SOURCE_ID_REGEX, exclude: [/^\0/, /\/node_modules\//] },
        code: QUICK_CHECK_REGEX,
      },
      async handler(code, id) {
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

        return result;
      },
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
