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
const PHONE_COLUMN = 5;

/**
 * Лидирующий апостроф заставляет Таблицу хранить номер как текст.
 * В ячейке он не отображается, но защищает телефон от разбора как формулы.
 */
function toTextPhone(value) {
  const phone = String(value || '');
  return phone.charAt(0) === "'" ? phone : "'" + phone;
}

/**
 * Телефон начинается с «+», поэтому Таблица может принять его за формулу
 * и показать #ERROR. Заранее задаём столбцу текстовый формат.
 */
function preparePhoneColumn(sheet) {
  sheet.getRange(2, PHONE_COLUMN, Math.max(1, sheet.getMaxRows() - 1), 1)
    .setNumberFormat('@');

  // Восстанавливаем уже испорченные ячейки: их формулу можно прочитать
  // и записать обратно как текст без ведущего «=».
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (let row = 2; row <= lastRow; row++) {
    const cell = sheet.getRange(row, PHONE_COLUMN);
    const formula = cell.getFormula();
    if (typeof formula === 'string' && /^=?\+?[\d(]/.test(formula)) {
      cell.setValue(toTextPhone(formula.replace(/^=/, '')));
    }
  }
}

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

  preparePhoneColumn(sheet);

  sheet.appendRow([
    p.submittedAt || new Date().toISOString(),
    'Лендинг «Отель в лесу»',
    p.purpose || '',
    p.name || '',
    toTextPhone(p.phone),
    p.dateIn || '',
    p.dateOut || '',
    p.guests || '',
    p.room || '',
    p.message || '',
    p.page || '',
    p.theme || ''
  ]);
}

/**
 * Можно запустить вручную из редактора Apps Script, чтобы починить
 * уже существующие ячейки с #ERROR без отправки новой заявки.
 */
function fixExistingPhones() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  preparePhoneColumn(sheet);
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
