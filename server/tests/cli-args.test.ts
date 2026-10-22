import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);

const tsxBin = path.join(import.meta.dirname, '../../node_modules/.bin/tsx');
const cliEntry = path.join(import.meta.dirname, '../src/cli.ts');

let tmpDir = '';

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ls-stack-server-i18n-cli-'));

  const files: Record<string, string> = {
    'src/main.ts': `
      import { i18n } from '@acme/shared/i18n';

      export const { __ } = i18n.with('pt');

      export const welcome = __\`Welcome back\`;
    `,
    'shared/emails.ts': `
      import { __ } from '../src/main';

      export const weeklySummary = __\`Your weekly summary\`;
    `,
    // the default locale only lists the translations that differ from the source
    'locales/en.json': JSON.stringify({}),
    'locales/pt.json': JSON.stringify({
      'Welcome back': 'Bem-vindo de volta',
      'Your weekly summary': 'Seu resumo semanal',
    }),
  };

  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(tmpDir, file)), { recursive: true });
    await writeFile(path.join(tmpDir, file), content);
  }
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function runCli(
  args: string[],
): Promise<{ exitCode: number; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      tsxBin,
      [cliEntry, '--no-color', ...args],
      { cwd: tmpDir },
    );
    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'number' &&
      'stdout' in error &&
      'stderr' in error
    ) {
      return {
        exitCode: error.code,
        output: `${String(error.stdout)}${String(error.stderr)}`,
      };
    }
    throw error;
  }
}

test('--src-dir can be repeated', { timeout: 30_000 }, async () => {
  const result = await runCli([
    '--config-dir',
    'locales',
    '--src-dir',
    'src',
    '--src-dir',
    'shared',
    '--default',
    'en',
  ]);

  expect(result.output).toContain('✅ en.json translations are up to date');
  expect(result.output).toContain('✅ pt.json translations are up to date');
  expect(result.exitCode).toBe(0);
});

test('--ids-file is rejected', { timeout: 30_000 }, async () => {
  const result = await runCli([
    '--config-dir',
    'locales',
    '--src-dir',
    'src',
    '--ids-file',
    'i18n-ids.json',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    '--ids-file is only supported by the @ls-stack/i18n CLI',
  );
});
