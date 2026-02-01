# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A simple TypeScript i18n library (`@ls-stack/i18n`) that provides:
- Tagged template literal translations using `__` and `__p` methods
- Pluralization support with zero/one/+2/many variants
- Translation variations using `~~` suffix syntax
- CLI tool for checking/fixing translation files

## Commands

```bash
# Run tests with UI
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run a single test file
pnpm vitest run tests/translation.test.ts

# Lint (type-check + ESLint)
pnpm lint

# Type-check only
pnpm tsc

# ESLint only
pnpm eslint

# Build (runs tests and lint first)
pnpm build

# Build without tests
pnpm build:no-test

# Test CLI tool
pnpm test-cli:check
pnpm test-cli:fix
```

## Architecture

### Library (src/main.ts)
- `i18nitialize()` - Initialize with locale configurations, returns object with `with(localeId)` method
- `I18n` class - Provides `__` for simple translations and `__p(num)` for pluralization
- Translations use template literal hashes as keys (e.g., `"hello {1}"` for `__\`hello ${name}\``)

### CLI (src/cli.ts)
- Binary: `ls-stack-i18n`
- Scans source files for `___` and `___p` tagged templates (note: triple underscore in source, but methods are `__` and `__p`)
- Validates JSON translation files in config directory against found usages
- Options: `--config-dir`, `--src-dir`, `--default`, `--fix`, `--no-color`

### Translation Parser (src/findMissingTranslations.ts)
- Uses TypeScript compiler API to parse source files
- Extracts translation hashes from tagged template expressions
- Identifies `___` (string) and `___p()` (plural) usages

### Translation Hash Format
- Simple: Template string with `{n}` placeholders for interpolations (e.g., `"hello {1}"`)
- Plural: Same format, translations are objects with `zero`, `one`, `+2`, `many`, `manyLimit` keys
- Variations: Append `~~variant` to create alternative translations (stripped from fallback)
