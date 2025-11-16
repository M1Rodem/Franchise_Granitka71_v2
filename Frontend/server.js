import dotenv from 'dotenv'; // ESM-импорт
dotenv.config(); // Загружаем .env

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';

// ESM: __dirname и __filename polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware: Security headers (CSP ограничивает скрипты/стили)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Для inline scripts в HTML
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"], // Для изображений и blob URLs
      connectSrc: ["'self'", process.env.VITE_API_BASE_URL || '/api', process.env.API_PROXY_TARGET || 'http://localhost:5000']
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true } // HSTS для HTTPS в prod
}));

// ✅ ФИКС ПРОКСИ: target включает /api, rewrite убирает фронт-/api
app.use('/api', createProxyMiddleware({
  target: `${process.env.API_PROXY_TARGET || 'http://localhost:5000'}/api`, // Добавляем /api в target
  changeOrigin: true,
  pathRewrite: {
    '^/api': '' // Убираем /api из фронт-пути, но бэкенд получает /Auth/login (как ожидает)
  }
}));

if (isProduction) {
  // В продакшене: Сервируем статические файлы из dist/
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // SPA роутинг: Все маршруты на index.html (для client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
  
  console.log('Production mode: Serving static files from dist/');
} else {
  // В dev: Fallback на статические (используйте npm run dev для Vite)
  app.use(express.static(__dirname));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
  console.log('Development mode: Use "npm run dev" for Vite server');
}

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`API Proxy: /api → ${process.env.API_PROXY_TARGET || 'http://localhost:5000'}/api`); // Обновлённый лог
  if (isProduction) {
    console.log('Environment vars injected; build with "npm run build".');
  }
});