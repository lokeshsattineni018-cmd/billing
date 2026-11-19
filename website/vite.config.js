import { defineConfig, loadEnv } from 'vite';
import { injectPreconnectIntoHtml } from './src/utils/preconnectPlugin.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || '';

  return {
    base: '/',
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
    } : {},
    plugins: [
      {
        name: 'html-api-preconnect',
        transformIndexHtml(html) {
          return injectPreconnectIntoHtml(html, apiUrl);
        },
      },
    ],
    build: {
      outDir: 'dist',
      sourcemap: false,
      // ─── Code Splitting: Separate vendor chunks for long-term caching ───
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/axios')) {
              return 'vendor-axios';
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:5001',
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': 'http://localhost:5001',
      },
    },
  };
});
