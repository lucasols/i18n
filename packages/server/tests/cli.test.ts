import { runCmd } from '@ls-stack/utils/runShellCmd';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { expect, test } from 'vitest';

const rootDir = path.resolve(import.meta.dirname, '../../..');

async function run({
  fixConfigs,
  defaultLocale,
}: {
  fixConfigs?: boolean;
  defaultLocale?: string;
} = {}) {
  const cliPath = path.join(rootDir, 'packages/server/src/cli.ts');
  const { out, error } = await runCmd(
    rootDir,
    [
      'pnpm',
      'exec',
      'tsx',
      '--no-warnings',
      cliPath,
      '--config-dir',
      path.join(rootDir, 'cli-test/config'),
      '--src-dir',
      path.join(rootDir, 'cli-test/src'),
      '--no-color',
      fixConfigs ? '--fix' : '',
      defaultLocale ? `--default` : '',
      defaultLocale ?? '',
    ].filter(Boolean),
    { silent: true },
  );

  return {
    out: out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    error,
  };
}

function getPtConfig() {
  return readFileSync(path.join(rootDir, 'cli-test/config/pt.json'), 'utf-8');
}

function getEnConfig() {
  return readFileSync(path.join(rootDir, 'cli-test/config/en.json'), 'utf-8');
}

function updateConfigFiles({
  pt,
  en,
}: {
  pt: Record<string, unknown>;
  en: Record<string, unknown>;
}) {
  writeFileSync(
    path.join(rootDir, 'cli-test/config/pt.json'),
    JSON.stringify(pt, null, 2),
  );
  writeFileSync(
    path.join(rootDir, 'cli-test/config/en.json'),
    JSON.stringify(en, null, 2),
  );
}

test('missing translations error', async () => {
  updateConfigFiles({
    pt: {
      'Hello World': 'Olá Mundo',
    },
    en: {},
  });

  const out = await run();

  expect(out).toMatchInlineSnapshot(`
    {
      "error": true,
      "out": [
        "❌ en.json has invalid translations: missing 7",
        "❌ pt.json has invalid translations: missing 6",
      ],
    }
  `);
});

test('fix missing translations', async () => {
  updateConfigFiles({
    pt: {
      'Hello World': 'Olá Mundo',
    },
    en: {},
  });

  const out = await run({ fixConfigs: true });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": false,
      "out": [
        "🟠 en.json translations keys were added",
        "🟠 pt.json translations keys were added",
      ],
    }
  `);

  expect(getEnConfig()).toMatchInlineSnapshot(`
    "{
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "Hello World": null,
      "Hello {1}": null,
      "Hello {1} {2}": null,
      "Hello World~~2": null,
      "Imported usage": null,
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);

  expect(getPtConfig()).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "👇 missing translations 👇": "🛑 delete this line 🛑",
      "Hello {1}": null,
      "Hello {1} {2}": null,
      "Hello World~~2": null,
      "Imported usage": null,
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

const ptCorrectTranslations = {
  'Hello World': 'Olá Mundo',
  'Hello {1}': 'Olá {1}',
  'Hello {1} {2}': 'Olá {1} {2}',
  'Hello World~~2': 'Olá Mundo~~2',
  'Imported usage': 'Uso importado',
  '# Hello World': {
    zero: 'Nenhuma x',
    one: '1 x',
    '+2': '# x',
    many: 'Muitas x',
    manyLimit: 50,
  },
  '# Hello {1}': {
    zero: 'Nenhuma x',
    one: '1 x',
    '+2': '# x',
    many: 'Muitas x',
    manyLimit: 50,
  },
};

const enCorrectTranslations = {
  'Hello World': 'Hello World',
  'Hello {1}': 'Hello {1}',
  'Hello {1} {2}': 'Hello {1} {2}',
  'Hello World~~2': 'Hello World~~2',
  'Imported usage': 'Imported usage',
  '# Hello World': {
    zero: 'No x',
    one: '1 x',
    '+2': '# x',
    many: 'A lot of x',
    manyLimit: 50,
  },
  '# Hello {1}': {
    zero: 'No x',
    one: '1 x',
    '+2': '# x',
    many: 'A lot of x',
    manyLimit: 50,
  },
};

test('correct translations', async () => {
  updateConfigFiles({
    pt: ptCorrectTranslations,
    en: enCorrectTranslations,
  });

  const out = await run();

  expect(out).toMatchInlineSnapshot(`
    {
      "error": false,
      "out": [
        "✅ en.json translations are up to date",
        "✅ pt.json translations are up to date",
      ],
    }
  `);
});

test('extra translations error', async () => {
  updateConfigFiles({
    pt: {
      ...ptCorrectTranslations,
      'Extra translation': 'Extra translation',
    },
    en: {
      ...enCorrectTranslations,
      'Extra translation': 'Extra translation',
    },
  });

  const out = await run();

  expect(out).toMatchInlineSnapshot(`
    {
      "error": true,
      "out": [
        "❌ en.json has invalid translations: extra 1",
        "❌ pt.json has invalid translations: extra 1",
      ],
    }
  `);
});

test('fix extra translations', async () => {
  updateConfigFiles({
    pt: {
      ...ptCorrectTranslations,
      'Extra translation': 'Extra translation',
    },
    en: {
      ...enCorrectTranslations,
      'Extra translation': 'Extra translation',
    },
  });

  const out = await run({ fixConfigs: true });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": false,
      "out": [
        "✅ en.json translations fixed",
        "✅ pt.json translations fixed",
      ],
    }
  `);

  expect(getEnConfig()).toMatchInlineSnapshot(`
    "{
      "Hello World": "Hello World",
      "Hello {1}": "Hello {1}",
      "Hello {1} {2}": "Hello {1} {2}",
      "Hello World~~2": "Hello World~~2",
      "Imported usage": "Imported usage",
      "# Hello World": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "No x",
        "one": "1 x",
        "+2": "# x",
        "many": "A lot of x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);

  expect(getPtConfig()).toMatchInlineSnapshot(`
    "{
      "Hello World": "Olá Mundo",
      "Hello {1}": "Olá {1}",
      "Hello {1} {2}": "Olá {1} {2}",
      "Hello World~~2": "Olá Mundo~~2",
      "Imported usage": "Uso importado",
      "# Hello World": {
        "zero": "Nenhuma x",
        "one": "1 x",
        "+2": "# x",
        "many": "Muitas x",
        "manyLimit": 50
      },
      "# Hello {1}": {
        "zero": "Nenhuma x",
        "one": "1 x",
        "+2": "# x",
        "many": "Muitas x",
        "manyLimit": 50
      },
      "": ""
    }"
  `);
});

test('invalid plural translations error', async () => {
  updateConfigFiles({
    pt: {
      ...ptCorrectTranslations,
      '# Hello World': 'Invalid plural',
    },
    en: enCorrectTranslations,
  });

  const out = await run();

  expect(out).toMatchInlineSnapshot(`
    {
      "error": true,
      "out": [
        "✅ en.json translations are up to date",
        "❌ pt.json has invalid plural translations:  [ '# Hello World' ]",
      ],
    }
  `);
});

test('fix invalid plural translations', async () => {
  const out = await run({ fixConfigs: true });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": false,
      "out": [
        "✅ en.json translations are up to date",
        "🟠 pt.json translations keys were added",
      ],
    }
  `);
});

test('missing and extra translations errors', async () => {
  updateConfigFiles({
    pt: {
      ...ptCorrectTranslations,
      'Hello World': undefined,
      'Extra translation': 'Extra translation',
    },
    en: {
      ...enCorrectTranslations,
      'Imported usage': undefined,
      'Extra translation': 'Extra translation',
    },
  });

  const out = await run();

  expect(out).toMatchInlineSnapshot(`
    {
      "error": true,
      "out": [
        "❌ en.json has invalid translations: missing 1, extra 1",
        "❌ pt.json has invalid translations: missing 1, extra 1",
      ],
    }
  `);
});

test('default locale null translations error', async () => {
  updateConfigFiles({
    pt: ptCorrectTranslations,
    en: {
      ...enCorrectTranslations,
      'Hello World': null,
    },
  });

  const out = await run({ defaultLocale: 'en' });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": true,
      "out": [
        "❌ en.json has invalid translations: extra 1",
        "✅ pt.json translations are up to date",
      ],
    }
  `);
});

test('fix default locale null translations', async () => {
  const out = await run({ fixConfigs: true, defaultLocale: 'en' });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": false,
      "out": [
        "✅ en.json translations fixed",
        "✅ pt.json translations are up to date",
      ],
    }
  `);
});

test('undefined default locale translations should not return error', async () => {
  updateConfigFiles({
    pt: ptCorrectTranslations,
    en: {
      ...enCorrectTranslations,
      'Hello World': undefined,
    },
  });

  const out = await run({ defaultLocale: 'en' });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": false,
      "out": [
        "✅ en.json translations are up to date",
        "✅ pt.json translations are up to date",
      ],
    }
  `);
});

test('undefined plural translations should return error in default locale too', async () => {
  updateConfigFiles({
    en: {
      ...ptCorrectTranslations,
      '# Hello World': undefined,
    },
    pt: enCorrectTranslations,
  });

  const out = await run({ defaultLocale: 'pt' });

  expect(out).toMatchInlineSnapshot(`
    {
      "error": true,
      "out": [
        "❌ en.json has invalid translations: missing 1",
        "✅ pt.json translations are up to date",
      ],
    }
  `);
});
