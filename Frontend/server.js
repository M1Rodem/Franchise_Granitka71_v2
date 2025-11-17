import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware: Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", process.env.VITE_API_BASE_URL || '/api']
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));

app.use('/api', createProxyMiddleware({
  target: `${process.env.API_PROXY_TARGET || 'http://localhost:5000'}/api`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // Логируем запросы для отладки
    console.log(`[PROXY] ${req.method} ${req.path} -> ${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Убеждаемся что Content-Type правильный для файлов
    if (req.path.includes('/Print/order') && req.path.includes('/download')) {
      proxyRes.headers['content-type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      proxyRes.headers['content-disposition'] = proxyRes.headers['content-disposition'] || 'attachment';
    }
  }
}));

app.use('/print-proxy', createProxyMiddleware({
  target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
  changeOrigin: true,
  pathRewrite: {
    '^/print-proxy': '/api' // /print-proxy/Print/order/1/print -> /api/Print/order/1/print
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PRINT PROXY] ${req.method} ${req.path}`);
  }
}));

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
  console.log('Production mode: Serving static files from dist/');
} else {
  app.use(express.static(__dirname));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
  console.log('Development mode: Use "npm run dev" for Vite server');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`API Proxy: /api -> ${process.env.API_PROXY_TARGET || 'http://localhost:5000'}/api`);
  console.log(`Print Proxy: /print-proxy -> ${process.env.API_PROXY_TARGET || 'http://localhost:5000'}/api`);
});