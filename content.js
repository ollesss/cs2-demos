// Ожидаем сообщения от popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'scan_matches') {
    scanMatches(request.startDate, request.endDate, sendResponse);
    return true; // асинхронный ответ
  }
});

async function scanMatches(startDate, endDate, callback) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let allMatches = [];
  let continueLoading = true;
  let loadedMatchUrls = new Set();
  let stopDueToModal = false;

  function hasErrorModal() {
    const modals = document.querySelectorAll('.newmodal .title_text');
    return Array.from(modals).some(modal => modal.textContent.trim() === 'Ошибка');
  }

  function closeAllErrorModals() {
    const okButtons = document.querySelectorAll('.newmodal_buttons .btn_grey_steamui');
    okButtons.forEach(btn => btn.click());
  }

  function parseCurrentMatches() {
    const matches = [];
    const matchTables = document.querySelectorAll('table.csgo_scoreboard_inner_left');

    matchTables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      const map = rows[0]?.textContent.trim();
      const dateText = rows[1]?.textContent.trim();
      const duration = rows[4]?.textContent.trim() || 'Неизвестно';

      const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) return;

      const matchDate = new Date(dateMatch[0]);

      if (matchDate < start) {
        continueLoading = false;
        return;
      }

      if (matchDate > end) {
        return;
      }

      const demoLink = table.querySelector('a[href*=".dem.bz2"]');
      if (!demoLink) return;

      const demoUrl = demoLink.href;
      if (loadedMatchUrls.has(demoUrl)) return;

      loadedMatchUrls.add(demoUrl);

      matches.push({
        map: map,
        date: dateText,
        duration: duration,
        demoUrl: demoUrl,
        timestamp: matchDate.getTime()
      });
    });

    return matches;
  }

  async function loadMoreMatches() {
    const loadMoreButton = document.getElementById('load_more_clickable');
    if (!loadMoreButton || !continueLoading) return false;

    loadMoreButton.click();

    await new Promise(resolve => {
      const observer = new MutationObserver((mutations, obs) => {
        const newMatches = document.querySelectorAll('table.csgo_scoreboard_root');
        if (newMatches.length > allMatches.length) {
          obs.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });

    return true;
  }

  // Первичный парс
  const initialMatches = parseCurrentMatches();
  allMatches = [...allMatches, ...initialMatches];

  // Загружаем дополнительные страницы
  while (continueLoading && !stopDueToModal) {
    if (hasErrorModal()) {
      console.warn("Обнаружено модальное окно ошибки от Steam. Закрываю и перезагружаю страницу.");
      closeAllErrorModals();
      stopDueToModal = true;
      setTimeout(() => location.reload(), 1000);
      break;
    }

    const loaded = await loadMoreMatches();
    if (!loaded) break;

    const newMatches = parseCurrentMatches();
    allMatches = [...allMatches, ...newMatches];
  }

  // Если была ошибка
  if (stopDueToModal) {
    callback({
      success: false,
      error: "Steam показал модальное окно ошибки. Сканирование остановлено."
    });
    return;
  }

  // Фильтрация и сортировка
  const filteredMatches = allMatches.filter(match => {
    const matchDate = new Date(match.timestamp);
    return matchDate >= start && matchDate <= end;
  });

  filteredMatches.sort((a, b) => b.timestamp - a.timestamp);

  callback({
    success: true,
    matches: filteredMatches
  });
}
