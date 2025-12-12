import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts']
    }),
    // Copy CSS file to dist folder
    {
      name: 'copy-css',
      writeBundle() {
        copyFileSync(
          resolve(__dirname, 'src/toolbar.css'),
          resolve(__dirname, 'dist/toolbar.css')
        );
      }
    }
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react/index.tsx')
      },
      name: 'UnleashSessionToolbar',
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.${format}.js`
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
