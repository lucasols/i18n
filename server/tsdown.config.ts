import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts', 'src/cli.ts'],
  dts: true,
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
});
