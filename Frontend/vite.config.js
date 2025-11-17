import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

export default defineConfig({
  root: './',
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), 
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      mangle: false
    },
    sourcemap: true,
    rollupOptions: {
      input: (() => {
        const htmlFiles = readdirSync('.').filter(f => f.endsWith('.html'));
        if (htmlFiles.length === 0) {
          console.warn('No .html files found in root. Adding default index.html entry.');
          return { index: resolve(__dirname, 'index.html') };
        }
        return Object.fromEntries(
          htmlFiles.map(f => [f.replace('.html', ''), resolve(__dirname, f)])
        );
      })(),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [
    // УДАЛИЛ ПЛАГИН HTML-TRANSFORM - он ломает dev режим
  ],
  esbuild: {
    target: 'es2020'
  }
});