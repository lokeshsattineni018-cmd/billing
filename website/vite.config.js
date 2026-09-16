import { defineConfig } from 'vite';

function stripConsolePlugin() {
  return {
    name: 'vite-plugin-strip-console',
    enforce: 'post',
    transform(code, id) {
      // Apply to all application source files
      if (/\.(jsx?|tsx?)$/.test(id) && !id.includes('node_modules')) {
        const stripped = code.replace(/console\.(log|warn|error|info|debug|table|trace)\s*\([\s\S]*?\);?/g, '');
        return { code: stripped, map: null };
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: mode === 'production' ? [stripConsolePlugin()] : [],
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
