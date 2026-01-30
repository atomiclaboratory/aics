import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node18',
});
