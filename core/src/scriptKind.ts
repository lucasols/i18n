import ts from 'typescript';

const SOURCE_FILE_REGEX = /\.[cm]?[jt]sx?$/;

/** Files without a match have no translation calls and are not parsed */
export const QUICK_CHECK_REGEX = /\b__(?:p|jsx|pjsx)?\b/;

/** Directories skipped by the CLI and the vite plugin scans, matched by name */
export const IGNORED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
]);

/** Files scanned for translations by the CLI and compiled by the vite plugin */
export function isTranslationSourceFile(fileName: string): boolean {
  return SOURCE_FILE_REGEX.test(fileName) && !fileName.endsWith('.d.ts');
}

export function getScriptKind(fileName: string): ts.ScriptKind {
  const ext = fileName.slice(fileName.lastIndexOf('.'));

  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.ts' || ext === '.mts' || ext === '.cts')
    return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}
