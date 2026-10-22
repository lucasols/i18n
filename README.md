# @ls-stack/i18n

A lightweight, type-safe internationalization (i18n) library for TypeScript/JavaScript applications.

## Features

- **Type-safe** - Full TypeScript support with strict typing
- **Two packages** - Server-side (sync) and Browser/React (async)
- **Tagged templates** - Natural syntax with template literals
- **Pluralization** - Built-in plural form support with `#` placeholder
- **Interpolation** - Dynamic values with `{1}`, `{2}` placeholders
- **Variants** - Alternative translations with `~~variant` suffix
- **Formatters** - Locale-aware date, number, currency, and list formatting
- **CLI tool** - Scan code and validate translation files
- **Lazy loading** - Async locale loading with retry logic (browser)
- **Persistence** - localStorage support for locale preference (browser)
- **Vite plugin** - Compiles translations to numeric ids for smaller bundles and faster lookups (browser)

## Installation

```bash
# Server-side
pnpm add @ls-stack/server-i18n

# Browser/React
pnpm add @ls-stack/i18n
```

## Quick Start

### Server-side

```typescript
import { i18nitialize } from '@ls-stack/server-i18n';

const i18n = i18nitialize({
  locales: {
    en: {
      // Default locale: only declare advanced translations (plurals, etc.)
      // Simple strings use the source as fallback automatically
      '# items': { zero: 'no items', one: '1 item', '+2': '# items' },
    },
    pt: {
      // Non-default locales: declare all translations
      hello: 'olá',
      'hello {1}': 'olá {1}',
      '# items': { zero: 'nenhum item', one: '1 item', '+2': '# itens' },
    },
  },
});

const ptI18n = i18n.with('pt');

ptI18n`hello`; // "olá"
ptI18n`hello ${'world'}`; // "olá world"
```

### Browser/React

```typescript
import { i18nitialize, __, __p } from '@ls-stack/i18n';

const controller = i18nitialize({
  locales: [
    { id: 'en', loader: () => import('./locales/en.json') },
    { id: 'pt', loader: () => import('./locales/pt.json') },
  ],
  persistenceKey: 'app-locale',
  fallbackLocale: 'en',
});

// Load a locale
await controller.setLocale('pt');

// Use translations
__`hello`; // "olá"
__`hello ${'world'}`; // "olá world"
```

## Translation Format

Translations are stored as JSON objects mapping hashes (source strings) to translated values.

**Key principle:** The default locale uses source strings as keys. For simple translations, the fallback behavior returns the source string itself, so you only need to declare:

- **Default locale:** Plural forms and other advanced translations that can't rely on fallback
- **Other locales:** All translations

### Simple Translations

```json
{
  "hello": "olá",
  "hello {1}": "olá {1}",
  "my name is {1} and i am {2}": "meu nome é {1} e tenho {2} anos"
}
```

The hash is the source template literal. Placeholders `{1}`, `{2}`, etc. correspond to interpolated values in order.

### Plural Translations

Use `#` as a placeholder for the count, and define plural forms:

```json
{
  "# apples": {
    "zero": "no apples",
    "one": "one apple",
    "+2": "# apples",
    "many": "many apples",
    "manyLimit": 10
  }
}
```

| Key         | Description                                      |
| ----------- | ------------------------------------------------ |
| `zero`      | When count is 0                                  |
| `one`       | When count is 1                                  |
| `+2`        | When count is 2 or more (use `#` for the number) |
| `many`      | When count exceeds `manyLimit`                   |
| `manyLimit` | Threshold for using `many` form                  |

```typescript
__p(0)`# apples`; // "no apples"
__p(1)`# apples`; // "one apple"
__p(5)`# apples`; // "5 apples"
__p(15)`# apples`; // "many apples" (manyLimit: 10)
```

### Translation Variants

Create alternative translations by appending `~~variant`:

```json
{
  "hello {1}": "hello {1}",
  "hello {1}~~formal": "good day, {1}"
}
```

```typescript
__`hello ${'John'}`; // "hello John"
__`hello ${'John'}~~formal`; // "good day, John"
```

If a variant isn't found, it falls back to the base translation.

### Large Translations (`$` prefix)

For large translations where the source string shouldn't be shown as fallback, prefix with `$`:

```typescript
// In your code
__`$terms_of_service`;
__`$privacy_policy`;

// Shows "…" while loading or if translation is missing
// Shows the actual translation once loaded
```

This is useful for:

- Large blocks of text (terms, policies, descriptions)
- Translations where the ID is a key, not readable text
- Preventing long fallback strings from appearing in the UI

## Server Package (`@ls-stack/server-i18n`)

Synchronous i18n for server-side applications.

### API

#### `i18nitialize(options)`

Creates an i18n factory.

```typescript
const i18n = i18nitialize({
  locales: {
    en: {
      /* translations */
    },
    pt: {
      /* translations */
    },
  },
});
```

Returns `{ with(localeId): I18n }`.

#### `I18n` Methods

```typescript
const __ = i18n.with('pt');

// Simple translation
__`hello`;
__`hello ${'world'}`;

// Plural translation
__.__p(5)`# items`;
```

## Browser Package (`@ls-stack/i18n`)

Async i18n for browser and React applications.

### Initialization

```typescript
import { i18nitialize, __, __p, __jsx, __pjsx } from '@ls-stack/i18n';

const controller = i18nitialize({
  locales: [
    { id: 'en', loader: () => import('./locales/en.json') },
    { id: 'pt', loader: () => import('./locales/pt.json') },
  ],
  persistenceKey: 'my-app-locale',
  fallbackLocale: ['auto', 'en'], // Auto-detect, fallback to 'en'
  retryAttempts: 3, // Retry failed loads (default: 3)
  retryDelay: 1000, // Retry delay in ms (default: 1000)
});
```

### Controller Methods

| Method                    | Description                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `setLocale(id \| 'auto')` | Load and activate a locale. Returns `Promise<boolean>`, `false` when it used the fallback locale or a newer selection replaced it |
| `getLoadedLocale()`       | Get the currently loaded locale ID                                                                                                |
| `getRegionLocale()`       | Get the region-specific locale (e.g., `'en-US'`)                                                                                  |
| `onLoad(callback)`        | Subscribe to locale load events. Returns unsubscribe function                                                                     |
| `useLoadedLocale()`       | React hook for locale state                                                                                                       |

### Global Functions

#### `__(strings, ...values)`

Simple translation with interpolation.

```typescript
__`hello`; // Translated string
__`hello ${'world'}`; // With interpolation
```

#### `__p(count)(strings, ...values)`

Plural translation.

```typescript
__p(0)`# items`; // "no items"
__p(1)`# items`; // "one item"
__p(5)`# items`; // "5 items"
```

#### `__jsx(strings, ...values)`

Translation with JSX interpolation.

```typescript
__jsx`click ${{
  here: <a href="/page">here</a>
}} to continue`;
// Returns: ["click ", <a href="/page">here</a>, " to continue"]
```

#### `__pjsx(count)(strings, ...values)`

Plural translation with JSX interpolation.

```typescript
__pjsx(5)`you have # ${{
  messages: <strong>messages</strong>
}}`;
```

### Formatters

All formatters are locale-aware and use the region locale for formatting.

#### `__date(date, format?)`

Format dates using `Intl.DateTimeFormat`.

```typescript
__date(new Date()); // Default format
__date(new Date(), { dateStyle: 'full' }); // Custom options
__date('2024-01-15'); // Accepts date strings
```

#### `__num(number, options?)`

Format numbers using `Intl.NumberFormat`.

```typescript
__num(1234.56); // "1,234.56" (en) or "1.234,56" (pt)
__num(0.75, { style: 'percent' }); // "75%"
__num(99.99, { style: 'currency', currency: 'USD' }); // "$99.99"
```

#### `__relativeTime(value, unit?, format?)`

Format relative time using `Intl.RelativeTimeFormat`.

```typescript
__relativeTime({ from: pastDate, to: new Date() }); // Auto unit
__relativeTime({ from: pastDate }, 'day'); // Specific unit
__relativeTime({ from: pastDate }, 'auto', { numeric: 'auto' }); // "yesterday"
```

#### `__relativeTimeFromNow(date, options?)`

Calculate and format relative time from now.

```typescript
__relativeTimeFromNow(pastDate); // "2 hours ago"
__relativeTimeFromNow(pastDate, {
  useDateForLongerDiffs: { dateStyle: 'medium' },
  longDiffDaysThreshold: 7, // Use date format after 7 days
});
```

#### `__timeDuration(value)`

Get duration with auto-detected unit.

```typescript
__timeDuration({ from: startDate, to: endDate });
// Returns: { formatted: "5 hours", unit: "hour" }

__timeDuration({ ms: 3600000 }); // From milliseconds
```

#### `__list(items, options?)`

Format lists using `Intl.ListFormat`.

```typescript
__list(['apple', 'banana', 'orange']);
// "apple, banana, and orange" (en)
// "apple, banana e orange" (pt)

__list(['A', 'B'], { type: 'disjunction' }); // "A or B"
```

#### `__formattedTimeDuration(duration, options?)`

Format time durations using `Intl.DurationFormat`.

```typescript
__formattedTimeDuration({ hours: 2, minutes: 30 });
// "2h 30min" (narrow) or "2 hours, 30 minutes" (long)

__formattedTimeDuration(
  { days: 1, hours: 5 },
  {
    style: 'long',
    maxUnitsToShow: 2,
  },
);
```

### React Integration

#### `useLoadedLocale()` Hook

```tsx
function App() {
  const { isLoading, loadError, loadedLocale } = controller.useLoadedLocale();

  if (isLoading) {
    return <div>Loading {isLoading.locale}...</div>;
  }

  if (loadError) {
    return <div>Failed to load: {loadError.message}</div>;
  }

  return <div>{__`welcome`}</div>;
}
```

#### `onLoad()` Subscriber

```typescript
const unsubscribe = controller.onLoad((locale) => {
  console.log(`Loaded locale: ${locale}`);
});

// Later: unsubscribe();
```

### Auto Locale Detection

Set `fallbackLocale` to `['auto', defaultLocale]` to auto-detect from browser:

```typescript
i18nitialize({
  locales: [...],
  fallbackLocale: ['auto', 'en'],
});
```

The library checks `navigator.languages` and matches against configured locales.

### Vite Plugin

The vite plugin compiles the translations of the app, in both build and dev server:

- Translation calls are replaced by numeric id calls, so the source strings are removed from the app code and lookups are array accesses instead of building and hashing the source string on every call:

  ```tsx
  __`Hello ${name}`; // → __t(3, name)
  __p(count)`You have # messages`; // → __tp(7, count)
  __jsx`Click ${(<a />)}`; // → __tjsx(2, <a />)
  ```

- Locale files imported by the locale loaders are compiled to arrays indexed by the translation ids. Translation keys and translations not used by the `srcDir` source files are removed and missing translations are filled with the source string, so each user only downloads the strings of their own locale. Strings used anywhere in `srcDir`, including tests and stories, are kept.
- The output has no tagged templates, which keeps the components compatible with the React Compiler.

```ts
// vite.config.ts
import { i18nVitePlugin } from '@ls-stack/i18n/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // must be placed before react() so the React Compiler sees the compiled calls
    i18nVitePlugin({ localesDir: 'src/locales', srcDir: 'src' }),
    react(),
  ],
});
```

| Option       | Default | Description                                                                                                                                          |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localesDir` |         | Directory of the locale JSON files, relative to the vite root                                                                                        |
| `srcDir`     | `src`   | Directory, or list of directories, scanned for translations at startup, relative to the root (e.g. `['src', '../../packages/ui/src']` in a monorepo) |
| `idsFile`    |         | File with the translation ids of the previous builds, relative to the root, see [Stable translation ids](#stable-translation-ids)                    |

Behavior differences from the uncompiled runtime:

- The default locale strings are moved from the code into the default locale chunk, so translations return an empty string until a locale is loaded. Use `useLoadedLocale()` to render after the locale loads (see [Rendering with the React Compiler](#rendering-with-the-react-compiler)).
- Locale files must only be imported by the locale loaders, a static `import en from './locales/en.json'` also receives the compiled array.
- Every locale loader must import a JSON file from `localesDir` with the `.json` extension, no query and no import attributes, e.g. `() => import('./locales/pt.json')`. Loaders with import attributes, like `import('./locales/pt.json', { with: { type: 'json' } })`, are not supported. A locale loaded another way (e.g. `fetch` or an inline object) can't be read by the compiled calls, so translations render empty and an error is logged. The build fails when `localesDir` has no locale files or a locale file is imported without the extension or with a query, and warns when translations were compiled but no locale file was imported.
- Every imported `__`, `__p`, `__jsx` and `__pjsx`, directly or re-exported from a local module, is assumed to be the `@ls-stack/i18n` one. Don't import other translators (e.g. a `@ls-stack/server-i18n` instance) under these names in code compiled by the plugin, locally declared bindings with these names are left untouched.
- Only direct calls of `__`, `__p`, `__jsx` and `__pjsx` are compiled. Member calls like `i18n.__`, aliased imports, calls inside a scope that declares its own `__` (e.g. `const { __ } = i18n`) code in `node_modules` and translations in files compiled to JS by other plugins (e.g. `.mdx`, `.vue` or `.svelte`) are left untouched. Those calls can't be translated with a compiled locale, they render the source string and an error is logged.
- In the build, every translation must be inside `srcDir` (`node_modules` and `.git` directories are not scanned), translations outside it fail the build. Symlinked files and directories inside `srcDir` are scanned too. On the dev server, translations added while the server is running get new ids and render the source string until the locale file is updated.
- Without an `idsFile`, ids are assigned in the sorted order of the translations, so adding or removing a string changes the ids of the strings after it. The compiled calls change in most chunks, so a deploy that touches a string also changes the hash of most app chunks and returning users download them again. Use [stable translation ids](#stable-translation-ids) to avoid it.
- The plugin is for app builds only, the compiled ids only match the locales of the build that compiled them, so library builds (`build.lib`) fail. Packages of a monorepo should be compiled by the app that uses them (add their directories to `srcDir`), every `@ls-stack/i18n` import, including the ones of wrapper packages that call `i18nitialize`, is resolved from the app root so all of them share the runtime configured by the app (imports the app root can't resolve keep the normal resolution).
- On the dev server, editing a locale file reloads the page, so the active locale is loaded again with the new translations.

#### Stable translation ids

With an `idsFile`, the ids of the translations are kept across builds, so adding or removing a string only changes the chunks that use it, the locale chunks and the chunks that import the locale loaders (the module that calls `i18nitialize`, usually the entry). The file is committed with the code and updated by the CLI together with the locale files.

By default vite bundles the runtime into the entry chunk, which also imports the locale chunks, so every lazy loaded chunk that uses a translation imports the entry and changes with it. Put the runtime in its own chunk with `i18nRuntimeChunk`, so only the entry changes:

```ts
// vite.config.ts
import { i18nRuntimeChunk, i18nVitePlugin } from '@ls-stack/i18n/vite';

export default defineConfig({
  plugins: [
    i18nVitePlugin({ localesDir: 'src/locales', idsFile: 'i18n-ids.json' }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // returns 'i18n-runtime' for the runtime modules, undefined otherwise
          return i18nRuntimeChunk(id);
        },
      },
    },
  },
});
```

Call it first from an existing `manualChunks` and fall back to your own chunks when it returns `undefined`. Chunking only changes when `i18nRuntimeChunk` is used.

Chunks that import other modules of the entry chunk, like the `i18n` controller returned by `i18nitialize`, still change with every locale change.

```bash
# creates or updates the ids file with the translations of srcDir
ls-stack-i18n --config-dir ./src/locales --src-dir ./src --fix --ids-file i18n-ids.json

# with a srcDir list, repeat --src-dir for each directory
ls-stack-i18n --config-dir ./src/locales --src-dir ./src --src-dir ../../packages/ui/src --fix --ids-file i18n-ids.json

# fails when the ids file is outdated, e.g. in CI
ls-stack-i18n --config-dir ./src/locales --src-dir ./src --ids-file i18n-ids.json
```

```json
{
  "version": 1,
  "ids": {
    "s:Direct Messages": 0,
    "s:Hello {1}": 1,
    "p:You have # unread messages": 2
  }
}
```

- Each translation keeps its id. New translations take the ids freed by the removed ones, the chunks that used a removed string change anyway, so the ids stay compact without renumbering.
- The plugin only reads the file, builds never write to disk. A build with an outdated or missing file still works and warns: the translations missing from the file take free ids, so the file only affects which chunks change in the next builds.
- The file has one translation per line, sorted by source string (`s:` for `__`/`__jsx`, `p:` for plurals), so merging branches that added different strings rarely conflicts. When both branches gave the same id to different strings, every build resolves it the same way (the first in sorted order keeps it), the check and the build warn without failing, and the next `--fix` writes the resolved ids. Until then the id of the string that lost it can change with the next string changes.
- When a merge conflicts in the ids file, keep the entries of both sides (adding the missing commas), then run `ls-stack-i18n --fix --ids-file <file>`, which resolves the ids taken by two strings. Don't delete the file to resolve the conflict, `--fix` would give new ids to every string and every chunk would change once. While the file is invalid, builds fail and the dev server warns and ignores it.
- The file must be outside `localesDir`, or it would be read as a locale. The CLI `--src-dir` directories must match the plugin `srcDir`, translations found by only one of them don't break the build but get ids that are not kept in the file and the build warns that the file is outdated.

#### Rendering with the React Compiler

The React Compiler memoizes the compiled calls as their values don't depend on props or state, so a component keeps the text of the locale it first rendered with. Render the translated tree only after the locale loads and remount it when the locale changes:

```tsx
function Root() {
  const { loadedLocale } = i18n.useLoadedLocale();

  if (!loadedLocale) return <Loading />;

  return <App key={loadedLocale} />;
}
```

#### Testing with Vitest

When Vitest uses the same vite config, the plugin also compiles the code under test, so components rendered before a locale is loaded get empty strings. Load a locale in a setup file:

```ts
// vitest.setup.ts
import { i18n } from './src/i18n';

await i18n.setLocale('en');
```

Or don't apply the plugin in tests:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [
    !process.env.VITEST && i18nVitePlugin({ localesDir: 'src/locales' }),
    react(),
  ],
});
```

With the plugin applied, the compiled code imports the compiled functions (`__t`, `__tp`, `__tjsx`, `__tpjsx` and `__registerDevFallbacks`) from `@ls-stack/i18n`, so a mock of the module must keep them:

```ts
vi.mock('@ls-stack/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ls-stack/i18n')>()),
  // mocked functions
}));
```

## CLI Tool

Both packages include the `ls-stack-i18n` CLI for managing translations.

### Usage

```bash
# Check for missing/unused translations
ls-stack-i18n --config-dir ./locales --src-dir ./src --default en

# Auto-fix translation files
ls-stack-i18n --config-dir ./locales --src-dir ./src --default en --fix
```

The CLI scans the same files compiled by the vite plugin: `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs` and `.cjs`, excluding `.d.ts` declaration files. With multiple `--src-dir`, the issues show the file paths relative to the working directory.

### Options

| Option           | Alias | Description                                                                                                  |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| `--config-dir`   | `-c`  | Path to translation JSON files (required)                                                                    |
| `--src-dir`      | `-r`  | Path to source files to scan, can be used multiple times (required), every path must exist                   |
| `--default`      | `-d`  | Default locale ID                                                                                            |
| `--fix`          | `-f`  | Auto-add missing translations                                                                                |
| `--ids-file`     |       | Checks, or updates with `--fix`, the [vite plugin ids file](#stable-translation-ids) (`@ls-stack/i18n` only) |
| `--ai`           |       | AI provider for auto-translation (`google`/`openai`)                                                         |
| `--max-id-size`  |       | Maximum translation ID size (default: 80)                                                                    |
| `--disable-rule` |       | Disable a validation rule (can be used multiple times)                                                       |
| `--warn-rule`    |       | Set a validation rule to warning (can be used multiple times)                                                |
| `--no-color`     |       | Disable colored output                                                                                       |

### Validation Rules

The CLI validates translations and reports errors for common issues. Available rules:

| Rule                             | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| `constant-translation`           | Translation has no interpolation placeholders  |
| `unnecessary-plural`             | Plural form used without plural placeholder    |
| `jsx-without-interpolation`      | JSX translation without interpolation          |
| `jsx-without-jsx-nodes`          | JSX function used without JSX nodes            |
| `unnecessary-interpolated-affix` | Interpolation at start/end could be simplified |
| `max-translation-id-size`        | Translation ID exceeds max size                |

```bash
# Disable a rule
ls-stack-i18n -c ./locales -r ./src --disable-rule constant-translation

# Set a rule to warning instead of error
ls-stack-i18n -c ./locales -r ./src --warn-rule unnecessary-plural
```

### AI Auto-Translation

The CLI can automatically translate missing translations using AI. Set the provider via `--ai` flag or `I18N_AI_AUTO_TRANSLATE` environment variable.

```bash
# Using Google AI
GOOGLE_GENERATIVE_AI_API_KEY=your-key ls-stack-i18n -c ./locales -r ./src --fix --ai google

# Using OpenAI
OPENAI_API_KEY=your-key ls-stack-i18n -c ./locales -r ./src --fix --ai openai
```

#### AI Logging

Set `I18N_AI_LOGS_FOLDER` to log AI generation details for debugging or auditing:

```bash
I18N_AI_LOGS_FOLDER=./ai-logs GOOGLE_GENERATIVE_AI_API_KEY=your-key ls-stack-i18n -c ./locales -r ./src --fix --ai google
```

Log files (`ai-log-{timestamp}.json`) include the prompt, contexts, results, token usage, and duration. Only the last 10 log files are kept.

## License

MIT
