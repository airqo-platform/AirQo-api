import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  treeshake: false, // Disable tree-shaking for large re-export files
  minify: false, // Disable minification to avoid build issues
  target: 'es2018',
  external: ['react'],
  banner: {
    js: '"use client";',
  },
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs',
    };
  },
  esbuildOptions(options) {
    options.platform = 'neutral';
    options.conditions = ['module'];
    options.mainFields = ['module', 'main'];
    options.legalComments = 'none';
  },
  onSuccess: async () => {
    console.log('✅ Build completed successfully');
  },
});
