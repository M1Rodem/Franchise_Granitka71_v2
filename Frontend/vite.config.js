import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    root: './',
    base: isProduction ? '/' : './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: [
        '6wb01uktj.localto.net',
        '.localto.net' // разрешаем все поддомены localto.net
      ],
      cors: true,
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: true,  // ← КРИТИЧЕСКИ ВАЖНО!
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[VITE PROXY] →', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[VITE PROXY] ←', proxyRes.statusCode, req.url);
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
          'users': resolve(__dirname, 'users.html')
        }
      }
    },
    esbuild: {
      target: 'es2020'
    }
  };
});