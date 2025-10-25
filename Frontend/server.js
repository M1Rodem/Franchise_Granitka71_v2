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

app.listen(PORT, () => {
    console.log(`🚀 Frontend server running at: http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
});