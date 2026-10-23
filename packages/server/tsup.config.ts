import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  // Bundle the workspace core package (it ships TypeScript source).
  noExternal: ['@busstop/core'],
});
