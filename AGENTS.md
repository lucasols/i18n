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
└── eslint.config.js
```

## Commands

```bash
# Run tests once (CI mode)
pnpm test

# Run tests for a specific package
pnpm --filter @ls-stack/server-i18n test
pnpm --filter @ls-stack/i18n test

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

## Feature implementation

After implementing a feature:

- Update the README.md file to reflect the new feature.
- Add tests to cover the new feature.

## Focus on performance

- Code should be optimized for performance and memory efficiency, make sure tests are testing performance qualities and implementations are optimized for performance.

## Testing

- Each package has its own `vitest.config.ts` (browser package uses `execArgv: ['--no-webstorage']` for happy-dom compatibility)
- Run all tests via `pnpm test` or run package-specific tests via `pnpm --filter <package> test`
- Always use realistic test scenarios and data, tests should reflect the real-world usage of the code.
  - Don't use unrealistic timelines
- For browser tests, use `createTestController` from `test-utils.ts` to create a test controller with mock locale loaders. Extend or modify `createTestController` itself to add new testing capabilities if needed.
- Tests should follow and test the correct expected behavior of the lib. Don't change test just to make them pass.
- For CLI tests, the browser package is the canonical test suite. Server tests should only cover server-specific CLI behavior—generic CLI tests belong in browser tests only (avoid duplicating them in server).

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

- Scans source files for translations, add missing translations to the language files and validate the language files.
