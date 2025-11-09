const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Раздаем статические файлы
app.use(express.static(__dirname));

// Все маршруты отправляем на index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запускаем сервер на всех интерфейсах
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Frontend server running at:`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`📱 Network: http://192.168.0.21:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
});