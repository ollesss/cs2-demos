const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// ✅ CORS для расширения
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/proxy', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Upstream error');

    // Декодируем имя файла из URL (если было закодировано)
    const decodedFilename = decodeURIComponent(filename || getFilenameFromUrl(url));
    
    // Готовим оба варианта Content-Disposition для совместимости
    const safeFilename = sanitize(decodedFilename);
    const utf8Filename = encodeRFC5987(decodedFilename);
    
    res.setHeader('Content-Disposition', 
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${utf8Filename}`
    );
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// Функция для RFC 5987 кодирования
function encodeRFC5987(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(?:7C|60|5E)/g, unescape);
}

// Безопасное имя файла (для старых клиентов)
function sanitize(name) {
  return path.basename(name).replace(/[^\w\.-]/g, '_');
}

// Извлекаем имя файла из URL, если не указано
function getFilenameFromUrl(url) {
  return path.basename(new URL(url).pathname) || 'file';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy running on ${PORT}`));