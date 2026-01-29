import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:5000';

app.use(cors({ origin: '*', credentials: true }));

// Middleware: Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        API_TARGET,
        'ws:', 
        'wss:',
        'ws://localhost:3000',
        'wss://*',
        process.env.VITE_API_BASE_URL || '/api'
      ]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));

// API Proxy для HTTP запросов
app.use('/api', createProxyMiddleware({
  target: `${API_TARGET}/api`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''
  },
  onProxyReq: (proxyReq, req, res) => {
  },
  onProxyRes: (proxyRes, req, res) => {
    // Убеждаемся что Content-Type правильный для файлов
    if (req.path.includes('/Print/order') && req.path.includes('/download')) {
      proxyRes.headers['content-type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      proxyRes.headers['content-disposition'] = proxyRes.headers['content-disposition'] || 'attachment';
    }
  }
}));

// Print Proxy
app.use('/print-proxy', createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
  pathRewrite: {
    '^/print-proxy': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
  }
}));

app.use('/api/notificationhub', createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
  ws: true,
  logLevel: 'debug',
  
  // Критически важные опции для SignalR:
  wsUpgrade: true,
  followRedirects: true,
  
  // Оставляем путь как есть
  pathRewrite: (path) => {
    return path;
  },
  
  onProxyReq: (proxyReq, req, res) => {
    
    // НЕ ПЕРЕЗАПИСЫВАЙ Connection и Upgrade заголовки!
    // WebSocket upgrade требует точных значений
  },
  
onProxyReqWs: (proxyReq, req, socket, options, head) => {
},
  
  onOpen: (proxySocket) => {
  },
  
  onClose: (req, socket, head) => {
  },
  
  onError: (err, req, res) => {
    console.error('[SIGNALR PROXY ERROR]', err);
    console.error('[SIGNALR PROXY ERROR] Stack:', err.stack);
    
    if (res && !res.headersSent) {
      res.status(502).json({ 
        error: 'SignalR proxy error',
        details: err.message 
      });
    }
  }
}));

// Статические файлы
if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  app.use(express.static(__dirname));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

// Запуск сервера
const server = app.listen(PORT, '0.0.0.0', () => {
  
  // Информация о WebSocket поддержке
  const address = server.address();
});

// Обработка graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});