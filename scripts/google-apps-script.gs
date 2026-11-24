/**
 * Отель в лесу — приём заявок из формы в Google Таблицу.
 *
 * Как установить:
 * 1. Создайте Google Таблицу (например, «Заявки — Отель в лесу»).
 * 2. В таблице: Расширения -> Apps Script.
 * 3. Удалите содержимое файла Code.gs и вставьте этот код.
 * 4. Сохраните проект.
 * 5. Развёртывание -> Новое развёртывание -> Веб-приложение.
 *    - «Выполнять как»: Я (me)
 *    - «У кого есть доступ»: Все (Anyone)
 * 6. Скопируйте «URL веб-приложения» и вставьте его в CONFIG.booking.googleSheetsUrl
 *    в файле assets/js/main.js.
 *
 * Форма отправляет данные GET-запросом и ожидает JSONP-ответ,
 * поэтому doGet возвращает вызов функции с подтверждением.
 */

const SHEET_NAME = 'Заявки';

function writeLead(params) {
  const p = params || {};
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Дата и время',
      'Источник',
      'Цель',
      'Имя',
      'Телефон',
      'Заезд',
      'Выезд',
      'Гостей',
      'Номер',
      'Пожелания',
      'Страница',
      'Тема'
    ]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    p.submittedAt || new Date().toISOString(),
    'Лендинг «Отель в лесу»',
    p.purpose || '',
    p.name || '',
    p.phone || '',
    p.dateIn || '',
    p.dateOut || '',
    p.guests || '',
    p.room || '',
    p.message || '',
    p.page || '',
    p.theme || ''
  ]);
}

function doGet(e) {
  writeLead(e.parameter);

  const callback = e.parameter && e.parameter.callback;
  const safe = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback || '') ? callback : '';
  const body = safe ? `${safe}({"ok":true});` : 'ok';

  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// Оставлен на случай отправки POST-запросом с другого сайта/сервера.
function doPost(e) {
  writeLead(e.parameter);
  return ContentService.createTextOutput('ok');
}
