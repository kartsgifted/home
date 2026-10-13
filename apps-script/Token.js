/**
 * 토큰: { code, ver, exp, name }을 서명해 넣는 자체 완결형(stateless) 토큰. 아카이빙 Token.js에 name을 더했다.
 * docs/api.md 5절 — 유효시간 2시간, 코드 버전 변경 시 일괄 무효화, 서명 키는 Script Properties에만 둠.
 */

var TOKEN_LIFETIME_MS_ = 2 * 60 * 60 * 1000; // 2시간

function getTokenSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret) throw new Error('TOKEN_SECRET이 없음 — Setup.js의 setup()을 먼저 실행할 것');
  return secret;
}

function signToken_(payload) {
  var payloadB64 = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  var sigB64 = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payloadB64, getTokenSecret_()));
  return payloadB64 + '.' + sigB64;
}

// 「접근코드」 행의 현재 버전으로 새 토큰을 만든다 (auth·ping 공용).
function issueToken_(codeRow, name) {
  var expiresAt = Date.now() + TOKEN_LIFETIME_MS_;
  var token = signToken_({ code: codeRow['코드'], ver: Number(codeRow['버전']) || 0, exp: expiresAt, name: name });
  return { token: token, expiresAt: expiresAt };
}

// 반환: { valid: false, error } 또는 { valid: true, payload, row }
function verifyToken_(token) {
  if (!token || typeof token !== 'string') return { valid: false, error: 'TOKEN_INVALID' };
  var parts = token.split('.');
  if (parts.length !== 2) return { valid: false, error: 'TOKEN_INVALID' };

  var expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], getTokenSecret_()));
  if (expected !== parts[1]) return { valid: false, error: 'TOKEN_INVALID' };

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    return { valid: false, error: 'TOKEN_INVALID' };
  }
  if (!payload.exp || Date.now() > payload.exp) return { valid: false, error: 'TOKEN_EXPIRED' };

  // 코드가 정지됐거나 버전이 바뀌었으면(코드 유출 등) 즉시 무효화한다.
  var row = findCodeRow_(payload.code);
  if (!row || row['상태'] !== '사용' || (Number(row['버전']) || 0) !== Number(payload.ver)) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }
  return { valid: true, payload: payload, row: row };
}
