/**
 * 「로그」 탭 기록 (docs/sheet-schema.md 2-6). 관리자 요청은 많지 않아 아카이빙처럼 모아 쓰지 않고 바로 쓴다.
 * 열 순서: 일시 · 결과 · 코드 · 이름 · 기기ID · 요청 · 대상
 */
function logAccess_(result, code, name, deviceId, requestType, target) {
  try {
    var sheet = getSheet_('로그');
    var row = [new Date(), result, code, name, deviceId, requestType, target].map(function (v, i) {
      return i === 0 ? v : sanitizeForSheet_(v);
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  } catch (err) {
    console.error(err); // 기록 실패가 요청 자체를 막지 않게 한다
  }
}
