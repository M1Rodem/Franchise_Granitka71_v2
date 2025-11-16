import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs'; // ✅ Исправлено: fs для readdirSync и existsSync

// https://vite.dev/config/
export default defineConfig({
  root: './', // Корневая директория проекта
  base: './', // Базовый путь для относительных assets в продакшене
  server: {
    port: 3000,
    host: '0.0.0.0', // Доступно извне
    open: true, // Автоматически открывать браузер
    proxy: {
      // Proxy для API запросов (перенаправляет /api на бэкенд)
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Сохраняем /api на бэкенде; измените на '' если нужно убрать
        secure: false // Для локального HTTP
      }
    }
  },
  build: {
    outDir: 'dist', // Директория для собранных файлов
    emptyOutDir: true, // Очистка перед каждым билдом
    minify: 'terser', // Minification
    sourcemap: false, // Отключаем source maps в продакшене
    rollupOptions: {
      // Multi-page app: Авто-определение HTML entry points (только существующие .html)
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
        entryFileNames: 'assets/[name]-[hash].js', // Хэшированные имена
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  define: {
    // Инжекция env vars
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || '/api'),
  },
  optimizeDeps: {
    include: ['crypto-js'] // Оптимизация для bundling
  },
  esbuild: {
    target: 'es2020' // Современный JS
  },
  plugins: [] // Расширьте если нужно
});