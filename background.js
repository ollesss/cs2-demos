chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download_demo') {
    const proxyBase = 'https://cs2-demos.onrender.com/proxy';
    const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(request.url)}&filename=${encodeURIComponent(request.filename)}`;

    chrome.downloads.download({
      url: proxiedUrl,
      filename: request.filename,
      conflictAction: 'uniquify',
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError?.message || 'Download failed'
        });
      } else {
        sendResponse({ success: true });
      }
    });

    return true;
  }
});