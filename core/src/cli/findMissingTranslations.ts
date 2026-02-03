import ts from 'typescript';

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

export function getI18nUsagesInCode(
  fileName: string,
  code: string,
): {
  pluralTranslations: string[];
  stringTranslations: string[];
} {
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

  function checkNode(node: ts.Node) {
    if (ts.isTaggedTemplateExpression(node)) {
      const tteNode = node;

      const isTranslationFn = (id: ts.Identifier | ts.PrivateIdentifier) => {
        const name = ts.idText(id as ts.Identifier);
        return name === '__' || name === '__jsx';
      };
      const isPluralTranslationFn = (id: ts.Identifier | ts.PrivateIdentifier) => {
        const name = ts.idText(id as ts.Identifier);
        return name === '__p' || name === '__pjsx';
      };

      if (
        (ts.isIdentifier(tteNode.tag) && isTranslationFn(tteNode.tag)) ||
        (ts.isPropertyAccessExpression(tteNode.tag) &&
          isTranslationFn(tteNode.tag.name))
      ) {
        const template = tteNode.template;

        const hash = getHashFromTemplate(template);

        if (hash) stringTranslations.add(hash);
      } else if (ts.isCallExpression(tteNode.tag)) {
        if (
          (ts.isIdentifier(tteNode.tag.expression) &&
            isPluralTranslationFn(tteNode.tag.expression)) ||
          (ts.isPropertyAccessExpression(tteNode.tag.expression) &&
            isPluralTranslationFn(tteNode.tag.expression.name))
        ) {
          const hash = getHashFromTemplate(tteNode.template);

          if (hash) pluralTranslations.add(hash);
        }
      }
    }

    ts.forEachChild(node, checkNode);
  }

  checkNode(sourceFile);

  return {
    pluralTranslations: Array.from(pluralTranslations),
    stringTranslations: Array.from(stringTranslations),
  };
}
