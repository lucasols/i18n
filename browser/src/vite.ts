import {
  analyzeTranslations,
  compileLocaleModule,
  transformTranslations,
  TranslationRegistry,
  type TranslationAnalysis,
  type TranslationKey,
} from '@ls-stack/i18n-core/compiler';
import { realpathSync } from 'node:fs';
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

/** Vite resolves imports to the real path unless `preserveSymlinks` is set */
function getRealPath(filePath: string): string {
  try {
    return normalizePath(realpathSync(filePath));
  } catch {
    return normalizePath(filePath);
  }
}

function isIgnoredDir(relativePath: string): boolean {
  return relativePath
    .split(path.sep)
    .some((segment) => segment === 'node_modules' || segment.startsWith('.'));
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

  const analysisCache = new Map<string, CachedAnalysis>();
  const loadedLocaleIds = new Set<string>();

  async function scanLocaleFiles(): Promise<void> {
    localeRealPaths.clear();

    let entries: string[];
    try {
      entries = await readdir(localesPath);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;

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
    const entries = await readdir(srcRoot, {
      recursive: true,
      withFileTypes: true,
    });

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile() || !isSourceFile(entry.name)) return;

        const fullPath = path.join(entry.parentPath, entry.name);

        if (isIgnoredDir(path.relative(srcRoot, fullPath))) return;

        const file = normalizePath(fullPath);
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
      }),
    );
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
    },

    async buildStart() {
      await startScan();
    },

    buildEnd() {
      analysisCache.clear();
    },

    async resolveId(source, importer, options) {
      if (source.startsWith(VIRTUAL_LOCALE_PREFIX)) return source;

      if (!importer || !source.endsWith('.json')) return null;

      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });

      if (!resolved || resolved.external) return null;

      // the scan also finds the symlinked locale files
      await getRegistry();
      const localeName = getLocaleName(removeQuery(resolved.id));

      if (localeName === null) return null;

      return `${VIRTUAL_LOCALE_PREFIX}${localeName}`;
    },

    async load(id) {
      if (!id.startsWith(VIRTUAL_LOCALE_PREFIX)) return null;

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
        const locale: unknown = JSON.parse(content);
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

    handleHotUpdate({ file, modules, server }) {
      const localeName = getLocaleName(file);

      if (localeName === null) return;

      const mod = server.moduleGraph.getModuleById(
        `${VIRTUAL_LOCALE_PREFIX}${localeName}`,
      );

      if (!mod) return;

      server.moduleGraph.invalidateModule(mod);
      return [...modules, mod];
    },
  };
}
