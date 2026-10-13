/**
 * 시트 접근 공통 함수. 관문이 붙어 있는 시트 하나만 쓴다 (docs/sheet-schema.md 1절).
 * 탭·열은 이름으로 찾는다 — 이름을 바꾸면 그 기능이 멈추므로 Setup.js의 이름과 맞춰야 한다.
 */

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('탭을 찾을 수 없음: ' + name);
  return sheet;
}

// 첫 행을 머리글로 삼아 각 행을 { 머리글: 값, _row: 시트 행 번호 } 객체로 반환한다. 빈 행은 건너뛴다.
function readTab_(name) {
  var values = getSheet_(name).getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i].join('') === '') continue;
    var obj = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    rows.push(obj);
  }
  return rows;
}

function headersOf_(name) {
  var sheet = getSheet_(name);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

// obj({ 머리글: 값 })를 머리글 순서의 배열로 바꿔 rowNumber 행에 쓰고, rowNumber가 없으면 맨 아래에 붙인다.
function writeRow_(name, obj, rowNumber) {
  var sheet = getSheet_(name);
  var headers = headersOf_(name);
  var row = headers.map(function (h) {
    var v = obj[h];
    if (v instanceof Date || typeof v === 'number') return v;
    return sanitizeForSheet_(v);
  });
  var target = rowNumber || sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
}

// 행 번호 목록을 지운다. 위에서부터 지우면 아래 행 번호가 밀리므로 아래부터 지운다.
function deleteRows_(name, rowNumbers) {
  var sheet = getSheet_(name);
  rowNumbers.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sheet.deleteRow(r); });
}

// docs/api.md 1절: 시트에 쓰는 값은 수식 주입을 막는다(= + - @ 로 시작하면 앞에 ' 를 붙인다).
function sanitizeForSheet_(value) {
  var str = String(value == null ? '' : value);
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

function findCodeRow_(code) {
  if (!code) return null;
  var rows = readTab_('접근코드');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['코드']).trim() === code) return rows[i];
  }
  return null;
}

// 시트가 "2026-07-17"을 Date로 바꿔 둔 경우와 문자열로 남아 있는 경우를 모두 yyyy-MM-dd로 맞춘다.
function formatDateCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value == null ? '' : value).trim();
}

function formatDateTimeCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return String(value == null ? '' : value);
}

// 사용기한이 비어 있으면 무기한, 있으면 그날 23:59:59(한국 시각)까지 유효하다.
function isWithinExpiry_(value) {
  var day = formatDateCell_(value);
  if (!day) return true;
  var expiry = new Date(day.slice(0, 10) + 'T23:59:59+09:00');
  if (isNaN(expiry.getTime())) return false;
  return Date.now() <= expiry.getTime();
}

// 글ID·첨부ID는 지워진 번호를 다시 쓰지 않는다(예전 주소 #notice/N-0005가 다른 글을 가리키지 않게).
// 마지막 번호는 Script Properties에 두고, 시트에 더 큰 번호가 있으면 그쪽을 따른다.
function nextId_(prefix, digits, existingIds) {
  var props = PropertiesService.getScriptProperties();
  var key = 'LAST_ID_' + prefix;
  var last = Number(props.getProperty(key)) || 0;
  existingIds.forEach(function (id) {
    var m = String(id).match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (m) last = Math.max(last, Number(m[1]));
  });
  last += 1;
  props.setProperty(key, String(last));
  var num = String(last);
  while (num.length < digits) num = '0' + num;
  return prefix + '-' + num;
}
