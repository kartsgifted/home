/* ============================================================
   2026 K예술영재 프로젝트 — admin.js
   게시글 관리 화면. 관문(Apps Script)만 부른다 — docs/api.md.
   ▣ 관문 주소는 공개된다고 가정한다. 권한 확인은 관문이 요청마다 한다 (CLAUDE.md 보안 1·2).
   ▣ 토큰은 sessionStorage(탭을 닫으면 로그아웃), 기기ID만 localStorage.
   ▣ 운영진이 입력한 값은 textContent로만 화면에 넣는다.
   ============================================================ */
(function(){
  var GATEWAY = 'https://script.google.com/macros/s/AKfycbzfrJrDmXwhRAb62MEVCiWFDLU2e-HzFy5R9RWTkw0uatO9BMlYgCi5dPlNfUgIxAEITQ/exec';
  var K = { token:'hp_admin_token', exp:'hp_admin_exp', name:'hp_admin_name', device:'hp_admin_device' };
  var UPLOAD_PARALLEL = 3;     /* 사진을 동시에 올리는 수 (관문은 시트 기록만 잠근다) */
  var PHOTO_MAX_SIDE = 1600;   /* 올리기 전 긴 변 (docs/decisions.md 5절) */

  var S = { token:null, exp:0, name:'', data:null, tab:'notice', edit:null, lastActive:Date.now() };
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- 저장소 (막혀 있어도 화면은 동작) ---------- */
  function ss(k, v){ try{ if(v === undefined) return sessionStorage.getItem(k); if(v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); }catch(e){ return null; } }
  function ls(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
  function deviceId(){
    var id = ls(K.device);
    if(!id){ id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)); ls(K.device, id); }
    return id || 'no-storage';
  }

  /* ---------- 요소 만들기 ---------- */
  function h(tag, attrs, kids){
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){
      var v = attrs[k];
      if(v == null || v === false) return;
      if(k === 'class') e.className = v;
      else if(k === 'text') e.textContent = v;
      else if(k === 'value') e.value = v;
      else if(k === 'checked' || k === 'disabled' || k === 'selected') e[k] = !!v;
      else if(k === 'style') e.style.cssText = v;
      else if(k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids == null ? [] : kids).forEach(function(c){
      if(c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* ---------- 알림 · 처리 중 ---------- */
  var toastTimer;
  function toast(msg, isErr){
    var t = $('toast'); t.textContent = msg; t.className = 'ad-toast on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.className = 'ad-toast'; }, isErr ? 6000 : 3500);
  }
  function busy(msg){ $('busyMsg').textContent = msg || ''; $('busy').hidden = !msg; }

  var ERRORS = {
    AUTH_INVALID:'접근코드가 맞지 않습니다.',
    AUTH_EXPIRED:'사용기한이 지난 접근코드입니다.',
    AUTH_LOCKED:'로그인 실패가 많아 잠겼습니다. 10분 뒤 다시 시도해 주세요.',
    INVALID_INPUT:'입력값을 확인해 주세요.',
    FILE_REJECTED:'올릴 수 없는 파일입니다. 형식과 크기를 확인해 주세요.',
    NOT_FOUND:'글이나 첨부를 찾을 수 없습니다. 다른 사람이 지웠을 수 있습니다.',
    BUSY:'다른 저장이 진행 중입니다. 잠시 뒤 다시 눌러 주세요.',
    NETWORK:'인터넷 연결을 확인해 주세요.',
    TIMEOUT:'응답이 너무 늦습니다. 잠시 뒤 다시 시도해 주세요.',
    SERVER_ERROR:'처리 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.'
  };
  function errMsg(e){ return ERRORS[e && e.code] || ERRORS.SERVER_ERROR; }

  /* ---------- 관문 호출 ---------- */
  function GatewayError(code){ this.code = code; }

  function call(body, timeoutMs){
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function(){ ctrl.abort(); }, timeoutMs || 60000);
    return fetch(GATEWAY, {
      method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body:JSON.stringify(body), signal:ctrl && ctrl.signal
    }).catch(function(e){
      throw new GatewayError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
    }).then(function(r){
      return r.json().catch(function(){ throw new GatewayError('SERVER_ERROR'); });
    }).then(function(j){
      clearTimeout(timer);
      if(!j.ok) throw new GatewayError(j.error || 'SERVER_ERROR');
      return j.data;
    }, function(e){ clearTimeout(timer); throw e; });
  }

  // 토큰이 필요한 요청. 로그인이 만료됐으면 작업 화면은 그대로 두고 로그인 창을 띄운 뒤 같은 요청을 다시 보낸다.
  function api(action, extra, timeoutMs){
    var go = function(){ return call(Object.assign({ action:action, token:S.token }, extra), timeoutMs); };
    if(!S.token || Date.now() > S.exp) return relogin().then(go);
    return go().catch(function(e){
      if(e.code === 'TOKEN_EXPIRED' || e.code === 'TOKEN_INVALID') return relogin().then(go);
      throw e;
    });
  }

  /* ---------- 로그인 ---------- */
  var loginWaiters = [];
  function setSession(d){
    S.token = d.token; S.exp = d.expiresAt; S.name = d.name;
    ss(K.token, d.token); ss(K.exp, String(d.expiresAt));
    $('who').textContent = d.name + ' 님';
    $('user').hidden = false;
  }
  function showLogin(message){
    $('loginSub').textContent = message || '운영진 접근코드와 이름을 입력해 주세요.';
    $('loginErr').textContent = '';
    $('code').value = '';
    $('name').value = ls(K.name) || '';
    $('login').hidden = false;
    ($('name').value ? $('code') : $('name')).focus();
  }
  function relogin(){
    return new Promise(function(resolve){
      loginWaiters.push(resolve);
      if($('login').hidden) showLogin(S.data ? '로그인 시간이 지났습니다. 다시 로그인하면 하던 작업을 이어서 합니다.' : null);
    });
  }
  $('loginForm').addEventListener('submit', function(ev){
    ev.preventDefault();
    var code = $('code').value.trim(), name = $('name').value.trim();
    if(!code || !name){ $('loginErr').textContent = '접근코드와 이름을 모두 입력해 주세요.'; return; }
    $('loginBtn').disabled = true; $('loginErr').textContent = '';
    call({ action:'auth', code:code, name:name, deviceId:deviceId(), requestId:Date.now() + '-' + Math.random().toString(16).slice(2) }, 30000)
      .then(function(d){
        ls(K.name, name);
        setSession(d);
        $('login').hidden = true;
        var w = loginWaiters; loginWaiters = [];
        w.forEach(function(fn){ fn(); });
      }, function(e){ $('loginErr').textContent = errMsg(e); })
      .then(function(){ $('loginBtn').disabled = false; });
  });
  $('logout').addEventListener('click', function(){
    if(!confirmLeave()) return;
    ss(K.token, null); ss(K.exp, null);
    location.reload();
  });

  // 작업 중이면 토큰을 미리 연장한다(만료 30분 전부터, 최근 15분 안에 손댄 경우만).
  ['input','click','keydown'].forEach(function(t){ document.addEventListener(t, function(){ S.lastActive = Date.now(); }, true); });
  setInterval(function(){
    if(!S.token || Date.now() - S.lastActive > 15*60*1000 || S.exp - Date.now() > 30*60*1000) return;
    call({ action:'ping', token:S.token }, 30000).then(function(d){ S.token = d.token; S.exp = d.expiresAt; ss(K.token, d.token); ss(K.exp, String(d.expiresAt)); }, function(){});
  }, 5*60*1000);

  /* ---------- 목록 ---------- */
  function load(){
    busy('목록을 불러오는 중…');
    return api('list', {}).then(function(d){ S.data = d; renderPub(); renderList(); }, function(e){ toast(errMsg(e), true); })
      .then(function(){ busy(null); });
  }

  function renderPub(){
    var p = S.data && S.data.lastPublish, box = $('pub');
    box.textContent = '';
    if(!p){ box.hidden = true; return; }
    box.hidden = false;
    box.className = 'ad-pub' + (p.ok ? '' : ' fail');
    var inner = h('div', { class:'ad-in' });
    if(p.ok){
      inner.appendChild(h('span', { text:'마지막 사이트 반영 ' + p.at.slice(0,16).replace('T',' ') + ' · 저장한 내용은 1~2분 뒤 사이트에 보입니다.' }));
    }else{
      inner.appendChild(h('span', { text:'⚠ 글은 저장됐지만 사이트 반영에 실패했습니다.' }));
      inner.appendChild(h('button', { type:'button', text:'다시 반영', onclick:republish }));
    }
    box.appendChild(inner);
  }

  function republish(){
    busy('사이트에 반영하는 중…');
    api('publish', {}).then(function(d){
      S.data.lastPublish = { ok:d.published, at:new Date(Date.now() + 9*3600e3).toISOString().slice(0,19) };
      renderPub();
      toast(d.published ? '사이트에 반영했습니다. 1~2분 뒤 보입니다.' : '반영에 또 실패했습니다. 잠시 뒤 다시 눌러 주세요.', !d.published);
    }, function(e){ toast(errMsg(e), true); }).then(function(){ busy(null); });
  }

  function renderList(){
    var d = S.data, view = $('view');
    view.textContent = '';
    var tabs = h('div', { class:'ad-tabs' }, [
      h('button', { type:'button', class:S.tab === 'notice' ? 'on' : null, onclick:function(){ S.tab = 'notice'; renderList(); } },
        ['공지사항', h('span', { class:'n', text:String(d.notices.length) })]),
      h('button', { type:'button', class:S.tab === 'gallery' ? 'on' : null, onclick:function(){ S.tab = 'gallery'; renderList(); } },
        ['갤러리', h('span', { class:'n', text:String(d.gallery.length) })])
    ]);
    view.appendChild(h('div', { class:'ad-head' }, [
      tabs,
      h('button', { type:'button', class:'ad-btn pri', text:S.tab === 'notice' ? '+ 새 공지' : '+ 새 앨범', onclick:function(){ openEditor(S.tab, null); } })
    ]));

    var items = S.tab === 'notice' ? d.notices : d.gallery;
    if(!items.length){ view.appendChild(h('p', { class:'ad-empty', text:'아직 글이 없습니다.' })); return; }

    if(S.tab === 'notice'){
      view.appendChild(h('div', { class:'ad-rows' }, items.map(function(n){
        var meta = [n.date];
        if(n.photos.length) meta.push('사진 ' + n.photos.length);
        if(n.files.length) meta.push('파일 ' + n.files.length);
        return h('button', { type:'button', class:'ad-row', onclick:function(){ openEditor('notice', n); } }, [
          h('span', { class:'badges' }, [visBadge(n.visibility), n.pinned ? h('span', { class:'badge pin', text:'상단 고정' }) : null]),
          h('span', { class:'t' }, [h('small', { text:n.category }), n.title]),
          h('span', { class:'m', text:meta.join(' · ') })
        ]);
      })));
    }else{
      view.appendChild(h('div', { class:'ad-cards' }, items.map(function(g){
        var th = h('span', { class:'th' }, [visBadge(g.visibility)]);
        if(g.photos.length) th.style.backgroundImage = 'url("' + Board.photoUrl(g.photos[0].fileId, 480) + '")';
        return h('button', { type:'button', class:'ad-card', onclick:function(){ openEditor('gallery', g); } }, [
          th,
          h('span', { class:'tx' }, [
            h('span', { class:'t', text:g.title, style:'display:block' }),
            h('span', { class:'m', text:[g.date, '사진 ' + g.photos.length + '장'].join(' · '), style:'display:block' })
          ])
        ]);
      })));
    }
  }
  function visBadge(v){ return h('span', { class:'badge ' + (v === '공개' ? 'on' : 'off'), text:v }); }

  /* ---------- 작성 화면 ---------- */
  function todayKst(){ return new Date(Date.now() + 9*3600e3).toISOString().slice(0,10); }

  function openEditor(board, post){
    var lim = S.data.limits;
    listY = window.scrollY;
    var copyAtt = function(a){ return Object.assign({}, a); };
    S.edit = {
      board:board, id:post ? post.id : null, dirty:false, preview:false,
      post: post ? Object.assign({}, post) : (board === 'notice'
        ? { category:S.data.categories[0], title:'', body:'', date:todayKst(), pinned:false, photoPosition:'top', photoLink:'', visibility:'공개' }
        : { title:'', desc:'', date:todayKst(), visibility:'공개' }),
      photos: post ? post.photos.map(copyAtt) : [],
      files: post && post.files ? post.files.map(copyAtt) : [],
      maxPhotos: board === 'notice' ? lim.noticePhotos : lim.galleryPhotos
    };
    renderEditor();
    history.pushState({ adEdit:1 }, '');
    window.scrollTo(0, 0);
  }

  function markDirty(){ if(S.edit) S.edit.dirty = true; }
  function pending(){ var e = S.edit; return e ? e.photos.concat(e.files).filter(function(a){ return a.uploading; }).length : 0; }
  function confirmLeave(){
    if(!S.edit || (!S.edit.dirty && !pending())) return true;
    return confirm('저장하지 않은 내용이 있습니다. 나가면 사라집니다. 나갈까요?');
  }
  window.addEventListener('beforeunload', function(ev){
    if(S.edit && (S.edit.dirty || pending())){ ev.preventDefault(); ev.returnValue = ''; }
  });

  /* 작성 화면을 열 때 브라우저 기록을 하나 남겨, 브라우저 뒤로 가기로도 목록에 돌아오게 한다 */
  var listY = 0;
  function dropEditState(){ if(history.state && history.state.adEdit) history.back(); }
  function closeEditor(){ S.edit = null; renderList(); window.scrollTo(0, listY); dropEditState(); }
  window.addEventListener('popstate', function(){
    if(!S.edit) return;                              // 버튼 · 저장으로 닫으면서 기록을 되돌린 경우
    if(confirmLeave()){ S.edit = null; renderList(); window.scrollTo(0, listY); }
    else history.pushState({ adEdit:1 }, '');        // 머무르기로 하면 기록을 다시 남긴다
  });

  function renderEditor(){
    var e = S.edit, p = e.post, lim = S.data.limits, isNotice = e.board === 'notice';
    var view = $('view');
    view.textContent = '';
    var wrap = h('section', { class:'ad-edit' });

    wrap.appendChild(h('div', { class:'ad-edit-top' }, [
      h('button', { type:'button', class:'ad-back', text:'← 목록으로', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
      p.author ? h('span', { class:'ad-meta', text:'작성 ' + p.author + ' · 마지막 수정 ' + p.updatedBy + ' ' + (p.updatedAt || '').slice(0,16).replace('T',' ') }) : null
    ]));
    wrap.appendChild(h('h2', { text:(e.id ? '' : '새 ') + (isNotice ? '공지' : '앨범') + (e.id ? ' 수정' : '') }));

    var bind = function(key){ return function(ev){ p[key] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; markDirty(); }; };

    // 분류 · 게시일 · 공개여부
    var row = h('div', { class:'fld-row', style:'margin-top:22px' });
    if(isNotice){
      row.appendChild(h('div', { class:'fld' }, [
        h('label', { for:'f-cat', text:'분류' }),
        h('select', { id:'f-cat', onchange:bind('category') }, S.data.categories.map(function(c){ return h('option', { value:c, text:c, selected:c === p.category }); }))
      ]));
    }
    row.appendChild(h('div', { class:'fld' }, [
      h('label', { for:'f-date', text:'게시일' }),
      h('input', { id:'f-date', type:'date', value:p.date, onchange:bind('date') })
    ]));
    row.appendChild(h('div', { class:'fld' }, [
      h('span', { class:'lb' }, ['공개 여부', h('span', { class:'hint', text:'비공개 글은 사이트에 보이지 않습니다' })]),
      h('div', { class:'choices' }, ['공개', '비공개'].map(function(v){
        return h('label', null, [h('input', { type:'radio', name:'vis', value:v, checked:p.visibility === v, onchange:bind('visibility') }), v]);
      }))
    ]));
    wrap.appendChild(row);

    // 제목
    wrap.appendChild(field('f-title', '제목', isNotice ? lim.noticeTitle : lim.galleryTitle, function(){
      return h('input', { id:'f-title', type:'text', value:p.title, maxlength:String(isNotice ? lim.noticeTitle : lim.galleryTitle), oninput:bind('title') });
    }));

    if(isNotice){
      wrap.appendChild(bodyField(p, lim));
      wrap.appendChild(photoField(e, '사진', '포스터 · 안내 이미지. 맨 앞 사진부터 차례로 보입니다.'));
      wrap.appendChild(h('div', { class:'fld-row two' }, [
        h('div', { class:'fld' }, [
          h('span', { class:'lb', text:'사진 위치' }),
          h('div', { class:'choices' }, [['top','글 위'], ['bottom','글 아래']].map(function(o){
            return h('label', null, [h('input', { type:'radio', name:'ppos', value:o[0], checked:p.photoPosition === o[0], onchange:bind('photoPosition') }), o[1]]);
          }))
        ]),
        h('div', { class:'fld' }, [
          h('label', { for:'f-link' }, ['사진을 누르면 이동할 주소', h('span', { class:'hint', text:'비우면 이동하지 않음' })]),
          h('input', { id:'f-link', type:'url', value:p.photoLink, placeholder:'https://', maxlength:String(lim.link), oninput:bind('photoLink') })
        ])
      ]));
      wrap.appendChild(fileField(e, lim));
      wrap.appendChild(h('div', { class:'fld' }, [
        h('label', { class:'choices', style:'font-weight:600' }, [h('input', { type:'checkbox', checked:p.pinned, onchange:bind('pinned') }), '목록 맨 위에 고정'])
      ]));
    }else{
      wrap.appendChild(field('f-desc', '설명', lim.galleryDesc, function(){
        return h('input', { id:'f-desc', type:'text', value:p.desc, placeholder:'예: 2026.07 · 광주캠퍼스', maxlength:String(lim.galleryDesc), oninput:bind('desc') });
      }, '촬영 시기 · 장소'));
      wrap.appendChild(photoField(e, '사진', '맨 앞 사진이 목록에 보이는 대표 사진입니다.'));
    }

    wrap.appendChild(h('div', { class:'ad-actions' }, [
      e.id ? h('button', { type:'button', class:'ad-btn warn', text:'삭제', onclick:removePost }) : null,
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'ad-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'ad-btn pri', text:'저장', onclick:save })
      ])
    ]));
    view.appendChild(wrap);
  }

  function field(id, label, max, make, hint){
    var input = make();
    var count = max ? h('p', { class:'count' }) : null;
    var upd = function(){ if(count){ count.textContent = input.value.length + ' / ' + max; count.className = 'count' + (input.value.length > max ? ' over' : ''); } };
    input.addEventListener('input', upd); upd();
    return h('div', { class:'fld' }, [h('label', { for:id }, [label, hint ? h('span', { class:'hint', text:hint }) : null]), input, count]);
  }

  // 본문: 서식 버튼(굵게 · 강조색 · 빨간색) + 미리보기 (docs/decisions.md 4절)
  function bodyField(p, lim){
    var ta = h('textarea', { id:'f-body', value:p.body, placeholder:'안내 내용을 입력하세요. 주소(https://…)는 자동으로 링크가 됩니다.' });
    var count = h('p', { class:'count' });
    var pv = h('div', { class:'preview', hidden:true });
    var pvBtn;
    var sync = function(){
      p.body = ta.value;
      count.textContent = ta.value.length + ' / ' + lim.noticeBody;
      count.className = 'count' + (ta.value.length > lim.noticeBody ? ' over' : '');
      if(!pv.hidden) drawPreview();
    };
    var drawPreview = function(){
      pv.textContent = '';
      pv.appendChild(Board.renderNotice(previewPost(), { localPhoto:function(ph){ return ph.local; } }));
    };
    var wrapSel = function(open, close){
      var s = ta.selectionStart, eIdx = ta.selectionEnd, sel = ta.value.slice(s, eIdx) || '글자';
      ta.value = ta.value.slice(0, s) + open + sel + close + ta.value.slice(eIdx);
      ta.focus(); ta.setSelectionRange(s + open.length, s + open.length + sel.length);
      markDirty(); sync();
    };
    ta.addEventListener('input', function(){ markDirty(); sync(); });
    pvBtn = h('button', { type:'button', class:'pv', text:'미리보기', onclick:function(){
      pv.hidden = !pv.hidden; pvBtn.className = 'pv' + (pv.hidden ? '' : ' on');
      if(!pv.hidden) drawPreview();
    } });
    sync();
    return h('div', { class:'fld' }, [
      h('label', { for:'f-body' }, ['본문', h('span', { class:'hint', text:'비워 두면 사진 · 첨부만 보입니다' })]),
      h('div', { class:'tools' }, [
        h('button', { type:'button', class:'b', text:'굵게', title:'고른 글자를 굵게', onclick:function(){ wrapSel('**', '**'); } }),
        h('button', { type:'button', class:'k', text:'강조색', title:'고른 글자를 청록색으로', onclick:function(){ wrapSel('{강조:', '}'); } }),
        h('button', { type:'button', class:'w', text:'빨간색', title:'고른 글자를 빨간색으로', onclick:function(){ wrapSel('{빨강:', '}'); } }),
        h('span', { class:'sp' }), pvBtn
      ]),
      ta, count,
      h('p', { class:'syntax' }, ['글자를 고르고 버튼을 누르면 기호가 붙습니다: ',
        h('code', { text:'**굵게**' }), ' ', h('code', { text:'{강조:청록}' }), ' ', h('code', { text:'{빨강:빨강}' }),
        ' — 실제 모양은 미리보기로 확인하세요.']),
      pv
    ]);
  }

  function previewPost(){
    var e = S.edit;
    var done = function(a){ return a.fileId || a.local; };
    return Object.assign({}, e.post, { photos:e.photos.filter(done), files:e.files.filter(function(a){ return a.fileId; }) });
  }

  /* ---------- 사진 ---------- */
  function photoField(e, label, hint){
    var box = h('div', { class:'fld', id:'photoFld' });
    drawPhotos(box, e, label, hint);
    return box;
  }
  function drawPhotos(box, e, label, hint){
    box = box || $('photoFld');
    if(!box) return;
    label = label || box.dataset.label; hint = hint || box.dataset.hint;
    box.dataset.label = label; box.dataset.hint = hint;
    box.textContent = '';
    var isGallery = e.board === 'gallery';
    box.appendChild(h('span', { class:'lb' }, [label + ' (' + e.photos.length + ' / ' + e.maxPhotos + ')', h('span', { class:'hint', text:hint })]));
    var grid = h('div', { class:'photos' });
    e.photos.forEach(function(ph, i){
      var im = h('div', { class:'im' });
      var src = ph.local || (ph.fileId && Board.photoUrl(ph.fileId, 400));
      if(src) im.style.backgroundImage = 'url("' + src + '")';
      var move = function(to){ var arr = e.photos; arr.splice(to, 0, arr.splice(i, 1)[0]); markDirty(); drawPhotos(null, e); };
      grid.appendChild(h('div', { class:'ph' }, [
        im,
        i === 0 && isGallery ? h('span', { class:'rep', text:'대표' }) : null,
        ph.uploading ? h('div', { class:'state', text:'올리는 중…' }) : null,
        ph.error ? h('div', { class:'state err', text:ph.error }) : null,
        h('div', { class:'ctl' }, [
          h('button', { type:'button', text:'◀', title:'앞으로', disabled:i === 0, onclick:function(){ move(i - 1); } }),
          h('button', { type:'button', text:'▶', title:'뒤로', disabled:i === e.photos.length - 1, onclick:function(){ move(i + 1); } }),
          h('button', { type:'button', text:isGallery ? '대표로' : '맨 앞', disabled:i === 0, onclick:function(){ move(0); } }),
          h('button', { type:'button', class:'x', text:'✕', title:'빼기', onclick:function(){ e.photos.splice(i, 1); markDirty(); drawPhotos(null, e); } })
        ])
      ]));
    });
    if(e.photos.length) box.appendChild(grid);
    var input = h('input', { type:'file', accept:'image/jpeg,image/png,image/webp', multiple:true, hidden:true, onchange:function(){
      addPhotos(e, [].slice.call(input.files)); input.value = '';
    } });
    box.appendChild(h('div', { class:'add' }, [
      h('button', { type:'button', class:'ad-btn sm', text:'+ 사진 추가', disabled:e.photos.length >= e.maxPhotos, onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:'JPG · PNG · WEBP. 올리기 전에 자동으로 줄입니다(긴 변 ' + PHOTO_MAX_SIDE + 'px).' }),
      input
    ]));
  }

  function addPhotos(e, list){
    var room = e.maxPhotos - e.photos.length;
    if(list.length > room){ toast('사진은 최대 ' + e.maxPhotos + '장입니다. ' + room + '장만 올립니다.', true); list = list.slice(0, room); }
    var jobs = list.map(function(file){
      var ph = { uploading:true, name:file.name };
      e.photos.push(ph);
      return function(){
        return shrinkPhoto(file).then(function(r){
          ph.local = r.preview; ph.w = r.w; ph.h = r.h; drawPhotos(null, e);
          return blobToBase64(r.blob).then(function(b64){
            return api('upload', { kind:'photo', name:file.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType:'image/jpeg', base64:b64, width:r.w, height:r.h }, 120000);
          });
        }).then(function(d){
          ph.attachmentId = d.attachmentId; ph.fileId = d.fileId; ph.size = d.size; ph.uploading = false; markDirty();
        }, function(err){
          ph.uploading = false; ph.error = err && err.code ? errMsg(err) : '이 사진은 열 수 없습니다. JPG로 바꿔 올려 주세요.';
        }).then(function(){ if(S.edit === e) drawPhotos(null, e); });
      };
    });
    drawPhotos(null, e);
    runQueue(jobs, UPLOAD_PARALLEL);
  }

  // 긴 변을 PHOTO_MAX_SIDE로 줄이고 JPEG로 바꾼다. 투명한 부분은 흰색으로 채운다.
  function shrinkPhoto(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale)), hgt = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = document.createElement('canvas'); c.width = w; c.height = hgt;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hgt); g.drawImage(img, 0, 0, w, hgt);
        c.toBlob(function(blob){ blob ? resolve({ blob:blob, w:w, h:hgt, preview:url }) : reject(new Error('toBlob')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function(){ reject(new Error('decode')); };
      img.src = url;
    });
  }

  function blobToBase64(blob){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onload = function(){ resolve(String(fr.result).split(',')[1]); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function runQueue(jobs, n){
    var i = 0;
    var next = function(){ if(i >= jobs.length) return Promise.resolve(); return jobs[i++]().then(next); };
    for(var k = 0; k < Math.min(n, jobs.length); k++) next();
  }

  /* ---------- 파일 ---------- */
  function fileField(e, lim){
    var box = h('div', { class:'fld', id:'fileFld' });
    drawFiles(box, e, lim);
    return box;
  }
  function drawFiles(box, e, lim){
    box = box || $('fileFld'); lim = lim || S.data.limits;
    if(!box) return;
    box.textContent = '';
    box.appendChild(h('span', { class:'lb' }, ['첨부파일 (' + e.files.length + ' / ' + lim.noticeFiles + ')', h('span', { class:'hint', text:'방문자가 내려받을 수 있습니다' })]));
    if(e.files.length){
      box.appendChild(h('div', { class:'files' }, e.files.map(function(f, i){
        var move = function(to){ e.files.splice(to, 0, e.files.splice(i, 1)[0]); markDirty(); drawFiles(null, e); };
        return h('div', { class:'fl' }, [
          h('span', { class:'nm', text:(i + 1) + '. ' + f.name }),
          f.uploading ? h('span', { class:'st', text:'올리는 중…' }) : f.error ? h('span', { class:'st err', text:f.error }) : h('span', { class:'sz', text:Board.formatSize(f.size || 0) }),
          h('span', { class:'ctl' }, [
            h('button', { type:'button', text:'▲', title:'위로', disabled:i === 0, onclick:function(){ move(i - 1); } }),
            h('button', { type:'button', text:'▼', title:'아래로', disabled:i === e.files.length - 1, onclick:function(){ move(i + 1); } }),
            h('button', { type:'button', text:'✕', title:'빼기', onclick:function(){ e.files.splice(i, 1); markDirty(); drawFiles(null, e); } })
          ])
        ]);
      })));
    }
    var accept = lim.fileExts.map(function(x){ return '.' + x; }).join(',');
    var input = h('input', { type:'file', accept:accept, multiple:true, hidden:true, onchange:function(){
      addFiles(e, [].slice.call(input.files)); input.value = '';
    } });
    box.appendChild(h('div', { class:'add' }, [
      h('button', { type:'button', class:'ad-btn sm', text:'+ 파일 추가', disabled:e.files.length >= lim.noticeFiles, onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:lim.fileExts.join(' · ') + ' · 한 개 ' + Board.formatSize(lim.fileBytes) + ' 이하' }),
      input
    ]));
  }

  function addFiles(e, list){
    var lim = S.data.limits, room = lim.noticeFiles - e.files.length;
    if(list.length > room){ toast('첨부파일은 최대 ' + lim.noticeFiles + '개입니다.', true); list = list.slice(0, room); }
    var jobs = [];
    list.forEach(function(file){
      var ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1];
      if(!ext || lim.fileExts.indexOf(ext.toLowerCase()) === -1){ toast(file.name + ': 올릴 수 없는 형식입니다.', true); return; }
      if(file.size > lim.fileBytes){ toast(file.name + ': ' + Board.formatSize(lim.fileBytes) + '보다 큽니다.', true); return; }
      var f = { uploading:true, name:file.name, size:file.size };
      e.files.push(f);
      jobs.push(function(){
        return blobToBase64(file).then(function(b64){
          return api('upload', { kind:'file', name:file.name, mimeType:file.type || '', base64:b64 }, 120000);
        }).then(function(d){
          f.attachmentId = d.attachmentId; f.fileId = d.fileId; f.size = d.size; f.uploading = false; markDirty();
        }, function(err){ f.uploading = false; f.error = errMsg(err); })
          .then(function(){ if(S.edit === e) drawFiles(null, e); });
      });
    });
    drawFiles(null, e);
    runQueue(jobs, UPLOAD_PARALLEL);
  }

  /* ---------- 저장 · 삭제 ---------- */
  function save(){
    var e = S.edit, p = e.post, lim = S.data.limits, isNotice = e.board === 'notice';
    var fail = function(msg){ toast(msg, true); };
    if(pending()) return fail('사진 · 파일을 올리는 중입니다. 끝난 뒤 저장해 주세요.');
    if(e.photos.concat(e.files).some(function(a){ return a.error; })) return fail('올리지 못한 사진 · 파일이 있습니다. ✕로 빼고 저장해 주세요.');
    if(!p.title.trim()) return fail('제목을 입력해 주세요.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return fail('게시일을 입력해 주세요.');
    if(isNotice){
      if(p.body.length > lim.noticeBody) return fail('본문이 너무 깁니다.');
      if(p.photoLink && !/^https?:\/\/\S+$/i.test(p.photoLink.trim())) return fail('사진 이동 주소는 https:// 로 시작해야 합니다.');
      if(!p.body.trim() && !e.photos.length && !e.files.length) return fail('본문 · 사진 · 첨부 중 하나는 있어야 합니다.');
    }else if(!e.photos.length && p.visibility === '공개' && !confirm('사진이 없는 앨범입니다. 사이트에 빈 칸으로 보입니다. 그래도 공개로 저장할까요?')) return;

    var post = isNotice
      ? { category:p.category, title:p.title, body:p.body, date:p.date, pinned:!!p.pinned, photoPosition:p.photoPosition, photoLink:(p.photoLink || '').trim(), visibility:p.visibility }
      : { title:p.title, desc:p.desc || '', date:p.date, visibility:p.visibility };
    busy('저장하고 사이트에 반영하는 중…\n10초 정도 걸립니다.');
    api('save', {
      board:e.board, id:e.id, post:post,
      photos:e.photos.map(function(a){ return a.attachmentId; }),
      files:isNotice ? e.files.map(function(a){ return a.attachmentId; }) : []
    }, 120000).then(function(d){
      e.dirty = false;
      S.edit = null; dropEditState();
      toast(d.published ? '저장했습니다. 1~2분 뒤 사이트에 보입니다.' : '저장했지만 사이트 반영에 실패했습니다. 위의 [다시 반영]을 눌러 주세요.', !d.published);
      return load();
    }, function(err){ busy(null); toast(errMsg(err), true); });
  }

  function removePost(){
    var e = S.edit;
    if(!confirm('이 글을 삭제할까요?\n첨부한 사진 · 파일도 함께 지워집니다(드라이브 휴지통에서 30일 안에 복구 가능).')) return;
    busy('삭제하고 사이트에 반영하는 중…');
    api('remove', { board:e.board, id:e.id }, 120000).then(function(d){
      e.dirty = false; S.edit = null; dropEditState();
      toast(d.published ? '삭제했습니다. 1~2분 뒤 사이트에서 사라집니다.' : '삭제했지만 사이트 반영에 실패했습니다. [다시 반영]을 눌러 주세요.', !d.published);
      return load();
    }, function(err){ busy(null); toast(errMsg(err), true); });
  }

  /* ---------- 시작 ---------- */
  S.token = ss(K.token); S.exp = Number(ss(K.exp)) || 0;
  if(S.token && Date.now() < S.exp){
    $('user').hidden = false;
    $('who').textContent = (ls(K.name) || '') + ' 님';
    S.name = ls(K.name) || '';
    load();
  }else{
    relogin().then(load);
  }
})();
