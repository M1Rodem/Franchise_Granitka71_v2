import { defineConfig } from 'vite';
import { resolve } from 'path';
import dotenv from 'dotenv';

// Загружаем .env
dotenv.config();

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const EXPRESS_PORT = 3001; // Порт нашего Express сервера
  
  return {
    root: './',
    base: isProduction ? '/' : './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['0b2a-91-148-236-96.ngrok-free.app'],
      cors: true,
      proxy: {
        // Прокси для API запросов на наш Express сервер
        '/api': {
          target: `http://localhost:${EXPRESS_PORT}`,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[VITE PROXY → Express]', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[VITE PROXY ← Express]', proxyRes.statusCode, req.url);
            });
          }
        },
        // Прокси для бэкенда (если нужно напрямую)
        '/backend': {
          target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/backend/, '/api'),
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[VITE PROXY → Backend]', req.method, req.url);
            });
          }
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          'index': resolve(__dirname, 'index.html'),
          'login': resolve(__dirname, 'login.html'),
          'dashboard': resolve(__dirname, 'dashboard.html'),
          'orders': resolve(__dirname, 'orders.html'),
          'view-order': resolve(__dirname, 'view-order.html'),
          'create-order': resolve(__dirname, 'create-order.html'),
          'archived-orders': resolve(__dirname, 'archived-orders.html'),
          'profile': resolve(__dirname, 'profile.html'),
          'users': resolve(__dirname, 'users.html'),
          'admin': resolve(__dirname, 'admin.html'),
          'admin/plots': resolve(__dirname, 'admin/plots.html')
        }
      }
    },
    esbuild: {
      target: 'es2020'
    }
  };
});