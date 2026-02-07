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
  // Bundle ALL dependencies to avoid ESM/CJS conflicts (like p-limit v5)
  // and make the dist independent of node_modules on the server.
  noExternal: [/(.*)/],
});
