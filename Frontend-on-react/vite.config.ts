import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Разрешаем подключения с любых IP
    port: 5173,
    strictPort: true, // Не менять порт если занят
    allowedHosts: true, // Разрешаем все хосты (или можно указать конкретный)
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''), // Опционально
      },
    },
  },
});