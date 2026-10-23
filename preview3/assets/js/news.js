/* ============================================================
   2026 K예술영재 프로젝트 — news.js
   소식 페이지: 공지 목록 · 상세(#notice/글ID) · 언론홍보 · 갤러리를 data/posts.json으로 채운다.
   ▣ 글 모양은 board.js(관리자 미리보기와 같은 함수)가 만든다. 운영진이 입력한 값은 textContent로만 넣는다.
   ============================================================ */
(function(){
  var NOTICE_PER = 10, PRESS_PER = 10, GALLERY_PER = 8;   // 한 쪽에 보일 개수 (docs/decisions.md 4절)
  var nBox = document.querySelector('[data-board="notice"]'),
      pBox = document.querySelector('[data-board="press"]'),
      gBox = document.querySelector('[data-board="gallery"]');
  if(!nBox || !pBox || !gBox || !window.Board) return;

  var data = null, nPage = 1, pPage = 1, gPage = 1, view = '', baseTitle = document.title,
      fromList = false, listY = null;   // 목록에서 글을 열었으면 「목록」이 뒤로 가기로 돌아가 보던 자리를 찾는다

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  function msg(box, text){ box.textContent = ''; box.appendChild(el('p', 'bd-msg', text)); }

  // 탭 바로 아래로 올린다 (이미 그보다 위면 그대로)
  function toTop(){
    var crumb = document.getElementById('crumb'), hd = document.getElementById('header');
    var y = crumb.getBoundingClientRect().bottom + window.scrollY - hd.offsetHeight;
    if(window.scrollY > y) window.scrollTo({ top:y, behavior:'instant' });
  }

  // 쪽 번호 — 열 쪽씩 묶어 보이고 ‹ › 는 앞뒤 쪽. 한 쪽뿐이면 그리지 않는다.
  function paging(pages, page, go){
    if(pages < 2) return null;
    var box = el('nav', 'paging'), from = Math.floor((page - 1) / 10) * 10 + 1, to = Math.min(from + 9, pages);
    box.setAttribute('aria-label', '쪽 번호');
    function add(text, p, label){
      var b = el('button', p === page && text === String(p) ? 'on' : null, text);
      b.type = 'button';
      b.setAttribute('aria-label', label || p + '쪽');
      if(b.className === 'on') b.setAttribute('aria-current', 'page');
      else b.addEventListener('click', function(){ go(p); });
      box.appendChild(b);
    }
    if(page > 1) add('‹', page - 1, '이전 쪽');
    for(var p = from; p <= to; p++) add(String(p), p);
    if(page < pages) add('›', page + 1, '다음 쪽');
    return box;
  }

  /* ---------- 공지 ---------- */
  function noticeList(){
    var list = data.notices;
    view = 'list'; fromList = false;
    document.title = baseTitle;
    if(!list.length) return msg(nBox, Board.MSG.empty);
    var pages = Math.ceil(list.length / NOTICE_PER);
    nPage = Math.min(Math.max(1, nPage), pages);
    nBox.textContent = '';
    var ul = el('ul', 'bbs');
    list.slice((nPage - 1) * NOTICE_PER, nPage * NOTICE_PER).forEach(function(n){
      ul.appendChild(Board.noticeItem(n, '#notice/' + encodeURIComponent(n.id), true));
    });
    nBox.appendChild(ul);
    var pg = paging(pages, nPage, function(p){ nPage = p; noticeList(); toTop(); });
    if(pg) nBox.appendChild(pg);
    if(listY !== null){ window.scrollTo({ top:listY, behavior:'instant' }); listY = null; }
  }

  function noticeDetail(id){
    var post = data.notices.filter(function(n){ return n.id === id; })[0];
    view = 'detail';
    nBox.textContent = '';
    if(post){
      nBox.appendChild(Board.renderNotice(post, { onPhoto:function(i){ Board.viewer(post.photos, i, post.title); } }));
      document.title = post.title + ' | ' + baseTitle;
    }else{
      nBox.appendChild(el('p', 'bd-msg', '글을 찾을 수 없습니다. 삭제되었거나 비공개로 바뀐 글입니다.'));
      document.title = baseTitle;
    }
    var foot = el('div', 'post-foot'), back = el('button', 'btn ghost', '목록');
    back.type = 'button';
    back.addEventListener('click', function(){
      if(fromList) history.back();
      else location.hash = '#notice';
    });
    foot.appendChild(back);
    nBox.appendChild(foot);
    toTop();
  }

  function hashId(){
    var m = location.hash.match(/^#notice\/(.+)$/);
    if(!m) return null;
    try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; }
  }
  // 주소가 바뀔 때: #notice/글ID → 상세, #notice(또는 해시 없음) → 목록. 다른 탭 해시는 공지 칸을 그대로 둔다.
  function route(){
    var id = hashId();
    if(id !== null) return noticeDetail(id);
    if(view === 'detail' && /^#?(notice)?$/.test(location.hash)){
      if(!fromList) listY = null;
      noticeList();
    }
  }

  nBox.addEventListener('click', function(e){
    if(view === 'list' && e.target.closest('a[href^="#notice/"]')){ fromList = true; listY = window.scrollY; }
  });
  // 상세를 보다가 「공지사항」 탭을 다시 누르면 목록으로 (탭 코드는 주소만 바꾸고 hashchange를 내지 않음)
  var tab = document.querySelector('#tabs [data-tab="notice"]');
  if(tab) tab.addEventListener('click', function(){ if(data && view === 'detail'){ listY = null; noticeList(); } });

  /* ---------- 언론홍보 ---------- 누르면 기사 주소가 새 탭으로 열린다 (사이트 안 상세 화면 없음) */
  function press(){
    var list = data.press;
    if(!list.length) return msg(pBox, Board.MSG.empty);
    var pages = Math.ceil(list.length / PRESS_PER);
    pPage = Math.min(Math.max(1, pPage), pages);
    pBox.textContent = '';
    var ul = el('ul', 'bbs');
    list.slice((pPage - 1) * PRESS_PER, pPage * PRESS_PER).forEach(function(p){ ul.appendChild(Board.pressItem(p)); });
    pBox.appendChild(ul);
    var pg = paging(pages, pPage, function(p){ pPage = p; press(); toTop(); });
    if(pg) pBox.appendChild(pg);
  }

  /* ---------- 갤러리 ---------- */
  function gallery(){
    var list = data.gallery;
    if(!list.length) return msg(gBox, Board.MSG.empty);
    var pages = Math.ceil(list.length / GALLERY_PER);
    gPage = Math.min(Math.max(1, gPage), pages);
    gBox.textContent = '';
    var grid = el('div', 'gal');
    list.slice((gPage - 1) * GALLERY_PER, gPage * GALLERY_PER).forEach(function(g, k){
      var fig = el('figure'), th;
      fig.setAttribute('data-rv', ''); fig.setAttribute('data-d', String(k % 4));
      if(g.photos.length){   // 첫 사진이 대표. 누르면 앨범 전체를 확대 보기로
        th = el('button', 'th'); th.type = 'button';
        th.setAttribute('aria-label', (g.title || '') + ' — 사진 ' + g.photos.length + '장 보기');
        var img = el('img'); img.src = Board.photoUrl(g.photos[0].fileId, 640); img.alt = ''; img.loading = 'lazy';
        th.appendChild(img);
        th.addEventListener('click', function(){ Board.viewer(g.photos, 0, g.title); });
      }else{   // 사진이 없으면 기본 그라디언트 칸. 마우스 반응은 같고 눌러도 아무 일도 없다
        th = el('div', 'th'); th.appendChild(el('i', 'ph')); fig.className = 'empty';
      }
      fig.appendChild(th);
      fig.appendChild(el('figcaption', null, g.title || ''));
      if(g.desc) fig.appendChild(el('p', 'm', g.desc));
      grid.appendChild(fig);
    });
    gBox.appendChild(grid);
    var pg = paging(pages, gPage, function(p){ gPage = p; gallery(); toTop(); });
    if(pg) gBox.appendChild(pg);
    if(window.__rvObserve) window.__rvObserve(gBox);
  }

  /* ---------- 시작 ---------- */
  Board.load().then(function(d){
    if(!d){ msg(nBox, Board.MSG.fail); msg(pBox, Board.MSG.fail); msg(gBox, Board.MSG.fail); return; }
    data = d;
    var id = hashId();
    if(id !== null) noticeDetail(id); else noticeList();
    press();
    gallery();
    window.addEventListener('hashchange', route);
  });
})();
