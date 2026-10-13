/**
 * docs/api.md 6절 실패 제한. 임계치는 「설정」 탭에서 조정 가능하고, 값이 없으면 기본값을 쓴다.
 * 공용 코드 하나를 쓰므로(docs/decisions.md 6절) 코드별이 아니라 전체 실패 수로 급증을 본다.
 */

var DEVICE_FAIL_LIMIT_DEFAULT_ = 5;     // 기기별 5회
var DEVICE_LOCK_MINUTES_DEFAULT_ = 10;  // 10분 잠금
var SURGE_LIMIT_ = 20;                  // 10분 안에 전체 20회 실패면 알림
var SURGE_WINDOW_MINUTES_ = 10;

function isDeviceLocked_(deviceId) {
  var count = Number(CacheService.getScriptCache().get('authfail_device_' + deviceId)) || 0;
  return count >= Number(getSetting_('기기별 실패 잠금 기준', DEVICE_FAIL_LIMIT_DEFAULT_));
}

function clearAuthFailures_(deviceId) {
  CacheService.getScriptCache().remove('authfail_device_' + deviceId);
}

function recordAuthFailure_(deviceId) {
  var cache = CacheService.getScriptCache();
  var lockMinutes = Number(getSetting_('기기별 잠금 시간(분)', DEVICE_LOCK_MINUTES_DEFAULT_));
  var deviceKey = 'authfail_device_' + deviceId;
  cache.put(deviceKey, String((Number(cache.get(deviceKey)) || 0) + 1), lockMinutes * 60);

  var total = (Number(cache.get('authfail_all')) || 0) + 1;
  cache.put('authfail_all', String(total), SURGE_WINDOW_MINUTES_ * 60);
  if (total === SURGE_LIMIT_) {
    notifyStaff_('로그인 실패 급증', '최근 ' + SURGE_WINDOW_MINUTES_ + '분간 관리자 로그인 실패가 ' + total + '회 발생했습니다.');
  }
}

// 「설정」의 운영진 알림 메일이 비어 있으면 아무것도 하지 않는다.
function notifyStaff_(subject, body) {
  var email = getSetting_('운영진 알림 메일', '');
  if (!email) return;
  try {
    MailApp.sendEmail(email, '[K예술영재 홍보 사이트] ' + subject, body);
  } catch (err) {
    console.error(err);
  }
}
