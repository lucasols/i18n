import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts', 'src/cli.ts'],
  dts: { build: true },
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
  noExternal: [/^@ls-stack\/i18n-core/],
});
