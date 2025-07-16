// Ожидаем сообщения от popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'scan_matches') {
    scanMatches(request.startDate, request.endDate, sendResponse);
    return true; // Для асинхронного ответа
  }
});

// Сканировать матчи в указанном диапазоне дат
async function scanMatches(startDate, endDate, callback) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Собираем все матчи со страницы
  let allMatches = [];
  let continueLoading = true;
  let loadedMatchUrls = new Set(); // Для отслеживания дубликатов
  
  // Функция для парсинга матчей на текущей странице
  function parseCurrentMatches() {
    const matches = [];
    const matchTables = document.querySelectorAll('table.csgo_scoreboard_inner_left');
    
    matchTables.forEach(table => {
      const leftTable = table
      
      if (!leftTable) return;
      
      // Получаем информацию о матче из левой таблицы
      const rows = leftTable.querySelectorAll('tr');
      const map = rows[0].textContent.trim();
      const dateText = rows[1].textContent.trim();
      const duration = rows[4]?.textContent.trim() || 'Неизвестно';
      
      // Парсим дату
      const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) return;
      
      const matchDate = new Date(dateMatch[0]);
      
      // Проверяем, попадает ли матч в диапазон
      if (matchDate < start) {
        continueLoading = false;
        return;
      }
      
      if (matchDate > end) {
        return; // Пропускаем матчи после конечной даты
      }
      
      // Ищем ссылку на демо
      let demoUrl = '';
      const demoLink = leftTable.querySelector('a[href*=".dem.bz2"]');
      if (demoLink) {
        demoUrl = demoLink.href;
      }
      
      // Пропускаем матчи без демо и дубликаты
      if (!demoUrl || loadedMatchUrls.has(demoUrl)) {
        return;
      }
      
      loadedMatchUrls.add(demoUrl);
      
      // Добавляем матч в список
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
  
  // Функция для загрузки дополнительных матчей
  async function loadMoreMatches() {
    const loadMoreButton = document.getElementById('load_more_clickable');
    if (!loadMoreButton || !continueLoading) return false;
    
    loadMoreButton.click();
    
    // Ждем загрузки новых матчей
    await new Promise(resolve => {
      const observer = new MutationObserver(function(mutations, obs) {
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
      
      // Таймаут на случай, если загрузка не произошла
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });
    
    return true;
  }
  
  // Парсим текущие матчи
  const initialMatches = parseCurrentMatches();
  allMatches = [...allMatches, ...initialMatches];
  
  // Загружаем дополнительные матчи, пока они есть и попадают в диапазон
  while (continueLoading) {
    const loaded = await loadMoreMatches();
    if (!loaded) break;
    
    const newMatches = parseCurrentMatches();
    allMatches = [...allMatches, ...newMatches];
  }
  
  // Фильтруем матчи по дате (на всякий случай)
  const filteredMatches = allMatches.filter(match => {
    const matchDate = new Date(match.timestamp);
    return matchDate >= start && matchDate <= end;
  });
  
  // Сортируем по дате (новые сверху)
  filteredMatches.sort((a, b) => b.timestamp - a.timestamp);
  
  // Отправляем результат в popup
  callback({
    success: true,
    matches: filteredMatches
  });
}