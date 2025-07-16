chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download_demo') {
    const corsProxy = 'https://cs2-demos.onrender.com/proxy?url=';
    const proxiedUrl = corsProxy + request.url;

    fetch(proxiedUrl, {
      method: 'GET',
      headers: {
        'Origin': 'https://example.com' // ⬅️ ОБЯЗАТЕЛЕН
      }
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        chrome.downloads.download({
          url: blobUrl,
          filename: request.filename,
          conflictAction: 'uniquify',
          saveAs: false
        }, downloadId => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          if (chrome.runtime.lastError || !downloadId) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError?.message || 'Download failed'
            });
          } else {
            sendResponse({ success: true });
          }
        });
      })
      .catch(err => {
        console.error('❌ Ошибка при скачивании:', err.message);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }
});
