import MagicString, { type SourceMap } from 'magic-string';
import ts from 'typescript';
import { getScriptKind } from './scriptKind';
import type {
  CompiledLocale,
  CompiledPlural,
  CompiledTranslation,
} from './types';

export const RUNTIME_MODULE = '@ls-stack/i18n';

const LOCAL_PREFIX = '__i18n';

const QUICK_CHECK_REGEX = /\b__(?:p|jsx|pjsx)?\b/;

type TranslationFn = '__' | '__p' | '__jsx' | '__pjsx';

const TRANSLATION_FNS: ReadonlySet<string> = new Set<TranslationFn>([
  '__',
  '__p',
  '__jsx',
  '__pjsx',
]);

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

type FoundCall = { fnName: string; call: TranslationCall };

function getTranslationCall(
  node: ts.TaggedTemplateExpression,
  sourceFile: ts.SourceFile,
): FoundCall | null {
  const { tag, template } = node;

  let fnName: string;
  let plural: boolean;
  let jsx: boolean;
  let count: Range | null = null;

  if (ts.isIdentifier(tag)) {
    fnName = tag.text;

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
    fnName = tag.expression.text;

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
    fnName,
    call: {
      hash,
      plural,
      jsx,
      start: node.getStart(sourceFile),
      end: node.end,
      count,
      exprs,
    },
  };
}

/** Name of a local (non import) declaration, e.g. `const { __ } = i18n` */
function getLocalDeclarationName(node: ts.Node): string | null {
  if (
    (ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassExpression(node)) &&
    node.name &&
    ts.isIdentifier(node.name)
  ) {
    return node.name.text;
  }

  return null;
}

function isFunctionScope(node: ts.Node): boolean {
  return (
    ts.isFunctionLike(node) ||
    ts.isSourceFile(node) ||
    ts.isModuleBlock(node) ||
    ts.isClassStaticBlockDeclaration(node)
  );
}

function isBlockScope(node: ts.Node): boolean {
  return (
    isFunctionScope(node) ||
    ts.isBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isCatchClause(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node)
  );
}

/** Body of a function, `var` declarations are scoped to it, not to the parameters */
function getFunctionBody(node: ts.Node): ts.Block | null {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)) &&
    node.body &&
    ts.isBlock(node.body)
  ) {
    return node.body;
  }

  return null;
}

function findScope(
  ancestors: ts.Node[],
  fromIndex: number,
  isScope: (node: ts.Node) => boolean,
): ts.Node | null {
  for (let i = fromIndex; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor && isScope(ancestor)) return ancestor;
  }

  return ancestors[0] ?? null;
}

/**
 * Returns the node whose scope contains the declaration, `ancestors` is the
 * path from the source file to the declaration parent.
 */
function getDeclarationScope(
  node: ts.Node,
  ancestors: ts.Node[],
): ts.Node | null {
  // the name of a named function or class expression is only visible inside it
  if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) return node;

  let declaration = node;
  let parentIndex = ancestors.length - 1;

  // destructured names are declared by the enclosing variable or parameter
  while (
    ts.isBindingElement(declaration) ||
    ts.isObjectBindingPattern(declaration) ||
    ts.isArrayBindingPattern(declaration)
  ) {
    const parent = ancestors[parentIndex];
    if (!parent) return null;

    declaration = parent;
    parentIndex--;
  }

  const parent = ancestors[parentIndex];

  if (ts.isParameter(declaration)) return parent ?? null;

  if (ts.isVariableDeclaration(declaration)) {
    if (!parent) return null;
    if (ts.isCatchClause(parent)) return parent;
    if (!ts.isVariableDeclarationList(parent)) return null;

    const isBlockScoped = (parent.flags & ts.NodeFlags.BlockScoped) !== 0;

    if (isBlockScoped) {
      return findScope(ancestors, parentIndex - 1, isBlockScope);
    }

    const functionScope = findScope(
      ancestors,
      parentIndex - 1,
      isFunctionScope,
    );

    return functionScope && (getFunctionBody(functionScope) ?? functionScope);
  }

  return findScope(ancestors, parentIndex, isBlockScope);
}

/**
 * Finds the `__`, `__p`, `__jsx` and `__pjsx` tagged template calls in the
 * source code. Only direct identifier calls are considered, member calls like
 * `i18n.__` and calls inside a scope that declares its own `__` (e.g.
 * `const { __ } = i18n`) are left untouched.
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

  const foundCalls = new Map<ts.Node, FoundCall>();
  /** Scope nodes and the translation function names they declare */
  const shadowingScopes = new Map<ts.Node, string[]>();
  const ancestors: ts.Node[] = [];

  function collect(node: ts.Node): void {
    if (ts.isTaggedTemplateExpression(node)) {
      const found = getTranslationCall(node, sourceFile);
      if (found) foundCalls.set(node, found);
    } else {
      const declarationName = getLocalDeclarationName(node);

      if (declarationName && TRANSLATION_FNS.has(declarationName)) {
        const scope = getDeclarationScope(node, ancestors);

        if (scope) {
          const names = shadowingScopes.get(scope);
          if (names) names.push(declarationName);
          else shadowingScopes.set(scope, [declarationName]);
        }
      }
    }

    ancestors.push(node);
    ts.forEachChild(node, collect);
    ancestors.pop();
  }

  collect(sourceFile);

  const calls: TranslationCall[] = [];

  if (shadowingScopes.size === 0) {
    for (const { call } of foundCalls.values()) calls.push(call);
  } else {
    // declarations are hoisted, so a second pass skips the calls inside their scopes
    const shadowed = new Map<string, number>();

    function collectUnshadowed(node: ts.Node): void {
      const found = foundCalls.get(node);

      if (found && !shadowed.get(found.fnName)) calls.push(found.call);

      const names = shadowingScopes.get(node);

      if (names) {
        for (const name of names)
          shadowed.set(name, (shadowed.get(name) ?? 0) + 1);
      }

      ts.forEachChild(node, collectUnshadowed);

      if (names) {
        for (const name of names)
          shadowed.set(name, (shadowed.get(name) ?? 1) - 1);
      }
    }

    collectUnshadowed(sourceFile);
  }

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
    registry.addKeys(keys);
    return registry;
  }

  /** Appends the new keys sorted by hash, existing ids are kept */
  addKeys(keys: Iterable<TranslationKey>): void {
    for (const key of [...keys].sort(compareKeys)) {
      this.add(key.hash, key.plural);
    }
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

/** Prefix of the runtime imports that doesn't collide with the file identifiers */
function getLocalPrefix(code: string): string {
  let prefix = LOCAL_PREFIX;

  for (let i = 1; code.includes(prefix); i++) {
    prefix = `${LOCAL_PREFIX}${i}`;
  }

  return prefix;
}

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
  const localPrefix = getLocalPrefix(code);
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
    let text = `${localPrefix}${fn}(${id}`;

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

  const specifiers = [...usedFns].map((fn) => `${fn} as ${localPrefix}${fn}`);

  if (devFallbacks) {
    specifiers.push(
      `__registerDevFallbacks as ${localPrefix}__registerDevFallbacks`,
    );
  }

  let header = `import { ${specifiers.join(', ')} } from '${RUNTIME_MODULE}';`;

  if (devFallbacks) {
    header += `${localPrefix}__registerDevFallbacks(${JSON.stringify([...fallbacks])});`;
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
