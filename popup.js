document.addEventListener('DOMContentLoaded', function() {
  // Установка дат по умолчанию
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  
  startDateInput.valueAsDate = startDate;
  endDateInput.valueAsDate = endDate;
  
  // Элементы интерфейса
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');
  const selectAllBtn = document.getElementById('select-all');
  const downloadSelectedBtn = document.getElementById('download-selected');
  
  // Обработчики кнопок
  scanBtn.addEventListener('click', startScan);
  clearBtn.addEventListener('click', clearMatches);
  selectAllBtn.addEventListener('click', selectAllMatches);
  downloadSelectedBtn.addEventListener('click', downloadSelected);
  
  // Обработчики изменения дат
  startDateInput.addEventListener('change', handleDateChange);
  endDateInput.addEventListener('change', handleDateChange);
  
  // Восстановление сохраненных матчей
  loadSavedMatches();
});

// Функция для показа уведомлений
function showNotification(message, type = 'info', duration = 3000) {
  const container = document.getElementById('notifications-container');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Иконка в зависимости от типа
  let icon = '';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '✗';
  else icon = 'i';
  
  notification.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close">&times;</button>
  `;
  
  // Кнопка закрытия
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.remove('visible');
    setTimeout(() => notification.remove(), 300);
  });
  
  container.appendChild(notification);
  
  // Показываем уведомление
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // Автоматическое закрытие
  if (duration > 0) {
    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  return notification;
}

// Загрузить сохраненные матчи
function loadSavedMatches() {
  chrome.storage.local.get(['matches'], function(result) {
    if (result.matches && result.matches.length > 0) {
      displayMatches(result.matches);
    }
  });
}

// Обработчик изменения даты
function handleDateChange() {
  clearMatches();
}

// Начать сканирование матчей
function startScan() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  
  if (!startDate || !endDate) {
    showNotification('Пожалуйста, укажите обе даты', 'error');
    return;
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    showNotification('Начальная дата не может быть больше конечной', 'error');
    return;
  }
  
  showNotification('Сканирование начато...', 'info');
  toggleLoader('scan', true);
  disableButtons(true);
  
  clearMatches(false);
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'scan_matches',
      startDate: startDate,
      endDate: endDate
    }, function(response) {
      toggleLoader('scan', false);
      disableButtons(false);
      
      if (chrome.runtime.lastError) {
        showNotification(`Ошибка: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (response?.success) {
        const count = response.matches.length;
        showNotification(`Найдено ${count} матчей${count > 0 ? ' с демо' : ''}`, 'success');
        
        if (count > 0) {
          displayMatches(response.matches);
          chrome.storage.local.set({matches: response.matches});
        } else {
          showEmptyMessage();
        }
      } else {
        showNotification('Ошибка при сканировании матчей', 'error');
      }
    });
  });
}

// Очистить список матчей
function clearMatches(showMessage = true) {
  const matchesList = document.getElementById('matches-list');
  matchesList.innerHTML = '';
  chrome.storage.local.remove('matches');
  
  if (showMessage) {
    showEmptyMessage();
    showNotification('Список матчей очищен', 'info');
  }
}

// Показать сообщение о пустом списке
function showEmptyMessage() {
  const matchesList = document.getElementById('matches-list');
  matchesList.innerHTML = '<div class="empty-message">Нет матчей для отображения<br>Укажите даты и нажмите "Сканировать"</div>';
}

// Отобразить список матчей
function displayMatches(matches) {
  const matchesList = document.getElementById('matches-list');
  matchesList.innerHTML = '';
  
  if (matches.length === 0) {
    showEmptyMessage();
    return;
  }
  
  const uniqueMatches = removeDuplicates(matches);
  
  uniqueMatches.forEach(match => {
    const matchItem = document.createElement('div');
    matchItem.className = 'match-item';
    matchItem.innerHTML = `
      <div class="match-header">
        <div>
          <div class="match-map">${match.map}</div>
          <div class="match-date">${match.date}</div>
        </div>
        <div class="match-duration">${match.duration}</div>
      </div>
      <div class="match-controls">
        <input type="checkbox" class="match-checkbox" data-url="${match.demoUrl}" checked>
        <button class="download-btn " data-url="${match.demoUrl}">Скачать</button>
      </div>
    `;
    matchesList.appendChild(matchItem);
  });
  
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      downloadDemo(this.dataset.url);
    });
  });
}

// Удалить дубликаты
function removeDuplicates(matches) {
  const unique = [];
  const urls = new Set();
  
  for (const match of matches) {
    if (!urls.has(match.demoUrl)) {
      urls.add(match.demoUrl);
      unique.push(match);
    }
  }
  
  return unique;
}

// Выбрать все матчи
function selectAllMatches() {
  const checkboxes = document.querySelectorAll('.match-checkbox');
  const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
  });
  
  showNotification(allChecked ? 'Сняты все отметки' : 'Отмечены все матчи', 'info');
}

// Скачать выбранные матчи
function downloadSelected() {
  const checkboxes = document.querySelectorAll('.match-checkbox:checked');
  
  if (checkboxes.length === 0) {
    showNotification('Выберите хотя бы один матч', 'error');
    return;
  }
  
  showNotification(`Начато скачивание ${checkboxes.length} демо...`, 'info');
  toggleLoader('scan', true);
  disableButtons(true);
  
  let downloadedCount = 0;
  const total = checkboxes.length;
  const urls = Array.from(checkboxes).map(checkbox => checkbox.dataset.url);
  
  const downloadNext = (index) => {
    if (index >= urls.length) {
      toggleLoader('scan', false);
      disableButtons(false);
      showNotification(`Скачано ${downloadedCount} из ${total} демо`, 'success');
      return;
    }
    
    downloadDemo(urls[index], (success) => {
      downloadedCount += success ? 1 : 0;
      // Добавляем небольшую задержку между скачиваниями
      setTimeout(() => downloadNext(index + 1), 5000);
    });
  };
  
  // Начинаем скачивание с первого файла
  downloadNext(0);
}


// Скачать одно демо (новая версия)
function downloadDemo(url, callback) {
  const matchItem = document.querySelector(`.match-checkbox[data-url="${url}"]`)?.closest('.match-item');
  const map = matchItem?.querySelector('.match-map')?.textContent || 'unknown';
  const date = matchItem?.querySelector('.match-date')?.textContent || 'unknown';

  // Генерация безопасного имени файла
  const safeMap = map.replace(/[\\/:*?"<>|]/g, '_').toLowerCase();
  const safeDate = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `CS2_${safeMap}_${safeDate}.dem.bz2`;

  console.log('⬇️ Отправка запроса на скачивание с именем:', filename);

  // Отправка в background.js
  chrome.runtime.sendMessage(
    {
      action: 'download_demo',
      url: url,
      filename: filename
    },
    (response) => {
      if (response?.success) {
        showNotification(`Скачано: ${filename}`, 'success');
        if (callback) callback(true); // Успешное скачивание
      } else {
        showNotification(`Ошибка: ${response?.error || 'Неизвестная ошибка'}`, 'error');
        window.open(url, '_blank');
        if (callback) callback(false); // Ошибка скачивания
      }
    }
  );
}


// Показать/скрыть лоадер
function toggleLoader(type, show) {
  const loader = document.getElementById(`${type}-loader`);
  const btn = document.getElementById(`${type}-btn`);
  
  if (show) {
    loader.classList.add('visible');
    btn.classList.add('btn-loading');
  } else {
    loader.classList.remove('visible');
    btn.classList.remove('btn-loading');
  }
}

// Отключить/включить кнопки
function disableButtons(disable) {
  const buttons = document.querySelectorAll('.btn:not(#clear-btn)');
  buttons.forEach(btn => {
    btn.disabled = disable;
  });
}