import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { copyFileSync, readFileSync, writeFileSync } from 'fs';
import postcss from 'postcss';
import cssnano from 'cssnano';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts']
    }),
    // Add "use client" directive to Next.js client bundle
    {
      name: 'add-use-client-directive',
      generateBundle(options, bundle) {
        const nextBundle = bundle['next.es.js'];
        if (nextBundle && 'code' in nextBundle) {
          nextBundle.code = `"use client";\n${nextBundle.code}`;
        }
      }
    },
    // Copy and minify CSS file to dist folder
    {
      name: 'copy-css',
      async writeBundle() {
        const cssPath = resolve(__dirname, 'src/toolbar.css');
        const outputPath = resolve(__dirname, 'dist/toolbar.css');
        const css = readFileSync(cssPath, 'utf-8');

        // Minify CSS with cssnano (default preset)
        const result = await postcss([
          cssnano({
            preset: ['default', {
              discardComments: { removeAll: true },
              normalizeWhitespace: true,
            }]
          })
        ]).process(css, { from: cssPath, to: outputPath });

        writeFileSync(outputPath, result.css);
      }
    }
  ],
  build: {
    target: 'esnext',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react/index.tsx'),
        next: resolve(__dirname, 'src/next/index.ts'),
        'next-server': resolve(__dirname, 'src/next/server.ts')
      },
      name: 'UnleashSessionToolbar',
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.${format}.js`
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        drop_console: false, // Keep console.error for debugging
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.trace'],
        pure_getters: true,
        unsafe_arrows: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
      },
      mangle: {
        toplevel: true,
        properties: false, // Don't mangle properties to avoid breaking lit-html
      },
      format: {
        comments: false,
        ecma: 2020,
      },
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'unleash-proxy-client'],
      output: {
        globals: {
          react: 'React',
          'react/jsx-runtime': 'jsxRuntime',
          'unleash-proxy-client': 'UnleashClient'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.png')) return 'assets/[name][extname]';
          return assetInfo.name || '';
        }
      }
    },
    sourcemap: true,
    outDir: 'dist',
    assetsInlineLimit: 0 // Don't inline assets, keep them as separate files
  }
});
