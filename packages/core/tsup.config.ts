import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  clean: true,
  dts: true,
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
  tsconfig: 'tsconfig.prod.json',
  esbuildOptions(options) {
    options.mangleProps = /[^_]_$/;
  },
});
