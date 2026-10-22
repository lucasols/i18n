import MagicString, { type SourceMap } from 'magic-string';
import ts from 'typescript';
import type {
  CompiledLocale,
  CompiledPlural,
  CompiledTranslation,
} from './types';

export const RUNTIME_MODULE = '@ls-stack/i18n';

const LOCAL_PREFIX = '__i18n';

const QUICK_CHECK_REGEX = /\b__(?:p|jsx|pjsx)?\s*[`(]/;

type Range = { start: number; end: number };

type ExprRange = Range & { wrap: boolean };

export type TranslationKey = { hash: string; plural: boolean };

export type TranslationCall = TranslationKey & {
  jsx: boolean;
  start: number;
  end: number;
  /** Range of the `__p(count)` argument */
  count: Range | null;
  exprs: ExprRange[];
};

export type TranslationAnalysis = {
  calls: TranslationCall[];
  /** Position where the runtime import can be inserted (after directives) */
  insertPos: number;
};

const emptyAnalysis: TranslationAnalysis = { calls: [], insertPos: 0 };

function getScriptKind(fileName: string): ts.ScriptKind {
  const ext = fileName.slice(fileName.lastIndexOf('.'));

  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.ts' || ext === '.mts' || ext === '.cts')
    return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function getTranslationCall(
  node: ts.TaggedTemplateExpression,
  sourceFile: ts.SourceFile,
): TranslationCall | null {
  const { tag, template } = node;

  let plural: boolean;
  let jsx: boolean;
  let count: Range | null = null;

  if (ts.isIdentifier(tag)) {
    if (tag.text === '__') {
      plural = false;
      jsx = false;
    } else if (tag.text === '__jsx') {
      plural = false;
      jsx = true;
    } else {
      return null;
    }
  } else if (
    ts.isCallExpression(tag) &&
    ts.isIdentifier(tag.expression) &&
    tag.arguments.length === 1
  ) {
    const fnName = tag.expression.text;

    if (fnName === '__p') {
      plural = true;
      jsx = false;
    } else if (fnName === '__pjsx') {
      plural = true;
      jsx = true;
    } else {
      return null;
    }

    const arg = tag.arguments[0];
    if (!arg || ts.isSpreadElement(arg)) return null;

    count = { start: arg.getStart(sourceFile), end: arg.end };
  } else {
    return null;
  }

  let hash: string;
  const exprs: ExprRange[] = [];

  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    hash = template.text;
  } else {
    hash = template.head.text;

    for (let i = 0; i < template.templateSpans.length; i++) {
      const span = template.templateSpans[i];
      if (!span) continue;

      const { expression } = span;
      hash += `{${i + 1}}${span.literal.text}`;
      exprs.push({
        start: expression.getStart(sourceFile),
        end: expression.end,
        wrap:
          ts.isBinaryExpression(expression) &&
          expression.operatorToken.kind === ts.SyntaxKind.CommaToken,
      });
    }
  }

  return {
    hash,
    plural,
    jsx,
    start: node.getStart(sourceFile),
    end: node.end,
    count,
    exprs,
  };
}

/**
 * Finds the `__`, `__p`, `__jsx` and `__pjsx` tagged template calls in the
 * source code. Only direct identifier calls are considered, member calls like
 * `i18n.__` are left untouched.
 */
export function analyzeTranslations(
  fileName: string,
  code: string,
): TranslationAnalysis {
  if (!QUICK_CHECK_REGEX.test(code)) return emptyAnalysis;

  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    false,
    getScriptKind(fileName),
  );

  const calls: TranslationCall[] = [];

  function visit(node: ts.Node): void {
    if (ts.isTaggedTemplateExpression(node)) {
      const call = getTranslationCall(node, sourceFile);
      if (call) calls.push(call);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (calls.length === 0) return emptyAnalysis;

  let insertPos = 0;
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      break;
    }
    insertPos = statement.end;
  }

  return { calls, insertPos };
}

function getRegistryKey(hash: string, plural: boolean): string {
  return plural ? `p:${hash}` : `s:${hash}`;
}

function compareKeys(a: TranslationKey, b: TranslationKey): number {
  if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
  if (a.plural === b.plural) return 0;
  return a.plural ? 1 : -1;
}

/**
 * Maps each translation (hash + kind) to a numeric id, the id is the index of
 * the translation in the compiled locales.
 */
export class TranslationRegistry {
  readonly keys: TranslationKey[] = [];
  private readonly ids = new Map<string, number>();

  /** Creates a registry with deterministic ids, sorted by hash */
  static fromKeys(keys: Iterable<TranslationKey>): TranslationRegistry {
    const registry = new TranslationRegistry();

    for (const key of [...keys].sort(compareKeys)) {
      registry.add(key.hash, key.plural);
    }

    return registry;
  }

  get size(): number {
    return this.keys.length;
  }

  getId(hash: string, plural: boolean): number | undefined {
    return this.ids.get(getRegistryKey(hash, plural));
  }

  add(hash: string, plural: boolean): number {
    const registryKey = getRegistryKey(hash, plural);
    const existingId = this.ids.get(registryKey);
    if (existingId !== undefined) return existingId;

    const id = this.keys.length;
    this.keys.push({ hash, plural });
    this.ids.set(registryKey, id);
    return id;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function getFallback(hash: string): string {
  const variantPos = hash.indexOf('~~');
  return variantPos === -1 ? hash : hash.slice(0, variantPos);
}

function compilePlural(
  value: Record<string, unknown>,
  fallback: string,
): CompiledPlural {
  const zero = getNonEmptyString(value.zero) ?? 0;
  const one = getNonEmptyString(value.one) ?? 0;
  const plus2 = getNonEmptyString(value['+2']) ?? fallback;
  const many = getNonEmptyString(value.many);
  const { manyLimit } = value;

  if (many && typeof manyLimit === 'number' && manyLimit) {
    return [zero, one, plus2, many, manyLimit];
  }

  return [zero, one, plus2];
}

/**
 * Compiles a translation value following the same fallback rules of the
 * uncompiled runtime: missing or invalid values fall back to the source
 * string, missing `$` translations are marked with `0`.
 */
export function compileTranslation(
  key: TranslationKey,
  value: unknown,
): CompiledTranslation {
  const fallback = getFallback(key.hash);

  if (value === undefined) {
    return key.hash.startsWith('$') ? 0 : fallback;
  }

  if (key.plural) {
    return isRecord(value) ? compilePlural(value, fallback) : fallback;
  }

  return getNonEmptyString(value) ?? fallback;
}

/**
 * Compiles a locale file into an array indexed by the registry ids. Unused
 * translations are dropped and missing ones are filled with the source string.
 */
export function compileLocale(
  registry: TranslationRegistry,
  locale: unknown,
): CompiledLocale {
  if (!isRecord(locale)) {
    throw new Error('Invalid locale file, expected a JSON object');
  }

  return registry.keys.map((key) =>
    compileTranslation(
      key,
      Object.hasOwn(locale, key.hash) ? locale[key.hash] : undefined,
    ),
  );
}

export function compileLocaleModule(
  registry: TranslationRegistry,
  locale: unknown,
): string {
  const json = JSON.stringify(compileLocale(registry, locale));
  return `export default JSON.parse(${JSON.stringify(json)});\n`;
}

type RuntimeFn = '__t' | '__tp' | '__tjsx' | '__tpjsx';

function getRuntimeFn(call: TranslationCall): RuntimeFn {
  if (call.plural) return call.jsx ? '__tpjsx' : '__tp';
  return call.jsx ? '__tjsx' : '__t';
}

export type TransformOptions = {
  fileName: string;
  code: string;
  analysis: TranslationAnalysis;
  getId: (call: TranslationCall) => number;
  /**
   * Registers the source string of each translation so translations added
   * after the locale was loaded still render (dev server only)
   */
  devFallbacks: boolean;
};

/**
 * Replaces the tagged template calls with id based calls, e.g.
 * `` __`Hello ${name}` `` → `__i18n__t(3, name)`
 */
export function transformTranslations({
  fileName,
  code,
  analysis,
  getId,
  devFallbacks,
}: TransformOptions): { code: string; map: SourceMap } | null {
  if (analysis.calls.length === 0) return null;

  const s = new MagicString(code);
  const usedFns = new Set<RuntimeFn>();
  const fallbacks = new Map<number, CompiledTranslation>();

  for (const call of analysis.calls) {
    const id = getId(call);
    const fn = getRuntimeFn(call);
    usedFns.add(fn);

    if (devFallbacks && !fallbacks.has(id)) {
      fallbacks.set(id, compileTranslation(call, undefined));
    }

    let cursor = call.start;
    let text = `${LOCAL_PREFIX}${fn}(${id}`;

    const preserved: ExprRange[] =
      call.count ? [{ ...call.count, wrap: false }, ...call.exprs] : call.exprs;

    for (const range of preserved) {
      text += range.wrap ? ', (' : ', ';
      s.overwrite(cursor, range.start, text);
      cursor = range.end;
      text = range.wrap ? ')' : '';
    }

    s.overwrite(cursor, call.end, `${text})`);
  }

  const specifiers = [...usedFns].map((fn) => `${fn} as ${LOCAL_PREFIX}${fn}`);

  if (devFallbacks) {
    specifiers.push(
      `__registerDevFallbacks as ${LOCAL_PREFIX}__registerDevFallbacks`,
    );
  }

  let header = `import { ${specifiers.join(', ')} } from '${RUNTIME_MODULE}';`;

  if (devFallbacks) {
    header += `${LOCAL_PREFIX}__registerDevFallbacks(${JSON.stringify([...fallbacks])});`;
  }

  s.prependLeft(
    analysis.insertPos,
    analysis.insertPos === 0 ? `${header}\n` : `\n${header}`,
  );

  return {
    code: s.toString(),
    map: s.generateMap({
      source: fileName,
      hires: 'boundary',
      includeContent: true,
    }),
  };
}
