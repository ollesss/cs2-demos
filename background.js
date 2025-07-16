chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download_demo') {
    const proxyBase = 'https://cs2-demos.onrender.com/proxy';

    const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(request.url)}&filename=${encodeURIComponent(request.filename)}`;

    fetch(proxiedUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
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

    return true; // async response
  }
});
