/**
 * 인증부. docs/decisions.md 6절: 지금은 공용 접근코드 + 이름 입력이고, 추후 구글 로그인으로 바뀔 수 있다.
 * 바꿀 때는 이 파일(authenticate_)과 Token.js의 발급 부분만 교체하고,
 * 다른 파일은 requireAuth_()가 돌려주는 { name }만 쓰도록 유지한다.
 */

var NAME_MAX_LENGTH_ = 20;

// 저장·삭제 등 모든 관리 요청의 첫 줄. 반환: { ok: true, name, code } 또는 { ok: false, error }
function requireAuth_(req) {
  var result = verifyToken_(req && req.token);
  if (!result.valid) return { ok: false, error: result.error };
  return { ok: true, name: result.payload.name, code: result.payload.code };
}

/**
 * 화면은 응답이 늦으면 같은 auth 요청을 한 번 더 보낼 수 있다(예비 요청).
 * 두 요청이 각각 토큰을 발급하고 로그를 남기지 않도록, 같은 requestId면 먼저 만든 응답을 돌려준다.
 */
function handleAuth_(req) {
  if (!req.requestId) return resultResponse_(authenticate_(req));

  var cache = CacheService.getScriptCache();
  var key = 'auth_' + String(req.requestId).slice(0, 200);
  var saved = cache.get(key);
  if (saved) {
    try {
      return resultResponse_(JSON.parse(saved));
    } catch (err) {
      // 캐시가 깨졌으면 새로 처리한다
    }
  }
  var result = authenticate_(req);
  cache.put(key, JSON.stringify(result), 120);
  return resultResponse_(result);
}

function resultResponse_(result) {
  return jsonResponse_(result.ok, result.error, result.data);
}

// docs/api.md 3-1 검증 순서: 기기 잠금 → 코드 존재 → 상태 "사용" → 사용기한 → 발급·기록
function authenticate_(req) {
  var code = String(req.code || '').trim();
  var name = String(req.name || '').trim().slice(0, NAME_MAX_LENGTH_);
  var deviceId = String(req.deviceId || '').slice(0, 100);
  var fail = function (error) { return { ok: false, error: error, data: null }; };

  if (!code || !name || !deviceId) return fail('AUTH_INVALID');

  if (isDeviceLocked_(deviceId)) {
    logAccess_('실패(AUTH_LOCKED)', code, name, deviceId, 'auth', '');
    return fail('AUTH_LOCKED');
  }

  var row = findCodeRow_(code);
  if (!row || row['상태'] !== '사용') {
    recordAuthFailure_(deviceId);
    logAccess_('실패(AUTH_INVALID)', code, name, deviceId, 'auth', '');
    return fail('AUTH_INVALID');
  }
  if (!isWithinExpiry_(row['사용기한'])) {
    recordAuthFailure_(deviceId);
    logAccess_('실패(AUTH_EXPIRED)', code, name, deviceId, 'auth', '');
    return fail('AUTH_EXPIRED');
  }

  clearAuthFailures_(deviceId);
  var issued = issueToken_(row, name);
  logAccess_('성공', code, name, deviceId, 'auth', '');
  return { ok: true, error: null, data: { token: issued.token, expiresAt: issued.expiresAt, name: name } };
}

// docs/api.md 3-2. 새 토큰을 발급해 만료 시각을 늘린다.
function handlePing_(req) {
  var result = verifyToken_(req.token);
  if (!result.valid) return jsonResponse_(false, result.error, null);
  var issued = issueToken_(result.row, result.payload.name);
  return jsonResponse_(true, null, { token: issued.token, expiresAt: issued.expiresAt });
}
