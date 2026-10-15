/* ============================================================
   2026 K예술영재 프로젝트 — admin.js
   게시글 관리 화면. 관문(Apps Script)만 부른다 — docs/api.md.
   ▣ 관문 주소는 공개된다고 가정한다. 권한 확인은 관문이 요청마다 한다 (CLAUDE.md 보안 1·2).
   ▣ 토큰은 sessionStorage(탭을 닫으면 로그아웃), 기기ID만 localStorage.
   ▣ 운영진이 입력한 값은 textContent로만 화면에 넣는다.
   ============================================================ */
(function(){
  var GATEWAY = 'https://script.google.com/macros/s/AKfycbzfrJrDmXwhRAb62MEVCiWFDLU2e-HzFy5R9RWTkw0uatO9BMlYgCi5dPlNfUgIxAEITQ/exec';
  var K = { token:'hp_admin_token', exp:'hp_admin_exp', device:'hp_admin_device' };
  try{ localStorage.removeItem('hp_admin_name'); }catch(e){}   // 예전에 저장하던 이름 (2026-10-14부터 쓰지 않음)
  var UPLOAD_PARALLEL = 3;     /* 사진을 동시에 올리는 수 (관문은 시트 기록만 잠근다) */
  var PHOTO_MAX_SIDE = 1600;   /* 올리기 전 긴 변 (docs/decisions.md 5절). 표지 사진은 관문이 주는 limits.heroPhotoSide(2400) */
  /* 게시판 — 탭 순서 = 사이트 소식 탭 순서(공지사항 · 언론홍보 · 갤러리) + 표지 사진 */
  var BOARDS = [
    { id:'notice',  tab:'공지사항',  name:'공지',        add:'+ 새 공지' },
    { id:'press',   tab:'언론홍보',  name:'언론홍보 글', add:'+ 새 기사' },
    { id:'gallery', tab:'갤러리',    name:'앨범',        add:'+ 새 앨범' },
    { id:'hero',    tab:'표지 사진', name:'표지 사진',   add:null }
  ];
  /* 표지 기본 사진 — main.css의 --img-hero-*와 맞출 것. 올린 사진이 없으면 사이트는 이 사진을, 이것도 없으면 그 칸을 건너뛴다 */
  var HERO_DEFAULT = { music:'assets/img/hero-music.jpg', trad:'assets/img/hero-trad.jpg' };

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
    var t = $('toast'); t.textContent = msg; t.className = 'mg-toast on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.className = 'mg-toast'; }, isErr ? 6000 : 3500);
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

  /* ---------- 로그인 ----------
     접근코드만 입력한다. 관문은 이름을 받아 작성자 · 수정자 · 로그에 남기므로 늘 「운영자」로 보낸다
     (2026-10-14 차장님 요청. 로그 탭에는 어떤 접근코드로 들어왔는지가 함께 남는다) */
  var OPERATOR = '운영자';
  var loginWaiters = [];
  function setSession(d){
    S.token = d.token; S.exp = d.expiresAt; S.name = d.name;
    ss(K.token, d.token); ss(K.exp, String(d.expiresAt));
    $('who').textContent = OPERATOR + ' 님';
    $('user').hidden = false;
  }
  function showLogin(message){
    $('loginSub').textContent = message || '운영진 접근코드를 입력해 주세요.';
    $('loginErr').textContent = '';
    $('code').value = '';
    $('login').hidden = false;
    $('code').focus();
  }
  function relogin(){
    return new Promise(function(resolve){
      loginWaiters.push(resolve);
      if($('login').hidden) showLogin(S.data ? '로그인 시간이 지났습니다. 다시 로그인하면 하던 작업을 이어서 합니다.' : null);
    });
  }
  $('loginForm').addEventListener('submit', function(ev){
    ev.preventDefault();
    var code = $('code').value.trim();
    if(!code){ $('loginErr').textContent = '접근코드를 입력해 주세요.'; return; }
    $('loginBtn').disabled = true; $('loginErr').textContent = '';
    call({ action:'auth', code:code, name:OPERATOR, deviceId:deviceId(), requestId:Date.now() + '-' + Math.random().toString(16).slice(2) }, 30000)
      .then(function(d){
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
    box.className = 'mg-pub' + (p.ok ? '' : ' fail');
    var inner = h('div', { class:'mg-in' });
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
    var items = itemsOf(S.tab), board = boardOf(S.tab);
    var tabs = h('div', { class:'mg-tabs' }, BOARDS.map(function(b){
      var n = b.id === 'hero' ? itemsOf('hero').filter(function(x){ return x.photos.length; }).length + ' / ' + itemsOf('hero').length : String(itemsOf(b.id).length);
      return h('button', { type:'button', class:S.tab === b.id ? 'on' : null, onclick:function(){ S.tab = b.id; renderList(); } },
        [b.tab, h('span', { class:'n', text:n })]);
    }));
    view.appendChild(h('div', { class:'mg-head' }, [
      tabs,
      board.add ? h('button', { type:'button', class:'mg-btn pri', text:board.add, onclick:function(){ openEditor(S.tab, null); } }) : null
    ]));

    if(S.tab === 'hero'){ view.appendChild(heroCards(items)); return; }
    if(!items.length){ view.appendChild(h('p', { class:'mg-empty', text:'아직 글이 없습니다.' })); return; }

    if(S.tab === 'press'){
      view.appendChild(h('div', { class:'mg-rows' }, items.map(function(p){
        return h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('press', p); } }, [
          h('span', { class:'badges' }, [visBadge(p.visibility)]),
          h('span', { class:'t' }, [h('small', { text:p.source }), p.title]),
          h('span', { class:'m', text:p.date })
        ]);
      })));
      return;
    }

    if(S.tab === 'notice'){
      view.appendChild(h('div', { class:'mg-rows' }, items.map(function(n){
        var meta = [n.date];
        if(n.photos.length) meta.push('사진 ' + n.photos.length);
        if(n.files.length) meta.push('파일 ' + n.files.length);
        return h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('notice', n); } }, [
          h('span', { class:'badges' }, [visBadge(n.visibility), n.pinned ? h('span', { class:'badge pin', text:'상단 고정' }) : null]),
          h('span', { class:'t' }, [h('small', { text:n.category }), n.title]),
          h('span', { class:'m', text:meta.join(' · ') })
        ]);
      })));
    }else{
      view.appendChild(h('div', { class:'mg-cards' }, items.map(function(g){
        var th = h('span', { class:'th' }, [visBadge(g.visibility)]);
        if(g.photos.length) th.style.backgroundImage = 'url("' + Board.photoUrl(g.photos[0].fileId, 480) + '")';
        return h('button', { type:'button', class:'mg-card', onclick:function(){ openEditor('gallery', g); } }, [
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
  function boardOf(id){ return BOARDS.filter(function(b){ return b.id === id; })[0]; }
  function itemsOf(id){ var d = S.data; return (id === 'notice' ? d.notices : id === 'press' ? d.press : id === 'gallery' ? d.gallery : d.hero) || []; }

  /* 표지 사진 — 분야 칸 4개(순서 고정). 올린 사진 > 기본 사진 > 건너뜀 */
  function heroState(slot){
    if(slot.photos.length) return { src:Board.photoUrl(slot.photos[0].fileId, 640), text:slot.depth && slot.cutouts.length ? '올린 사진 · 2.5D' : '올린 사진', cls:'on' };
    if(HERO_DEFAULT[slot.slot]) return { src:HERO_DEFAULT[slot.slot], text:'기본 사진', cls:'def' };
    return { src:null, text:'사진 없음 · 표지에서 건너뜀', cls:'off' };
  }
  function heroCards(items){
    var box = h('div', null, [
      h('p', { class:'mg-note', text:'표지는 이 순서로 한 장씩 넘어갑니다. 칸을 눌러 사진을 올리거나 바꾸세요. 사진을 빼면 기본 사진이 보이고, 기본 사진도 없는 칸은 건너뜁니다.' })
    ]);
    box.appendChild(h('div', { class:'mg-cards hero' }, items.map(function(s, i){
      var st = heroState(s);
      var th = h('span', { class:'th' }, [h('span', { class:'badge ' + st.cls, text:st.text })]);
      if(st.src) th.style.backgroundImage = 'url("' + st.src + '")';
      return h('button', { type:'button', class:'mg-card', onclick:function(){ openEditor('hero', s); } }, [
        th,
        h('span', { class:'tx' }, [
          h('span', { class:'t', text:(i + 1) + '. ' + s.label, style:'display:block' }),
          h('span', { class:'m', text:s.photos.length && s.updatedAt ? '바꾼 때 ' + s.updatedAt.slice(0,16).replace('T',' ') : ' ', style:'display:block' })
        ])
      ]);
    })));
    return box;
  }

  /* ---------- 작성 화면 ---------- */
  function todayKst(){ return new Date(Date.now() + 9*3600e3).toISOString().slice(0,10); }

  function openEditor(board, post){
    var lim = S.data.limits;
    listY = window.scrollY;
    var copyAtt = function(a){ return Object.assign({}, a); };
    var blank = {
      notice:  { category:S.data.categories[0], title:'', body:'', date:todayKst(), pinned:false, photoPosition:'top', photoLink:'', visibility:'공개' },
      press:   { source:'', title:'', date:todayKst(), url:'', visibility:'공개' },
      gallery: { title:'', desc:'', date:todayKst(), visibility:'공개' }
    };
    S.edit = {
      board:board, id:post ? post.id : null, dirty:false, preview:false,
      post: post ? Object.assign({}, post) : blank[board],
      photos: post && post.photos ? post.photos.map(copyAtt) : [],
      files: post && post.files ? post.files.map(copyAtt) : [],
      cutouts: post && post.cutouts ? post.cutouts.map(copyAtt) : [],
      maxPhotos: board === 'notice' ? lim.noticePhotos : board === 'hero' ? 1 : lim.galleryPhotos,
      photoSide: board === 'hero' ? (lim.heroPhotoSide || 2400) : PHOTO_MAX_SIDE
    };
    renderEditor();
    history.pushState({ adEdit:1 }, '');
    window.scrollTo(0, 0);
  }

  function markDirty(){ if(S.edit) S.edit.dirty = true; }
  function pending(){ var e = S.edit; return e ? e.photos.concat(e.files, e.cutouts).filter(function(a){ return a.uploading; }).length : 0; }
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
    var e = S.edit, p = e.post, lim = S.data.limits, isNotice = e.board === 'notice', isPress = e.board === 'press';
    var view = $('view');
    view.textContent = '';
    var wrap = h('section', { class:'mg-edit' });

    wrap.appendChild(h('div', { class:'mg-edit-top' }, [
      h('button', { type:'button', class:'mg-back', text:'← 목록으로', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
      p.author ? h('span', { class:'mg-meta', text:'작성 ' + p.author + ' · 마지막 수정 ' + p.updatedBy + ' ' + (p.updatedAt || '').slice(0,16).replace('T',' ') }) : null
    ]));

    if(e.board === 'hero'){ renderHeroEditor(wrap, e); view.appendChild(wrap); return; }

    wrap.appendChild(h('h2', { text:(e.id ? '' : '새 ') + boardOf(e.board).name + (e.id ? ' 수정' : '') }));

    var bind = function(key){ return function(ev){ p[key] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; markDirty(); }; };

    // 분류 · 게시일 · 공개여부
    var row = h('div', { class:'fld-row', style:'margin-top:22px' });
    if(isNotice){
      row.appendChild(h('div', { class:'fld' }, [
        h('label', { for:'f-cat', text:'분류' }),
        // 분류 목록에서 빠진 분류(예: 2026-10-14 삭제한 「아카이브」)의 글은 다시 고르게 한다. 그대로 두면 화면엔 첫 분류가 보이지만 예전 값이 전송된다
        h('select', { id:'f-cat', onchange:bind('category') }, (S.data.categories.indexOf(p.category) < 0
          ? [h('option', { value:'', text:'분류를 골라 주세요 (예전 분류 「' + p.category + '」는 더 이상 쓰지 않음)', selected:true, disabled:true })] : [])
          .concat(S.data.categories.map(function(c){ return h('option', { value:c, text:c, selected:c === p.category }); })))
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

    // 언론사 (언론홍보만) · 제목
    if(isPress){
      wrap.appendChild(field('f-source', '언론사', lim.pressSource, function(){
        return h('input', { id:'f-source', type:'text', value:p.source, placeholder:'예: 연합뉴스', maxlength:String(lim.pressSource), oninput:bind('source') });
      }, '목록에서 제목 앞에 보입니다'));
    }
    var titleMax = isNotice ? lim.noticeTitle : isPress ? lim.pressTitle : lim.galleryTitle;
    wrap.appendChild(field('f-title', isPress ? '기사 제목' : '제목', titleMax, function(){
      return h('input', { id:'f-title', type:'text', value:p.title, maxlength:String(titleMax), oninput:bind('title') });
    }));

    if(isPress){
      var urlInput = h('input', { id:'f-url', type:'url', value:p.url, placeholder:'https://', maxlength:String(lim.link), oninput:bind('url') });
      wrap.appendChild(h('div', { class:'fld' }, [
        h('label', { for:'f-url' }, ['기사 주소', h('span', { class:'hint', text:'사이트 목록에서 누르면 이 주소가 새 탭으로 열립니다' })]),
        urlInput,
        h('p', { class:'syntax' }, [h('button', { type:'button', class:'mg-btn sm', text:'주소 열어 확인 ↗', onclick:function(){
          var u = urlInput.value.trim();
          if(/^https?:\/\/\S+$/i.test(u)) window.open(u, '_blank', 'noopener'); else toast('기사 주소는 https:// 로 시작해야 합니다.', true);
        } })])
      ]));
    }else if(isNotice){
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

    wrap.appendChild(h('div', { class:'mg-actions' }, [
      e.id ? h('button', { type:'button', class:'mg-btn warn', text:'삭제', onclick:removePost }) : null,
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'mg-btn pri', text:'저장', onclick:save })
      ])
    ]));
    view.appendChild(wrap);
  }

  // 표지 사진 한 칸 — 사진 한 장만 둔다. 칸은 고정이라 삭제 버튼이 없다 (docs/decisions.md 2절)
  function renderHeroEditor(wrap, e){
    var p = e.post, def = HERO_DEFAULT[p.slot];
    wrap.appendChild(h('h2', { text:'표지 사진 — ' + p.label }));
    wrap.appendChild(h('p', { class:'mg-note', text:def
      ? '사진을 올리면 표지의 이 칸에 보입니다. 사진을 빼고 저장하면 아래 기본 사진으로 돌아갑니다.'
      : '사진을 올리면 표지의 이 칸에 보입니다. 이 칸은 기본 사진이 없어, 사진을 빼고 저장하면 표지에서 건너뜁니다.' }));
    wrap.appendChild(photoField(e, '사진', '가로로 긴 사진(16:9 정도)이 좋습니다. 화면 비율에 따라 위아래나 좌우가 잘리고, 왼쪽에 제목 글자가 올라갑니다.'));
    var depthBox = h('div', { class:'fld mg-depth', id:'depthFld' });
    wrap.appendChild(depthBox);
    drawDepth(e, depthBox);
    if(def) wrap.appendChild(h('div', { class:'fld' }, [
      h('span', { class:'lb', text:'기본 사진 (올린 사진이 없을 때 보임)' }),
      h('img', { class:'mg-hero-def', src:def, alt:'' })
    ]));
    wrap.appendChild(h('div', { class:'mg-actions' }, [
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'mg-btn pri', text:'저장', onclick:save })
      ])
    ]));
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
  /* 표지 2.5D 입체 효과 — 원본 위에 누끼(인물만 오려 낸 투명 배경 PNG)를 겹쳐, 넘어갈 때 인물이 배경보다 더 커지며 다가오게 한다.
     켜려면 누끼가 있어야 하고, 원본을 빼거나 바꾸면 누끼가 빠지고 꺼진다. 관문도 같은 규칙으로 다시 확인한다 (docs/decisions.md 2절) */
  function drawDepth(e, box){
    box = box || $('depthFld');
    if(!box) return;
    box.textContent = '';
    var p = e.post, ph = e.photos[0], cut = e.cutouts[0];
    var ready = !!(ph && ph.attachmentId && ph.w);
    box.appendChild(h('label', { class:'choices', style:'font-weight:700' }, [
      h('input', { type:'checkbox', checked:p.depth, disabled:!ready && !p.depth, onchange:function(ev){ p.depth = ev.target.checked; markDirty(); drawDepth(e); } }),
      '2.5D 입체 효과 켜기'
    ]));
    box.appendChild(h('p', { class:'hint', text:ready
      ? '인물만 오려 낸 누끼 사진을 원본 위에 겹쳐, 사진이 넘어갈 때 인물이 배경보다 앞으로 다가오게 합니다. 끄면 사진 전체가 천천히 확대 · 축소됩니다.'
      : '원본 사진을 먼저 올리면 켤 수 있습니다. 끄면 사진 전체가 천천히 확대 · 축소됩니다.' }));
    if(!p.depth) return;

    box.appendChild(h('span', { class:'lb' }, ['누끼 사진', h('span', { class:'hint', text:'원본 사진에서 배경을 지운 투명 배경 PNG 1장. 앞으로 다가올 주인공만 남기고(여러 명이 떨어져 있으면 인물 뒤에 겹친 윤곽이 보임), 원본과 같은 비율이어야 합니다.' })]));
    if(cut){
      var im = h('div', { class:'im' });
      var src = cut.local || (cut.fileId && Board.photoUrl(cut.fileId, 400));
      if(src) im.style.backgroundImage = 'url("' + src + '"),repeating-conic-gradient(#D9DBD8 0 25%,#fff 0 50%)';
      box.appendChild(h('div', { class:'photos' }, [h('div', { class:'ph cut' }, [
        im,
        cut.uploading ? h('div', { class:'state', text:'올리는 중…' }) : null,
        cut.error ? h('div', { class:'state err', text:cut.error }) : null,
        h('div', { class:'ctl' }, [h('button', { type:'button', class:'x', text:'✕', title:'빼기', onclick:function(){ e.cutouts = []; markDirty(); drawDepth(e); } })])
      ])]));
      var bgSrc = ph && (ph.local || (ph.fileId && Board.photoUrl(ph.fileId, 1600)));
      var fgSrc = cut.local || (cut.fileId && Board.photoUrl(cut.fileId, 1600));
      if(bgSrc && fgSrc && !cut.error){
        var pv = h('div', { class:'mg-depth-pv' }, [h('img', { class:'bg', src:bgSrc, alt:'' }), h('img', { class:'fg', src:fgSrc, alt:'' })]);
        pv.style.aspectRatio = ph.w + ' / ' + ph.h;
        var org = (p.center ? p.center.x : 50) + '% ' + (p.center ? p.center.y : 50) + '%';
        [].forEach.call(pv.children, function(img){ img.style.transformOrigin = org; });
        box.appendChild(h('span', { class:'lb', style:'margin-top:18px' }, ['미리보기', h('span', { class:'hint', text:'인물 윤곽이 원본과 어긋나 보이면 누끼를 다시 만들어 주세요. 표지에서는 사진이 넘어갈 때마다 한 번 다가옵니다.' })]));
        box.appendChild(pv);
      }
    }else{
      var input = h('input', { type:'file', accept:'image/png,image/webp', hidden:true, onchange:function(){
        if(input.files[0]) addCutout(e, input.files[0]); input.value = '';
      } });
      box.appendChild(h('div', { class:'add' }, [
        h('button', { type:'button', class:'mg-btn sm', text:'+ 누끼 사진 올리기', onclick:function(){ input.click(); } }),
        h('span', { class:'hint', text:'PNG · WEBP. 원본 크기에 맞춰 올립니다.' }),
        input
      ]));
    }
  }

  // 원본을 빼거나 새로 올리면 누끼를 빼고 2.5D를 끈다 — 새 사진 위에 예전 인물이 겹치지 않게 (2026-10-15 사용자 결정)
  function photoChanged(e){
    if(e.board !== 'hero') return;
    if(e.cutouts.length) toast('원본 사진이 바뀌어 누끼 사진을 뺐습니다. 2.5D를 쓰려면 새 원본의 누끼를 올려 주세요.');
    e.cutouts = []; e.post.depth = false;
    drawDepth(e);
  }

  function addCutout(e, file){
    var ph = e.photos[0], cut = { uploading:true, name:file.name };
    e.cutouts = [cut];
    drawDepth(e);
    prepCutout(file, ph.w, ph.h).then(function(r){
      cut.local = r.preview; cut.w = ph.w; cut.h = ph.h; e.post.center = r.center;
      if(S.edit === e) drawDepth(e);
      if(r.blob.size > (S.data.limits.cutoutBytes || 8388608)) throw { userMsg:'누끼 사진이 너무 큽니다(' + Math.round(r.blob.size / 1048576) + 'MB). 원본을 더 작은 사진으로 바꿔 주세요.' };
      return blobToBase64(r.blob).then(function(b64){
        return api('upload', { kind:'cutout', name:file.name.replace(/\.[^.]+$/, '') + '.png', mimeType:'image/png', base64:b64, width:ph.w, height:ph.h }, 120000);
      });
    }).then(function(d){
      cut.attachmentId = d.attachmentId; cut.fileId = d.fileId; cut.size = d.size; cut.uploading = false; markDirty();
    }, function(err){
      cut.uploading = false;
      cut.error = err && err.code ? errMsg(err) : (err && err.userMsg) || '이 사진은 열 수 없습니다. PNG로 바꿔 올려 주세요.';
    }).then(function(){ if(S.edit === e) drawDepth(e); });
  }

  // 누끼를 원본 크기(w×h)로 맞추고 확인한다 — 비율이 원본과 같아야(1% 안) 하고 투명한 곳이 있어야 한다.
  // 투명한 곳의 색 값은 0으로 비워 PNG 용량을 줄이고, 인물 영역(반 넘게 불투명한 곳)을 감싸는 상자의 가운데를 확대 중심(%)으로 돌려준다.
  function prepCutout(file, w, hgt){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        URL.revokeObjectURL(url);
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if(Math.abs(iw / ih - w / hgt) > w / hgt * 0.01){
          return reject({ userMsg:'원본과 비율이 다릅니다(원본 ' + w + '×' + hgt + ', 누끼 ' + iw + '×' + ih + '). 원본과 같은 사진에서 배경만 지워 주세요.' });
        }
        var c = document.createElement('canvas'); c.width = w; c.height = hgt;
        var g = c.getContext('2d'); g.drawImage(img, 0, 0, w, hgt);
        var data = g.getImageData(0, 0, w, hgt), d = data.data, n = w * hgt, clear = 0;
        var x0 = w, x1 = -1, y0 = hgt, y1 = -1;
        for(var i = 0; i < n; i++){
          var a = d[i * 4 + 3];
          if(a === 0){ d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; clear++; }
          else if(a > 128){
            var x = i % w, y = (i - x) / w;
            if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
          }
        }
        if(clear < n * 0.02) return reject({ userMsg:'배경이 지워지지 않은 사진입니다. 배경을 투명하게 지운 PNG를 올려 주세요.' });
        if(x1 < 0) return reject({ userMsg:'인물이 보이지 않습니다(사진 전체가 투명). 누끼를 다시 만들어 주세요.' });
        g.putImageData(data, 0, 0);
        var center = { x:Math.round((x0 + x1 + 1) / 2 / w * 1000) / 10, y:Math.round((y0 + y1 + 1) / 2 / hgt * 1000) / 10 };
        c.toBlob(function(blob){ blob ? resolve({ blob:blob, preview:URL.createObjectURL(blob), center:center }) : reject(new Error('toBlob')); }, 'image/png');
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

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
          e.maxPhotos > 1 ? h('button', { type:'button', text:'◀', title:'앞으로', disabled:i === 0, onclick:function(){ move(i - 1); } }) : null,
          e.maxPhotos > 1 ? h('button', { type:'button', text:'▶', title:'뒤로', disabled:i === e.photos.length - 1, onclick:function(){ move(i + 1); } }) : null,
          e.maxPhotos > 1 ? h('button', { type:'button', text:isGallery ? '대표로' : '맨 앞', disabled:i === 0, onclick:function(){ move(0); } }) : null,
          h('button', { type:'button', class:'x', text:'✕', title:'빼기', onclick:function(){ e.photos.splice(i, 1); markDirty(); drawPhotos(null, e); photoChanged(e); } })
        ])
      ]));
    });
    if(e.photos.length) box.appendChild(grid);
    var input = h('input', { type:'file', accept:'image/jpeg,image/png,image/webp', multiple:true, hidden:true, onchange:function(){
      addPhotos(e, [].slice.call(input.files)); input.value = '';
    } });
    box.appendChild(h('div', { class:'add' }, [
      h('button', { type:'button', class:'mg-btn sm', text:'+ 사진 추가', disabled:e.photos.length >= e.maxPhotos, onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:'JPG · PNG · WEBP. 올리기 전에 자동으로 줄입니다(긴 변 ' + e.photoSide + 'px).' }),
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
        return shrinkPhoto(file, e.photoSide).then(function(r){
          ph.local = r.preview; ph.w = r.w; ph.h = r.h; drawPhotos(null, e);
          return blobToBase64(r.blob).then(function(b64){
            return api('upload', { kind:'photo', name:file.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType:'image/jpeg', base64:b64, width:r.w, height:r.h }, 120000);
          });
        }).then(function(d){
          ph.attachmentId = d.attachmentId; ph.fileId = d.fileId; ph.size = d.size; ph.uploading = false; markDirty();
        }, function(err){
          ph.uploading = false; ph.error = err && err.code ? errMsg(err) : '이 사진은 열 수 없습니다. JPG로 바꿔 올려 주세요.';
        }).then(function(){ if(S.edit === e){ drawPhotos(null, e); drawDepth(e); } });
      };
    });
    drawPhotos(null, e);
    if(jobs.length) photoChanged(e);
    runQueue(jobs, UPLOAD_PARALLEL);
  }

  // 긴 변을 maxSide로 줄이고 JPEG로 바꾼다. 투명한 부분은 흰색으로 채운다.
  function shrinkPhoto(file, maxSide){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
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
      h('button', { type:'button', class:'mg-btn sm', text:'+ 파일 추가', disabled:e.files.length >= lim.noticeFiles, onclick:function(){ input.click(); } }),
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
    if(e.photos.concat(e.files, e.cutouts).some(function(a){ return a.error; })) return fail('올리지 못한 사진 · 파일이 있습니다. ✕로 빼고 저장해 주세요.');
    if(e.board === 'hero'){
      if(p.depth && !e.cutouts.length) return fail('2.5D 입체 효과를 켜려면 누끼 사진을 올려 주세요. 쓰지 않으려면 체크를 꺼 주세요.');
      if(!e.photos.length && !HERO_DEFAULT[p.slot] && !confirm('사진이 없으면 「' + p.label + '」 칸은 표지에서 빠집니다. 이대로 저장할까요?')) return;
      return send({
        board:'hero', id:e.id, post:{ depth:!!p.depth, center:e.cutouts.length ? p.center : null },
        photos:e.photos.map(function(a){ return a.attachmentId; }), cutouts:e.cutouts.map(function(a){ return a.attachmentId; }), files:[]
      });
    }
    if(e.board === 'press' && !(p.source || '').trim()) return fail('언론사를 입력해 주세요.');
    if(!p.title.trim()) return fail('제목을 입력해 주세요.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return fail('게시일을 입력해 주세요.');
    if(e.board === 'press'){
      if(!/^https?:\/\/\S+$/i.test((p.url || '').trim())) return fail('기사 주소를 https:// 로 시작하는 주소로 입력해 주세요.');
      return send({ board:'press', id:e.id, post:{ source:p.source, title:p.title, date:p.date, url:p.url.trim(), visibility:p.visibility }, photos:[], files:[] });
    }
    if(isNotice){
      if(S.data.categories.indexOf(p.category) < 0) return fail('분류를 골라 주세요. 「' + p.category + '」는 더 이상 쓰지 않는 분류입니다.');
      if(p.body.length > lim.noticeBody) return fail('본문이 너무 깁니다.');
      if(p.photoLink && !/^https?:\/\/\S+$/i.test(p.photoLink.trim())) return fail('사진 이동 주소는 https:// 로 시작해야 합니다.');
      // 내용 없는 공지는 사이트 목록에 보이되 누를 수 없다(docs/decisions.md 4절). 공개 글이면 한 번 묻고 저장한다
      if(!p.body.trim() && !e.photos.length && !e.files.length && p.visibility === '공개' &&
         !confirm('본문 · 사진 · 첨부가 없어 사이트 목록에서 누를 수 없는 글이 됩니다. 이대로 저장할까요?')) return;
    }else if(!e.photos.length && p.visibility === '공개' && !confirm('사진이 없는 앨범입니다. 사이트에 빈 칸으로 보입니다. 그래도 공개로 저장할까요?')) return;

    var post = isNotice
      ? { category:p.category, title:p.title, body:p.body, date:p.date, pinned:!!p.pinned, photoPosition:p.photoPosition, photoLink:(p.photoLink || '').trim(), visibility:p.visibility }
      : { title:p.title, desc:p.desc || '', date:p.date, visibility:p.visibility };
    send({
      board:e.board, id:e.id, post:post,
      photos:e.photos.map(function(a){ return a.attachmentId; }),
      files:isNotice ? e.files.map(function(a){ return a.attachmentId; }) : []
    });
  }

  function send(req){
    var e = S.edit;
    busy('저장하고 사이트에 반영하는 중…\n10초 정도 걸립니다.');
    api('save', req, 120000).then(function(d){
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
    $('who').textContent = OPERATOR + ' 님';
    S.name = OPERATOR;
    load();
  }else{
    relogin().then(load);
  }
})();
