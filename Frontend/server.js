const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = 3000;

// ПРАВИЛЬНЫЙ ПРОКСИ
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5000/api', // бэкенд с /api
    changeOrigin: true,
    pathRewrite: {
        '^/api': '' // убираем /api из пути запроса
    }
}));

// Статические файлы
app.use(express.static(__dirname));

// SPA роутинг
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(` Frontend server running at: http://localhost:${PORT}`);
    console.log(` API Proxy: /api → http://localhost:5000/api`);
});