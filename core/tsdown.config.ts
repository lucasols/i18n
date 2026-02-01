import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  dts: true,
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
});
