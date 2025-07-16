const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// ✅ CORS для расширения
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // 👈 критично для chrome-extension://
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/proxy', async (req, res) => {
  const { url, filename } = req.query;
  if (!url || !filename) return res.status(400).send('Missing url or filename');

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Upstream error');

    res.setHeader('Content-Disposition', `attachment; filename="${sanitize(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

function sanitize(name) {
  return path.basename(name).replace(/[^\w\.-]/g, '_');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy running on ${PORT}`));
