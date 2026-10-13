/* ============================================================
   2026 K예술영재 프로젝트 — board.js
   게시글(공지 · 갤러리) 표시 공통 모듈. 관리자 미리보기와 방문자 화면이 같이 쓴다.
   ▣ 운영진이 입력한 값은 모두 textContent로 넣는다 (innerHTML 금지 — CLAUDE.md 보안 5).
   ▣ 본문 서식 (docs/decisions.md 4절)
       **굵게**   {강조:청록 글자}   {빨강:빨간 글자}   주소(https://…)는 자동 링크
   ============================================================ */
window.Board = (function(){

  /* ---------- 드라이브 주소 (docs/decisions.md 5절) ----------
     구글이 공식 보장하는 주소가 아니라서 이 두 함수에만 둔다. 막히면 여기만 바꾼다. */
  function photoUrl(fileId, width){
    return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w' + (width || 1600);
  }
  function fileUrl(fileId){
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
  }

  function formatSize(bytes){
    if(bytes >= 1024*1024) return (bytes/1024/1024).toFixed(1) + 'M';
    return Math.max(1, Math.round(bytes/1024)) + 'K';
  }

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  /* ---------- 본문 ---------- */
  var URL_RE = /https?:\/\/[^\s<>"'{}]+/g;
  var SPANS = { '{강조:':'em-key', '{빨강:':'em-warn' };

  // 글자 조각을 넣되, 그 안의 주소는 링크로 만든다. 끝에 붙은 문장부호는 링크에서 뺀다.
  function appendText(parent, text){
    var last = 0, m;
    URL_RE.lastIndex = 0;
    while((m = URL_RE.exec(text))){
      var url = m[0].replace(/[.,;:!?)\]]+$/, '');
      if(m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, url);
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      parent.appendChild(a);
      last = m.index + url.length;
      URL_RE.lastIndex = last;
    }
    if(last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  // 한 줄 안의 서식을 읽어 parent에 붙인다. 짝이 맞지 않는 기호는 글자 그대로 둔다.
  function appendInline(parent, s){
    var buf = '', i = 0;
    function flush(){ if(buf){ appendText(parent, buf); buf = ''; } }
    while(i < s.length){
      if(s.substr(i, 2) === '**'){
        var end = s.indexOf('**', i + 2);
        if(end > i + 2){
          flush();
          var b = el('strong');
          appendInline(b, s.slice(i + 2, end));
          parent.appendChild(b);
          i = end + 2; continue;
        }
      }
      var open = s.substr(i, 4);
      if(SPANS[open]){
        var close = s.indexOf('}', i + 4);
        if(close > i + 4){
          flush();
          var span = el('span', SPANS[open]);
          appendInline(span, s.slice(i + 4, close));
          parent.appendChild(span);
          i = close + 1; continue;
        }
      }
      buf += s[i++];
    }
    flush();
  }

  function renderBody(text){
    var box = el('div', 'post-body');
    String(text || '').split('\n').forEach(function(line, n){
      if(n) box.appendChild(document.createElement('br'));
      appendInline(box, line);
    });
    return box;
  }

  /* ---------- 공지 상세 ---------- */
  // 사진 → 글 → 첨부 (photoPosition이 bottom이면 글 → 사진 → 첨부). 비어 있는 칸은 그리지 않는다.
  // opts.localPhoto(photo): 관리자 화면이 아직 드라이브에 없는 사진의 미리보기 주소를 줄 때 쓴다.
  function renderNotice(post, opts){
    opts = opts || {};
    var art = el('article', 'post');
    var head = el('header', 'post-head');
    if(post.category) head.appendChild(el('p', 'post-cat', post.category));
    head.appendChild(el('h3', 'post-title', post.title || ''));
    if(post.date) head.appendChild(el('p', 'post-date', post.date));
    art.appendChild(head);

    var photos = null;
    if(post.photos && post.photos.length){
      photos = el('div', 'post-photos');
      post.photos.forEach(function(p){
        var img = el('img');
        img.src = (opts.localPhoto && opts.localPhoto(p)) || photoUrl(p.fileId, 1600);
        img.alt = post.title || '';
        img.loading = 'lazy';
        if(p.w && p.h){ img.width = p.w; img.height = p.h; }
        if(post.photoLink){
          var a = el('a'); a.href = post.photoLink; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.appendChild(img); photos.appendChild(a);
        }else photos.appendChild(img);
      });
    }
    var body = post.body ? renderBody(post.body) : null;
    if(post.photoPosition === 'bottom'){ if(body) art.appendChild(body); if(photos) art.appendChild(photos); }
    else{ if(photos) art.appendChild(photos); if(body) art.appendChild(body); }

    if(post.files && post.files.length){
      var files = el('section', 'post-files');
      files.appendChild(el('h4', null, '첨부파일'));
      var ul = el('ul');
      post.files.forEach(function(f, i){
        var li = el('li'), a = el('a');
        a.href = fileUrl(f.fileId);
        a.appendChild(el('span', 'nm', (i + 1) + '. ' + f.name));
        a.appendChild(el('span', 'sz', '(' + formatSize(f.size) + ')'));
        li.appendChild(a); ul.appendChild(li);
      });
      files.appendChild(ul);
      art.appendChild(files);
    }
    return art;
  }

  return { photoUrl:photoUrl, fileUrl:fileUrl, formatSize:formatSize, renderBody:renderBody, renderNotice:renderNotice };
})();
