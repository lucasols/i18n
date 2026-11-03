import type * as fsPromises from 'node:fs/promises';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';
import { i18nVitePlugin } from '../src/vite';

const reads = vi.hoisted(() => ({ dir: '', active: 0, maxActive: 0 }));

// counts the reads of the plugin scan, vite itself uses its own fs import
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof fsPromises>();

  async function readFile(file: string, encoding: 'utf-8'): Promise<string> {
    const isScannedFile = reads.dir !== '' && file.startsWith(reads.dir);
    if (isScannedFile) {
      reads.active++;
      reads.maxActive = Math.max(reads.maxActive, reads.active);
    }

    try {
      return await original.readFile(file, encoding);
    } finally {
      if (isScannedFile) reads.active--;
    }
  }

  return { ...original, readFile };
});

const runtimeEntry = path.join(import.meta.dirname, '../src/main.ts');

test('the scan of a large source dir limits the files read at the same time', async () => {
  // the scan reads the real paths (e.g. /private/var on macOS)
  const tmpDir = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'ls-stack-i18n-scan-')),
  );
  const srcDir = path.join(tmpDir, 'src');

  try {
    await mkdir(path.join(tmpDir, 'locales'));
    await writeFile(
      path.join(tmpDir, 'locales/en.json'),
      JSON.stringify({ 'Open channel {1}': 'Open channel {1}' }),
    );

    // a realistic app has thousands of modules, most of them without translations
    for (const feature of ['chat', 'inbox', 'settings', 'billing']) {
      const featureDir = path.join(srcDir, feature);
      await mkdir(featureDir, { recursive: true });

      for (let i = 0; i < 150; i++) {
        await writeFile(
          path.join(featureDir, `item${i}.ts`),
          `export function format${feature}Item${i}(value: number) {\n  return value.toFixed(${i % 4});\n}\n`,
        );
      }
    }

    await writeFile(
      path.join(srcDir, 'main.ts'),
      [
        "import { __, i18nitialize } from '@ls-stack/i18n';",
        '',
        'export const i18n = i18nitialize({',
        "  locales: [{ id: 'en', loader: () => import('../locales/en.json') }],",
        '  persistenceKey: false,',
        "  fallbackLocale: 'en',",
        '});',
        '',
        'export function getOpenLabel(name: string) {',
        '  return __`Open channel ${name}`;',
        '}',
        '',
      ].join('\n'),
    );

    reads.dir = `${srcDir}/`;

    await build({
      root: tmpDir,
      configFile: false,
      logLevel: 'silent',
      resolve: {
        alias: [{ find: /^@ls-stack\/i18n$/, replacement: runtimeEntry }],
      },
      plugins: [i18nVitePlugin({ localesDir: 'locales' })],
      build: {
        outDir: path.join(tmpDir, 'dist'),
        write: false,
        rollupOptions: {
          input: path.join(srcDir, 'main.ts'),
          external: [/^react(\/.*)?$/],
        },
      },
    });

    expect(reads.maxActive).toBeGreaterThan(1);
    expect(reads.maxActive).toBeLessThanOrEqual(64);
  } finally {
    reads.dir = '';
    await rm(tmpDir, { recursive: true, force: true });
  }
});
