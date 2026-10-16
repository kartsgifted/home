/* ============================================================
   2026 K예술영재 프로젝트 — program-photos.js
   프로그램 페이지(워크숍 4분야 · 심화 멘토링 · 겨울캠프)의 「갤러리」 사진 줄.
   data/posts.json의 gallery[]에서 field가 칸의 data-field와 같은 공개 앨범의 사진을 모아
   메인 WORKSHOP 칸처럼 가로로 나열한다. 사진이 없거나 목록을 읽지 못하면 칸을 숨긴 채로 둔다.
   ▣ 운영진이 입력한 값(앨범 제목 · 설명)은 textContent로만 넣는다 (CLAUDE.md 보안 5).
   ============================================================ */
(function(){
  var boxes = [].slice.call(document.querySelectorAll('.pg-photos[data-field]'));
  if(!boxes.length || !window.Board) return;

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  // 최근 앨범부터(갤러리 순서 그대로), 앨범 안에서는 올린 순서. 개수 제한 없음
  function collect(gallery, field){
    var items = [];
    gallery.forEach(function(g){
      if(g.field !== field) return;
      g.photos.forEach(function(p){ if(p && p.fileId) items.push({ photo:p, album:g }); });
    });
    return items;
  }

  function fill(box, items){
    var rail = box.querySelector('.pg-rail'),
        arrows = box.querySelector('.pg-arrows'),
        photos = items.map(function(it){ return it.photo; }),
        caps = items.map(function(it){ return it.album.title || ''; });   // 확대 보기에서 넘길 때마다 그 사진의 앨범 제목

    items.forEach(function(it, i){
      var fig = el('figure', 'pg-item'), th = el('button', 'th'), img = el('img');
      th.type = 'button';
      th.setAttribute('aria-label', (it.album.title || '사진') + ' — 크게 보기');
      img.src = Board.photoUrl(it.photo.fileId, 640); img.alt = ''; img.loading = 'lazy';
      th.appendChild(img);
      th.addEventListener('click', function(){ Board.viewer(photos, i, caps); });
      fig.appendChild(th);
      fig.appendChild(el('figcaption', null, it.album.title || ''));
      if(it.album.desc) fig.appendChild(el('p', 'm', it.album.desc));
      rail.appendChild(fig);
    });

    // 사진이 모두 보이면 화살표를 숨긴다. 탭을 바꿔 칸이 보이게 될 때 · 창 크기가 바뀔 때 다시 잰다
    function sync(){ arrows.style.visibility = rail.scrollWidth - rail.clientWidth > 4 ? 'visible' : 'hidden'; }
    if(window.ResizeObserver) new ResizeObserver(sync).observe(rail);
    else window.addEventListener('resize', sync);
    arrows.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){
        var step = rail.querySelector('.pg-item').offsetWidth + 20;
        rail.scrollBy({ left:b.dataset.dir === 'next' ? step : -step, behavior:'smooth' });
      });
    });
    box.hidden = false;
    sync();
  }

  Board.load().then(function(d){
    if(!d) return;
    boxes.forEach(function(box){
      var items = collect(d.gallery, box.dataset.field);
      if(items.length) fill(box, items);
    });
  });
})();
