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
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:5000';

// ====== КОНФИГУРАЦИЯ ДЛЯ КЛИЕНТА ======
// Эти данные будут доступны через /api/config
const CLIENT_CONFIG = {
    yandexMapsKey: process.env.YANDEX_MAPS_API_KEY || '2789b7ef-c9eb-49a8-ba22-9711e05ad7f0',
    apiUrl: '/api',
    appName: 'Granitka71'
};

// Middleware
app.use(cors({ origin: '*', credentials: true }));

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "'unsafe-eval'",
                "https://api-maps.yandex.ru",
                "https://*.maps.yandex.net"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://api-maps.yandex.ru"],
            imgSrc: [
                "'self'", 
                "data:", 
                "https:", 
                "blob:",
                "https://*.maps.yandex.net",
                "https://yandex.ru"
            ],
            connectSrc: [
                "'self'", 
                API_TARGET,
                'ws:', 
                'wss:',
                'ws://localhost:3000',
                'wss://*',
                process.env.VITE_API_BASE_URL || '/api',
                "https://api-maps.yandex.ru",
                "https://*.maps.yandex.net"
            ]
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true }
}));

// ====== API ENDPOINT ДЛЯ КОНФИГА ======
// Отдаем клиенту только то, что нужно для работы
app.get('/api/config', (req, res) => {
    // Проверяем авторизацию через заголовок
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Отдаем конфиг
    res.json({
        yandexMapsKey: CLIENT_CONFIG.yandexMapsKey,
        apiUrl: CLIENT_CONFIG.apiUrl,
        appName: CLIENT_CONFIG.appName
    });
});

// API Proxy для HTTP запросов
app.use('/api', (req, res, next) => {
    // Пропускаем /api/config без проксирования
    if (req.path === '/config') {
        return next();
    }
    
    // Проксируем остальные запросы
    return createProxyMiddleware({
        target: `${API_TARGET}/api`,
        changeOrigin: true,
        pathRewrite: {
            '^/api': ''
        },
        onProxyReq: (proxyReq, req, res) => {
            // Добавляем заголовки если нужно
            if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization);
            }
        }
    })(req, res, next);
});

// Print Proxy
app.use('/print-proxy', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    pathRewrite: {
        '^/print-proxy': '/api'
    }
}));

// SignalR Proxy
app.use('/api/notificationhub', (req, res, next) => {
    console.log('[SignalR Proxy] Запрос к /api/notificationhub:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        isWebSocket: req.headers.upgrade?.toLowerCase() === 'websocket'
    });

    // Если это запрос на negotiate или обычный HTTP - проксируем
    if (req.url.includes('/negotiate') || !req.headers.upgrade) {
        return createProxyMiddleware({
            target: API_TARGET,
            changeOrigin: true,
            pathRewrite: {
                '^/api/notificationhub': '/api/notificationhub'
            },
            onProxyReq: (proxyReq, req, res) => {
                console.log('[SignalR HTTP Proxy] Проксирование HTTP запроса:', req.url);
            }
        })(req, res, next);
    }

    // Если это WebSocket upgrade
    return createProxyMiddleware({
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
        logLevel: 'debug',
        onError: (err, req, res) => {
            console.error('[SignalR WS Proxy ERROR]', err);
            // Пробуем переключиться на LongPolling через редирект
            if (res.writeHead) {
                res.writeHead(302, {
                    'Location': req.url + '&transport=LongPolling'
                });
                res.end();
            }
        }
    })(req, res, next);
});

// ====== СТАТИЧЕСКИЕ ФАЙЛЫ ======
if (isProduction) {
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // Для SPA - все пути отдаем index.html
    app.get('*', (req, res) => {
        // Не обрабатываем API пути
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
} else {
    app.use(express.static(__dirname));
    
    app.get('*', (req, res) => {
        // Не обрабатываем API пути
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        res.sendFile(path.join(__dirname, 'index.html'));
    });
}

// Запуск сервера
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    Сервер запущен на порту ${PORT}
    Режим: ${isProduction ? 'production' : 'development'}
    Яндекс.Карты: ключ ${CLIENT_CONFIG.yandexMapsKey ? 'загружен' : 'отсутствует'}
    API Target: ${API_TARGET}
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Сервер остановлен');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    server.close(() => {
        console.log('Сервер остановлен');
        process.exit(0);
    });
});