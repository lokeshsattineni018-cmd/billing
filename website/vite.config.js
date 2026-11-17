import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: '/',
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : {},
  plugins: [],
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
}));
