import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts', 'src/cli.ts', 'src/vite.ts'],
  dts: { build: true },
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
  external: ['react', 'vite', 'typescript'],
  noExternal: [/^@ls-stack\/i18n-core/],
});
