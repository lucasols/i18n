import path from 'path';
import type { AITranslator } from './ai-translator';
import {
  validateTranslations,
  type FileSystem,
  type Logger,
  type ValidationRuleConfig,
} from './validation';

export type VirtualFileTree = {
  [path: string]: string | VirtualFileTree;
};

export type MockLog = Logger & {
  logs: string[];
  errors: string[];
  infos: string[];
  clear: () => void;
};

function flattenTree(
  basePath: string,
  tree: VirtualFileTree,
  result: Map<string, string>,
): void {
  for (const [key, value] of Object.entries(tree)) {
    const fullPath = path.join(basePath, key);
    if (typeof value === 'string') {
      result.set(fullPath, value);
    } else {
      flattenTree(fullPath, value, result);
    }
  }
}

function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = path.normalize(parent);
  const normalizedChild = path.normalize(child);
  const relative = path.relative(normalizedParent, normalizedChild);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export function createVirtualFs(
  rootPath: string,
  tree: VirtualFileTree,
): { fs: FileSystem; getFile: (filename: string) => string | undefined } {
  const files = new Map<string, string>();
  flattenTree(rootPath, tree, files);

  const fs: FileSystem = {
    existsSync(filePath) {
      if (files.has(filePath)) return true;
      // directories exist when they contain files
      for (const file of files.keys()) {
        if (isSubPath(filePath, file)) return true;
      }
      return false;
    },
    readFileSync(filePath, _encoding) {
      const content = files.get(filePath);
      if (content === undefined) {
        throw new Error(
          `ENOENT: no such file or directory, open '${filePath}'`,
        );
      }
      return content;
    },
    writeFileSync(filePath, content) {
      files.set(filePath, content);
    },
    *scanDir(dirPath, options) {
      for (const [filePath] of files) {
        if (!isSubPath(dirPath, filePath)) continue;

        const relativePath = path.relative(
          path.normalize(dirPath),
          path.normalize(filePath),
        );
        const basename = path.basename(filePath);

        if (options.fileFilter({ path: relativePath })) {
          yield { fullPath: filePath, basename };
        }
      }
    },
  };

  return {
    fs,
    getFile(filename: string) {
      return files.get(path.join(rootPath, filename));
    },
  };
}

export function createMockLog(): MockLog {
  const logs: string[] = [];
  const errors: string[] = [];
  const infos: string[] = [];

  return {
    logs,
    errors,
    infos,
    log(...args: unknown[]) {
      logs.push(args.map(String).join(' '));
    },
    error(...args: unknown[]) {
      errors.push(args.map(String).join(' '));
    },
    info(...args: unknown[]) {
      infos.push(args.map(String).join(' '));
    },
    clear() {
      logs.length = 0;
      errors.length = 0;
      infos.length = 0;
    },
  };
}

export function createCliTestContext(fixture: {
  src: VirtualFileTree;
  config: VirtualFileTree;
  /**
   * Content of the ids file passed with `--ids-file`, `null` passes a file
   * that doesn't exist yet
   */
  idsFile?: string | null;
  /** Source of a monorepo package, scanned as a second `--src-dir` */
  packageSrc?: VirtualFileTree;
}) {
  const srcDir = '/virtual/src';
  const configDir = '/virtual/config';
  const idsFilePath = '/virtual/i18n-ids.json';
  const packageSrcDir = '/virtual/packages/ui/src';

  const { fs: srcFs, getFile: getSrcFile } = createVirtualFs(
    srcDir,
    fixture.src,
  );
  const { fs: configFs, getFile: getConfigFile } = createVirtualFs(
    configDir,
    fixture.config,
  );
  const log = createMockLog();

  if (typeof fixture.idsFile === 'string') {
    configFs.writeFileSync(idsFilePath, fixture.idsFile);
  }

  if (fixture.packageSrc) {
    const packageFiles = new Map<string, string>();
    flattenTree(packageSrcDir, fixture.packageSrc, packageFiles);

    for (const [filePath, content] of packageFiles) {
      configFs.writeFileSync(filePath, content);
    }
  }

  const combinedFs: FileSystem = {
    existsSync(filePath) {
      if (isSubPath(srcDir, filePath)) return srcFs.existsSync(filePath);
      return configFs.existsSync(filePath);
    },
    readFileSync(filePath, encoding) {
      if (isSubPath(srcDir, filePath)) {
        return srcFs.readFileSync(filePath, encoding);
      }
      return configFs.readFileSync(filePath, encoding);
    },
    writeFileSync(filePath, content) {
      if (isSubPath(srcDir, filePath)) {
        srcFs.writeFileSync(filePath, content);
      } else {
        configFs.writeFileSync(filePath, content);
      }
    },
    async *scanDir(dirPath, options) {
      if (isSubPath(srcDir, dirPath)) {
        yield* srcFs.scanDir(dirPath, options);
      } else {
        yield* configFs.scanDir(dirPath, options);
      }
    },
  };

  async function validate(options?: {
    fix?: boolean;
    defaultLocale?: string;
    aiTranslator?: AITranslator;
    rules?: ValidationRuleConfig;
    maxTranslationIdSize?: number;
    /** Scanned after the src dirs of the fixture, e.g. a misspelled dir */
    extraSrcDirs?: string[];
  }) {
    log.clear();
    const srcDirs = fixture.packageSrc ? [srcDir, packageSrcDir] : [srcDir];
    const extraSrcDirs = options?.extraSrcDirs ?? [];
    const result = await validateTranslations({
      configDir,
      srcDir:
        srcDirs.length === 1 && extraSrcDirs.length === 0 ?
          srcDir
        : [...srcDirs, ...extraSrcDirs],
      fix: options?.fix,
      defaultLocale: options?.defaultLocale,
      aiTranslator: options?.aiTranslator,
      noColor: true,
      fs: combinedFs,
      log,
      rules: options?.rules,
      maxTranslationIdSize: options?.maxTranslationIdSize,
      idsFile: fixture.idsFile === undefined ? undefined : idsFilePath,
    });

    return {
      hasError: result.hasError,
      errors: [...log.errors],
      infos: [...log.infos],
      output: [...log.errors, ...log.infos].sort(),
    };
  }

  return {
    srcDir,
    packageSrcDir,
    configDir,
    fs: combinedFs,
    log,
    validate,
    getSrcFile,
    getConfigFileRaw(filename: string): string | undefined {
      return getConfigFile(filename);
    },
    getIdsFile(): string | undefined {
      return configFs.existsSync(idsFilePath) ?
          configFs.readFileSync(idsFilePath, 'utf-8')
        : undefined;
    },
  };
}
