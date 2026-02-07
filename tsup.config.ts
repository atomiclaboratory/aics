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
  // Bundle ALL dependencies EXCEPT pdf-parse to avoid DOMMatrix/Browser errors.
  // pdf-parse must be installed in node_modules on the server.
  noExternal: [/^(?!pdf-parse).*$/],
});
