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

| Method                    | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `setLocale(id \| 'auto')` | Load and activate a locale. Returns `Promise<boolean>`        |
| `getLoadedLocale()`       | Get the currently loaded locale ID                            |
| `getRegionLocale()`       | Get the region-specific locale (e.g., `'en-US'`)              |
| `onLoad(callback)`        | Subscribe to locale load events. Returns unsubscribe function |
| `useLoadedLocale()`       | React hook for locale state                                   |

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

## CLI Tool

Both packages include the `ls-stack-i18n` CLI for managing translations.

### Usage

```bash
# Check for missing/unused translations
ls-stack-i18n --config-dir ./locales --src-dir ./src --default en

# Auto-fix translation files
ls-stack-i18n --config-dir ./locales --src-dir ./src --default en --fix
```

### Options

| Option           | Alias | Description                                        |
| ---------------- | ----- | -------------------------------------------------- |
| `--config-dir`   | `-c`  | Path to translation JSON files (required)          |
| `--src-dir`      | `-r`  | Path to source files to scan (required)            |
| `--default`      | `-d`  | Default locale ID                                  |
| `--fix`          | `-f`  | Auto-add missing translations                      |
| `--ai`           |       | AI provider for auto-translation (`google`/`openai`) |
| `--max-id-size`  |       | Maximum translation ID size (default: 80)          |
| `--disable-rule` |       | Disable a validation rule (can be used multiple times) |
| `--warn-rule`    |       | Set a validation rule to warning (can be used multiple times) |
| `--no-color`     |       | Disable colored output                             |

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

Set `AI_LOGS_FOLDER` to log AI generation details for debugging or auditing:

```bash
AI_LOGS_FOLDER=./ai-logs GOOGLE_GENERATIVE_AI_API_KEY=your-key ls-stack-i18n -c ./locales -r ./src --fix --ai google
```

Log files (`ai-log-{timestamp}.json`) include the prompt, contexts, results, token usage, and duration. Only the last 10 log files are kept.

## License

MIT
