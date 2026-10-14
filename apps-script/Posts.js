/**
 * 게시글 목록·저장·삭제. docs/api.md 3-3 · 3-5 · 3-6, docs/sheet-schema.md 2-1 ~ 2-3 · 2-7 · 2-8.
 * 공지(N-0001) · 언론홍보(P-0001) · 갤러리(G-0001) · 표지(H-dance 등)는 같은 흐름으로 처리하고, 차이는 BOARDS_와 검증 함수에만 둔다.
 * 표지는 칸이 고정(fixed)이라 새로 만들거나 지우지 않고, 사진 한 장만 바꾼다 (Setup.js HERO_SLOTS_).
 */

var BOARDS_ = {
  notice:  { tab: '공지',     prefix: 'N', validate: function (p) { return validateNotice_(p); },
             maxPhotos: function () { return LIMITS_.noticePhotos; },  maxFiles: function () { return LIMITS_.noticeFiles; } },
  press:   { tab: '언론홍보', prefix: 'P', validate: function (p) { return validatePress_(p); },
             maxPhotos: function () { return 0; }, maxFiles: function () { return 0; } },
  gallery: { tab: '갤러리',   prefix: 'G', validate: function (p) { return validateGallery_(p); },
             maxPhotos: function () { return LIMITS_.galleryPhotos; }, maxFiles: function () { return 0; } },
  hero:    { tab: '표지', fixed: true, validate: function (p) { return validateHero_(p); },
             maxPhotos: function () { return 1; }, maxFiles: function () { return 0; } }
};

function handleList_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);

  var attachments = readTab_('첨부');
  var notices = readTab_('공지').map(function (r) { return noticeFromRow_(r, attachments, true); });
  var press = readTab_('언론홍보').map(function (r) { return pressFromRow_(r, true); });
  var gallery = readTab_('갤러리').map(function (r) { return galleryFromRow_(r, attachments, true); });
  var hero = readTab_('표지').map(function (r) { return heroFromRow_(r, attachments); });
  return jsonResponse_(true, null, {
    notices: sortNotices_(notices),
    press: sortByDate_(press),
    gallery: sortByDate_(gallery),
    hero: hero,
    categories: getCategories_(),
    limits: LIMITS_,
    lastPublish: getLastPublish_()
  });
}

function handleSave_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);
  var board = BOARDS_[req.board];
  if (!board) return jsonResponse_(false, 'INVALID_INPUT', null);

  var fields = board.validate(req.post);
  if (!fields || (board.fixed && !req.id)) return jsonResponse_(false, 'INVALID_INPUT', null);

  var photoIds = idList_(req.photos), fileIds = idList_(req.files);
  if (!photoIds || !fileIds) return jsonResponse_(false, 'INVALID_INPUT', null);
  if (photoIds.length > board.maxPhotos() || fileIds.length > board.maxFiles()) return jsonResponse_(false, 'FILE_REJECTED', null);

  return withLock_(function () {
    var rows = readTab_(board.tab);
    var existing = null;
    if (req.id) {
      existing = rows.filter(function (r) { return r['글ID'] === req.id; })[0];
      if (!existing) return jsonResponse_(false, 'NOT_FOUND', null);
    }
    // 첨부 확인: 「첨부」에 있고, 구분이 맞고, 아직 어느 글에도 붙지 않았거나 이 글의 것이어야 한다.
    var ownId = existing ? existing['글ID'] : '';
    var attachments = readTab_('첨부');
    var byId = {};
    attachments.forEach(function (a) { byId[a['첨부ID']] = a; });
    var seen = {};
    var ok = [[photoIds, '사진'], [fileIds, '파일']].every(function (pair) {
      return pair[0].every(function (aid) {
        var a = byId[aid];
        if (!a || seen[aid] || a['구분'] !== pair[1] || (a['글ID'] && a['글ID'] !== ownId)) return false;
        seen[aid] = true;
        return true;
      });
    });
    if (!ok) return jsonResponse_(false, 'NOT_FOUND', null);

    // 새 글 번호는 검증을 모두 통과한 뒤에 받는다(실패한 저장이 번호를 쓰지 않게). 표지 칸은 늘 기존 행이다.
    var id = ownId || nextId_(board.prefix, 4, rows.map(function (r) { return r['글ID']; }));
    if (board.fixed) fields['칸'] = existing['칸'];

    var now = new Date();
    fields['글ID'] = id;
    fields['작성자'] = existing ? existing['작성자'] : auth.name;
    fields['작성시각'] = existing ? existing['작성시각'] : now;
    fields['수정자'] = auth.name;
    fields['수정시각'] = now;
    writeRow_(board.tab, fields, existing && existing._row);

    // 첨부 행에 글ID·순서를 적고, 이 글에서 빠진 첨부는 휴지통으로 보낸다.
    [photoIds, fileIds].forEach(function (ids) {
      ids.forEach(function (aid, i) {
        var a = byId[aid];
        if (a['글ID'] === id && Number(a['순서']) === i + 1) return;
        a['글ID'] = id;
        a['순서'] = i + 1;
        writeRow_('첨부', a, a._row);
      });
    });
    var dropped = attachments.filter(function (a) { return a['글ID'] === id && !seen[a['첨부ID']]; });
    dropped.forEach(function (a) { discardFile_(a['파일ID']); });
    deleteRows_('첨부', dropped.map(function (a) { return a._row; }));

    logAccess_('성공', auth.code, auth.name, '', 'save', id);
    var published = publish_(auth.name);
    return jsonResponse_(true, null, { id: id, published: published.ok });
  });
}

function handleRemove_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);
  var board = BOARDS_[req.board];
  if (!board || board.fixed || !req.id) return jsonResponse_(false, 'INVALID_INPUT', null);

  return withLock_(function () {
    var row = readTab_(board.tab).filter(function (r) { return r['글ID'] === req.id; })[0];
    if (!row) return jsonResponse_(false, 'NOT_FOUND', null);

    var mine = readTab_('첨부').filter(function (a) { return a['글ID'] === req.id; });
    mine.forEach(function (a) { discardFile_(a['파일ID']); });
    deleteRows_('첨부', mine.map(function (a) { return a._row; }));
    deleteRows_(board.tab, [row._row]);

    logAccess_('성공', auth.code, auth.name, '', 'remove', req.id);
    var published = publish_(auth.name);
    return jsonResponse_(true, null, { published: published.ok });
  });
}

/* ---------- 검증 (docs/sheet-schema.md 2-1 · 2-2 · 2-7 · 2-8) ---------- */

// 통과하면 시트에 쓸 { 머리글: 값 }, 아니면 null
function validateNotice_(p) {
  if (!p) return null;
  var title = cleanText_(p.title), body = cleanText_(p.body, true), link = cleanText_(p.photoLink);
  var date = cleanDate_(p.date), vis = cleanVisibility_(p.visibility);
  if (getCategories_().indexOf(p.category) === -1) return null;
  if (!title || title.length > LIMITS_.noticeTitle || body.length > LIMITS_.noticeBody) return null;
  if (!date || !vis) return null;
  if (p.photoPosition !== 'top' && p.photoPosition !== 'bottom') return null;
  if (link && (link.length > LIMITS_.link || !/^https?:\/\/\S+$/i.test(link))) return null;
  return {
    '분류': p.category, '제목': title, '본문': body, '게시일': date,
    '상단고정': p.pinned === true ? '예' : '', '사진위치': p.photoPosition === 'bottom' ? '아래' : '위',
    '사진링크': link, '공개여부': vis
  };
}

function validateGallery_(p) {
  if (!p) return null;
  var title = cleanText_(p.title), desc = cleanText_(p.desc);
  var date = cleanDate_(p.date), vis = cleanVisibility_(p.visibility);
  if (!title || title.length > LIMITS_.galleryTitle || desc.length > LIMITS_.galleryDesc) return null;
  if (!date || !vis) return null;
  return { '제목': title, '설명': desc, '게시일': date, '공개여부': vis };
}

// 언론홍보: 기사 한 건. 목록에서 누르면 기사 주소가 새 탭으로 열린다 (사이트 안 상세 화면 없음)
function validatePress_(p) {
  if (!p) return null;
  var title = cleanText_(p.title), source = cleanText_(p.source), url = cleanText_(p.url);
  var date = cleanDate_(p.date), vis = cleanVisibility_(p.visibility);
  if (!title || title.length > LIMITS_.pressTitle || !source || source.length > LIMITS_.pressSource) return null;
  if (!date || !vis) return null;
  if (!url || url.length > LIMITS_.link || !/^https?:\/\/\S+$/i.test(url)) return null;
  return { '언론사': source, '제목': title, '게시일': date, '기사주소': url, '공개여부': vis };
}

// 표지: 적을 값이 없다(사진만 바꿈). 칸 이름은 handleSave_가 기존 행에서 옮긴다
function validateHero_(p) {
  return {};
}

// 여러 줄을 허용하지 않으면 줄바꿈을 공백으로 바꾼다. 줄바꿈은 \n 하나로 맞춘다.
function cleanText_(value, multiline) {
  var s = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
  if (!multiline) s = s.replace(/\n/g, ' ');
  return s.trim();
}

function cleanDate_(value) {
  var s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}

function cleanVisibility_(value) {
  return value === '공개' || value === '비공개' ? value : '';
}

function idList_(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  return value.every(function (v) { return typeof v === 'string' && /^A-\d+$/.test(v); }) ? value : null;
}

/* ---------- 시트 행 → 화면용 객체 (admin=true면 관리용 값 포함) ---------- */

function attachmentsOf_(postId, kind, attachments, admin) {
  return attachments
    .filter(function (a) { return a['글ID'] === postId && a['구분'] === kind; })
    .sort(function (a, b) { return Number(a['순서']) - Number(b['순서']); })
    .map(function (a) {
      var o = { fileId: String(a['파일ID']) };
      if (kind === '사진') { o.w = Number(a['가로']) || 0; o.h = Number(a['세로']) || 0; }
      else { o.name = String(a['파일명']); o.size = Number(a['크기']) || 0; }
      if (admin) { o.attachmentId = a['첨부ID']; o.name = String(a['파일명']); o.size = Number(a['크기']) || 0; }
      return o;
    });
}

function noticeFromRow_(r, attachments, admin) {
  var o = {
    id: r['글ID'], category: String(r['분류']), title: String(r['제목']), body: String(r['본문']),
    date: formatDateCell_(r['게시일']), pinned: r['상단고정'] === '예',
    photoPosition: r['사진위치'] === '아래' ? 'bottom' : 'top', photoLink: String(r['사진링크']),
    photos: attachmentsOf_(r['글ID'], '사진', attachments, admin),
    files: attachmentsOf_(r['글ID'], '파일', attachments, admin)
  };
  if (admin) addAdminFields_(o, r);
  return o;
}

function galleryFromRow_(r, attachments, admin) {
  var o = {
    id: r['글ID'], title: String(r['제목']), desc: String(r['설명']), date: formatDateCell_(r['게시일']),
    photos: attachmentsOf_(r['글ID'], '사진', attachments, admin)
  };
  if (admin) addAdminFields_(o, r);
  return o;
}

function pressFromRow_(r, admin) {
  var o = { id: r['글ID'], source: String(r['언론사']), title: String(r['제목']), date: formatDateCell_(r['게시일']), url: String(r['기사주소']) };
  if (admin) addAdminFields_(o, r);
  return o;
}

// 관리용만 — 방문자용은 Publish.js가 { dance: 사진, … } 모양으로 만든다. photos는 0장 또는 1장
function heroFromRow_(r, attachments) {
  return {
    id: r['글ID'], slot: String(r['글ID']).replace(/^H-/, ''), label: String(r['칸']),
    photos: attachmentsOf_(r['글ID'], '사진', attachments, true),
    updatedBy: String(r['수정자']), updatedAt: formatDateTimeCell_(r['수정시각'])
  };
}

function addAdminFields_(o, r) {
  o.visibility = r['공개여부'];
  o.author = String(r['작성자']);
  o.createdAt = formatDateTimeCell_(r['작성시각']);
  o.updatedBy = String(r['수정자']);
  o.updatedAt = formatDateTimeCell_(r['수정시각']);
}

/* ---------- 정렬 (docs/sheet-schema.md 3절) ---------- */

function sortNotices_(list) {
  return list.sort(function (a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

// 갤러리 · 언론홍보: 게시일 최신순(같으면 글ID 큰 순)
function sortByDate_(list) {
  return list.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}
