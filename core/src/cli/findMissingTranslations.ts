import ts from 'typescript';

export type TranslationLocation = {
  file: string;
  line: number;
  column: number;
};

export type TranslationUsage = {
  hash: string;
  isJsx: boolean;
  isPlural: boolean;
  hasOnlyPrimitiveInterpolations: boolean;
  locations: TranslationLocation[];
};

export type I18nUsagesResult = {
  pluralTranslations: string[];
  stringTranslations: string[];
  jsxStringTranslations: Set<string>;
  jsxPluralTranslations: Set<string>;
  primitiveOnlyJsx: Set<string>;
  usageMap: Map<string, TranslationUsage>;
};

function getHashFromTemplate(template: ts.TemplateLiteral): string | null {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return template.text;
  }

  if (ts.isTemplateExpression(template)) {
    let hash = '';

    hash += template.head.text;

    template.templateSpans.forEach((span, i) => {
      hash += `{${i + 1}}${span.literal.text}`;
    });

    return hash;
  }

  return null;
}

function isPrimitiveInterpolation(node: ts.Expression): boolean {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return true;
  }

  if (ts.isIdentifier(node)) {
    return true;
  }

  if (ts.isPropertyAccessExpression(node)) {
    return true;
  }

  if (ts.isCallExpression(node)) {
    return true;
  }

  if (ts.isConditionalExpression(node)) {
    return (
      isPrimitiveInterpolation(node.whenTrue) &&
      isPrimitiveInterpolation(node.whenFalse)
    );
  }

  if (ts.isBinaryExpression(node)) {
    return (
      isPrimitiveInterpolation(node.left) &&
      isPrimitiveInterpolation(node.right)
    );
  }

  if (ts.isParenthesizedExpression(node)) {
    return isPrimitiveInterpolation(node.expression);
  }

  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    return false;
  }

  if (ts.isJsxFragment(node)) {
    return false;
  }

  return true;
}

function hasOnlyPrimitiveInterpolations(template: ts.TemplateLiteral): boolean {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return true;
  }

  if (ts.isTemplateExpression(template)) {
    for (const span of template.templateSpans) {
      if (!isPrimitiveInterpolation(span.expression)) {
        return false;
      }
    }
    return true;
  }

  return true;
}

export function getI18nUsagesInCode(
  fileName: string,
  code: string,
): I18nUsagesResult {
  const checkFile =
    code.includes('i18n') ||
    code.includes('__`') ||
    code.includes('__p(') ||
    code.includes('__jsx`') ||
    code.includes('__pjsx(');

  if (!checkFile) {
    return {
      pluralTranslations: [],
      stringTranslations: [],
      jsxStringTranslations: new Set(),
      jsxPluralTranslations: new Set(),
      primitiveOnlyJsx: new Set(),
      usageMap: new Map(),
    };
  }

  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    undefined,
    ts.ScriptKind.TSX,
  );

  const pluralTranslations = new Set<string>();
  const stringTranslations = new Set<string>();
  const jsxStringTranslations = new Set<string>();
  const jsxPluralTranslations = new Set<string>();
  const primitiveOnlyJsx = new Set<string>();
  const usageMap = new Map<string, TranslationUsage>();

  function addUsage(
    hash: string,
    isJsx: boolean,
    isPlural: boolean,
    onlyPrimitives: boolean,
    node: ts.Node,
  ): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );

    const location: TranslationLocation = {
      file: fileName,
      line: line + 1,
      column: character + 1,
    };

    const existing = usageMap.get(hash);
    if (existing) {
      existing.locations.push(location);
      if (!onlyPrimitives) {
        existing.hasOnlyPrimitiveInterpolations = false;
      }
    } else {
      usageMap.set(hash, {
        hash,
        isJsx,
        isPlural,
        hasOnlyPrimitiveInterpolations: onlyPrimitives,
        locations: [location],
      });
    }
  }

  function checkNode(node: ts.Node) {
    if (ts.isTaggedTemplateExpression(node)) {
      const tteNode = node;

      const isTranslationFn = (id: ts.Identifier | ts.PrivateIdentifier) => {
        const name = ts.idText(id as ts.Identifier);
        return name === '__';
      };
      const isJsxTranslationFn = (id: ts.Identifier | ts.PrivateIdentifier) => {
        const name = ts.idText(id as ts.Identifier);
        return name === '__jsx';
      };
      const isPluralTranslationFn = (
        id: ts.Identifier | ts.PrivateIdentifier,
      ) => {
        const name = ts.idText(id as ts.Identifier);
        return name === '__p';
      };
      const isJsxPluralTranslationFn = (
        id: ts.Identifier | ts.PrivateIdentifier,
      ) => {
        const name = ts.idText(id as ts.Identifier);
        return name === '__pjsx';
      };

      if (
        (ts.isIdentifier(tteNode.tag) && isTranslationFn(tteNode.tag)) ||
        (ts.isPropertyAccessExpression(tteNode.tag) &&
          isTranslationFn(tteNode.tag.name))
      ) {
        const template = tteNode.template;
        const hash = getHashFromTemplate(template);

        if (hash) {
          stringTranslations.add(hash);
          addUsage(hash, false, false, true, node);
        }
      } else if (
        (ts.isIdentifier(tteNode.tag) && isJsxTranslationFn(tteNode.tag)) ||
        (ts.isPropertyAccessExpression(tteNode.tag) &&
          isJsxTranslationFn(tteNode.tag.name))
      ) {
        const template = tteNode.template;
        const hash = getHashFromTemplate(template);

        if (hash) {
          stringTranslations.add(hash);
          jsxStringTranslations.add(hash);
          const onlyPrimitives = hasOnlyPrimitiveInterpolations(template);
          if (onlyPrimitives) {
            primitiveOnlyJsx.add(hash);
          }
          addUsage(hash, true, false, onlyPrimitives, node);
        }
      } else if (ts.isCallExpression(tteNode.tag)) {
        if (
          (ts.isIdentifier(tteNode.tag.expression) &&
            isPluralTranslationFn(tteNode.tag.expression)) ||
          (ts.isPropertyAccessExpression(tteNode.tag.expression) &&
            isPluralTranslationFn(tteNode.tag.expression.name))
        ) {
          const hash = getHashFromTemplate(tteNode.template);

          if (hash) {
            pluralTranslations.add(hash);
            addUsage(hash, false, true, true, node);
          }
        } else if (
          (ts.isIdentifier(tteNode.tag.expression) &&
            isJsxPluralTranslationFn(tteNode.tag.expression)) ||
          (ts.isPropertyAccessExpression(tteNode.tag.expression) &&
            isJsxPluralTranslationFn(tteNode.tag.expression.name))
        ) {
          const hash = getHashFromTemplate(tteNode.template);

          if (hash) {
            pluralTranslations.add(hash);
            jsxPluralTranslations.add(hash);
            const onlyPrimitives = hasOnlyPrimitiveInterpolations(
              tteNode.template,
            );
            if (onlyPrimitives) {
              primitiveOnlyJsx.add(hash);
            }
            addUsage(hash, true, true, onlyPrimitives, node);
          }
        }
      }
    }

    ts.forEachChild(node, checkNode);
  }

  checkNode(sourceFile);

  return {
    pluralTranslations: Array.from(pluralTranslations),
    stringTranslations: Array.from(stringTranslations),
    jsxStringTranslations,
    jsxPluralTranslations,
    primitiveOnlyJsx,
    usageMap,
  };
}
