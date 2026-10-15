/**
 * 첨부(사진·파일) 업로드와 드라이브 처리. docs/api.md 3-4, docs/decisions.md 5절.
 * 올리는 즉시 「링크가 있는 사용자 — 보기」로 공유한다(관리자 화면이 비공개 글의 사진도 보여 주기 위함, 2026-10-13 결정).
 * 폴더는 공유하지 않는다. 글에서 빠지거나 글이 지워지면 공유를 끊고 휴지통으로 보낸다(30일 안에 복구 가능).
 */

function handleUpload_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);

  // cutout: 표지 2.5D용 누끼 사진(투명 배경 PNG). 관리자 화면이 원본과 같은 크기로 맞춰 PNG 그대로 올린다 (docs/decisions.md 2절)
  var kind = req.kind === 'photo' || req.kind === 'file' || req.kind === 'cutout' ? req.kind : null;
  var name = cleanFileName_(req.name);
  var mimeType = String(req.mimeType || '').toLowerCase();
  if (!kind || !name || !req.base64) return jsonResponse_(false, 'FILE_REJECTED', null);

  var ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1];
  ext = ext ? ext.toLowerCase() : '';
  var width = 0, height = 0;
  if (kind === 'photo' || kind === 'cutout') {
    if (kind === 'photo' ? LIMITS_.photoTypes.indexOf(mimeType) === -1 : mimeType !== 'image/png') return jsonResponse_(false, 'FILE_REJECTED', null);
    width = Math.round(Number(req.width)) || 0;
    height = Math.round(Number(req.height)) || 0;
    if (width < 1 || height < 1 || width > 10000 || height > 10000) return jsonResponse_(false, 'FILE_REJECTED', null);
  } else {
    if (LIMITS_.fileExts.indexOf(ext) === -1) return jsonResponse_(false, 'FILE_REJECTED', null);
    if (!mimeType || mimeType.length > 200) mimeType = 'application/octet-stream';
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(String(req.base64));
  } catch (err) {
    return jsonResponse_(false, 'FILE_REJECTED', null);
  }
  var maxBytes = kind === 'photo' ? LIMITS_.photoBytes : kind === 'cutout' ? LIMITS_.cutoutBytes : LIMITS_.fileBytes;
  if (!bytes.length || bytes.length > maxBytes) return jsonResponse_(false, 'FILE_REJECTED', null);

  // 드라이브 저장은 오래 걸려(수 초) 잠금 밖에서 한다 — 관리자 화면이 여러 장을 동시에 올릴 수 있게.
  // 번호 매기기와 시트 기록만 잠근다. 잠금을 못 잡으면 올린 파일을 버리고 BUSY.
  var file = getUploadFolder_().createFile(Utilities.newBlob(bytes, mimeType, name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    discardFile_(file.getId());
    return jsonResponse_(false, 'BUSY', null);
  }
  try {
    var id = nextId_('A', 5, readTab_('첨부').map(function (r) { return r['첨부ID']; }));
    writeRow_('첨부', {
      '첨부ID': id, '글ID': '', '구분': KIND_LABELS_[kind], '순서': '',
      '파일ID': file.getId(), '파일명': name, '크기': bytes.length,
      '가로': width || '', '세로': height || '', '공유': '공유',
      '올린사람': auth.name, '올린시각': new Date()
    });
  } finally {
    lock.releaseLock();
  }
  logAccess_('성공', auth.code, auth.name, '', 'upload', id);
  return jsonResponse_(true, null, { attachmentId: id, fileId: file.getId(), size: bytes.length });
}

// 업로드 종류 → 「첨부」 탭의 구분
var KIND_LABELS_ = { photo: '사진', file: '파일', cutout: '누끼' };

// 경로 문자와 제어 문자를 빼고 길이를 줄인다. 드라이브에 이 이름으로 저장돼 내려받을 때 그대로 쓰인다.
function cleanFileName_(raw) {
  var name = String(raw || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  if (name.length > LIMITS_.fileName) {
    var dot = name.lastIndexOf('.');
    var ext = dot > 0 ? name.slice(dot) : '';
    name = name.slice(0, LIMITS_.fileName - ext.length) + ext;
  }
  return name;
}

function getUploadFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!id) throw new Error('DRIVE_FOLDER_ID가 없음 — Setup.js의 setup()을 먼저 실행할 것');
  return DriveApp.getFolderById(id);
}

// 공유를 끊고 휴지통으로 보낸다. 이미 지워졌거나 열 수 없는 파일은 넘어간다.
function discardFile_(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    file.setTrashed(true);
  } catch (err) {
    console.error(err);
  }
}

/**
 * 올리기만 하고 글에 저장하지 않은 첨부(글ID 빈칸)를 정리한다. 하루 넘게 지난 것만 지운다.
 * 정리 방식(자동·수동)은 확인 필요 — 지금은 편집기에서 직접 실행한다.
 */
function cleanupOrphanUploads() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    var orphans = readTab_('첨부').filter(function (r) {
      var at = r['올린시각'] instanceof Date ? r['올린시각'].getTime() : 0;
      return !r['글ID'] && at && at < dayAgo;
    });
    orphans.forEach(function (r) { discardFile_(r['파일ID']); });
    deleteRows_('첨부', orphans.map(function (r) { return r._row; }));
    Logger.log('정리한 첨부: ' + orphans.length + '개');
  } finally {
    lock.releaseLock();
  }
}
