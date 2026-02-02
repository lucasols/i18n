## Project Overview

A TypeScript i18n library monorepo containing three packages:

- **@ls-stack/i18n-core** (internal, not published) - Shared core logic
- **@ls-stack/server-i18n** - Server-side i18n with sync loading
- **@ls-stack/i18n** - Browser/React i18n with async loading

## Monorepo Structure

```
i18n/
├── core/               # Shared logic (types, hash, interpolation, pluralization, CLI)
├── server/             # Server-side i18n (@ls-stack/server-i18n)
├── browser/            # Browser/React i18n (@ls-stack/i18n)
├── cli-test/           # CLI test fixtures
├── pnpm-workspace.yaml
├── vitest.workspace.ts
└── eslint.config.js
```

## Commands

```bash
# Run tests with UI
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run a single test file
pnpm vitest run server/tests/translation.test.ts

# Lint (type-check + ESLint)
pnpm lint

# Build all packages (runs tests and lint first)
pnpm build

# Build without tests
pnpm build:no-test

# Test CLI tool (from server package)
pnpm --filter @ls-stack/server-i18n test-cli:check
pnpm --filter @ls-stack/server-i18n test-cli:fix
```

## Key Features

### Server Package (@ls-stack/server-i18n)

- `i18nitialize(options).with(localeId)` returns `I18n` class with `__` and `__p` methods
- Sync loading, translations passed directly
- CLI binary: `ls-stack-i18n`

### Browser Package (@ls-stack/i18n)

- Global `__`, `__p`, `__jsx`, `__pjsx` functions
- `i18nitialize` returns controller: `{ onChange, setLocale, getActiveLocale, isLoaded, getRegionLocale }`
- Async lazy-loading with retry
- Intl formatters: `__date`, `__num`, `__currency`, `__relativeTime`, `__relativeTimeFromNow`, `__list`, `__formattedTimeDuration`
- localStorage persistence
- CLI binary: `ls-stack-i18n`

### Translation Hash Format

- Simple: Template string with `{n}` placeholders (e.g., `"hello {1}"`)
- Plural: Objects with `zero`, `one`, `+2`, `many`, `manyLimit` keys
- Variations: Append `~~variant` to create alternative translations

### CLI Tool

- Scans source files for `___` and `___p` tagged templates (triple underscore in source)
- Validates JSON translation files against found usages
- Options: `--config-dir`, `--src-dir`, `--default`, `--fix`, `--no-color`
