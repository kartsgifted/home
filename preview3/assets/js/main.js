/* 메인 페이지 전용 — 표지 슬라이드(번호 밑줄 탭) / 표지 확대 / 한 번 스크롤 / 소식 카드(공지 · 언론홍보를 섞은 최신 8개) */

/* 표지 — 분야마다 한 장씩 음악 → 무용 → 전통예술 → 미술 순서로 넘어간다 (docs/decisions.md 2절, 분야 순서는 2026-10-21 피드백 WBS 9.10).
   관리자 페이지에서 올린 사진(data/posts.json의 hero)이 있으면 그 사진, 없으면 기본 사진(main.css --img-hero-*),
   둘 다 없는 칸은 건너뛴다. 기본 사진이 올린 사진으로 바뀌며 깜박이지 않도록 #hero.wait 동안은 사진을 숨겨 두고
   목록을 받은 뒤(첫 장이 올린 사진이면 그 사진까지 받은 뒤, 최대 2초) 서서히 보인다.
   동영상을 올린 칸(data/posts.json의 heroVideo, 2안)은 그 칸 사진(첫 장면)을 대기 사진으로 깔고 영상을 소리 없이 튼다 —
   영상은 영상 전용 저장소(MEDIA_BASE)에 있다. 드라이브 영상은 다른 사이트에서 재생되지 않음(2026-10-16 시험).
   넘김 단추는 표지 아래 번호 밑줄 탭(시안 3, .ntab) 하나다. 탭은 실제로 있는 칸만, 칸 순서대로.
   슬라이드는 .mn3-hz(스크롤하면 줄어드는 묶음) 안에 만든다 */
(function(){
  var hero=document.getElementById('hero');
  if(!hero) return;
  var SLOTS=['music','dance','trad','art'], NAMES={ dance:'무용', music:'음악', art:'미술', trad:'전통예술' },
      MEDIA_BASE='https://kartsproject.github.io/home-media/',   /* admin.js의 MEDIA_BASE와 맞출 것 */
      PHOTO_MS=6000, VIDEO_MIN=6, VIDEO_MAX=20, VIDEO_WAIT=3000,   /* 사진 칸 6초, 영상 칸은 영상 길이(6~20초), 3초 안에 시작 못 하면 사진처럼 */
      tabsBox=hero.querySelector('.h-tabs'), box=hero.querySelector('.mn3-hz'),
      still=window.matchMedia('(prefers-reduced-motion:reduce)'),
      slides=[], tabs=[], idx=0, timer, shown=false;

  function hasDefault(k){
    return getComputedStyle(document.documentElement).getPropertyValue('--img-hero-'+k).indexOf('url(')>-1;
  }
  function photoWidth(){ return window.innerWidth*(window.devicePixelRatio||1)>1600 ? 2400 : 1600; }

  /* 영상을 틀어도 되는 기기인가 — '움직임 줄이기', 데이터 절약, 느린 연결(2G · 3G)이면 대기 사진만 (2026-10-16 사용자 결정).
     아이폰 Safari는 연결 정보를 주지 않아 늘 튼다 */
  function canVideo(){
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return false;
    var c=navigator.connection;
    return !(c && (c.saveData || /2g|3g/.test(c.effectiveType||'')));
  }

  function build(custom,videos){
    var list=SLOTS.filter(function(k){ return custom[k] || hasDefault(k); }), useVideo=canVideo();
    if(!list.length) list=['music'];   /* 사진이 하나도 없으면 음악 칸의 바탕색만 */
    box.textContent='';
    tabsBox.textContent='';
    slides=list.map(function(k,i){
      var s=document.createElement('div');
      s.className='slide s-'+k+(i===0?' on':'');
      /* 파일ID는 관문이 만든 영숫자라 따옴표가 들어갈 일이 없고, photoUrl이 한 번 더 인코딩한다 */
      if(custom[k]) s.style.setProperty('--img-hero-'+k,'url("'+Board.photoUrl(custom[k].fileId,photoWidth())+'")');
      if(custom[k] && videos[k] && videos[k].src && useVideo){ s._video=videos[k]; s.classList.add('vd'); }   /* 영상은 차례가 가까워지면 부른다(prep) */
      else if(custom[k] && custom[k].fg) addDepth(s,custom[k]);
      box.appendChild(s);   /* .mn3-hz 안에는 .slide만 — main.css의 nth-of-type(확대 · 축소 번갈아)이 맞는다 */
      return s;
    });
    slides.forEach(place);
    /* 번호 밑줄 탭 — 「01 음악」. 누르면(키보드 포함) 그 칸으로 넘어가고 자동 넘김은 그 칸부터 이어진다.
       지금 칸은 aria-current, 칸이 하나면 숨긴다. 번호는 꾸밈이라 읽지 않는다 */
    tabs=list.map(function(k,i){
      var b=document.createElement('button'), n=document.createElement('em');
      b.type='button';
      n.textContent=(i<9?'0':'')+(i+1); n.setAttribute('aria-hidden','true');
      b.appendChild(n); b.appendChild(document.createTextNode(NAMES[k]));
      b.addEventListener('click',function(){go(i);play()});
      tabsBox.appendChild(b);
      return b;
    });
    tabsBox.hidden=list.length<2;
    idx=0;
    markTab();
    return list[0];
  }
  /* 2.5D 입체 효과 (관리자 페이지에서 켠 칸) — 누끼(인물만 오려 낸 PNG)를 사진 위에 겹쳐 배경보다 더 키운다(main.css .pz).
     누끼를 받지 못하면 그 칸은 보통의 확대 · 축소로 돌아간다 */
  function addDepth(s,ph){
    var fg=document.createElement('div'), url=Board.photoUrl(ph.fg.fileId,photoWidth()), img=new Image();
    fg.className='fg'; fg.style.backgroundImage='url("'+url+'")';
    s.appendChild(fg); s.classList.add('pz'); s._depth=ph;
    img.onerror=function(){ s.removeChild(fg); s.classList.remove('pz'); s._depth=null; };
    img.src=url;
  }
  /* 두 층이 인물 영역의 가운데(depth, 사진의 %)를 중심으로 커져야 커진 인물이 원래 윤곽을 덮는다.
     사진은 background-size:cover라 화면 크기 · 휴대폰 62% 중심에 따라 위치가 달라지므로 화면 좌표로 바꿔 둔다 */
  function place(s){
    var d=s._depth; if(!d || !d.w || !d.h || !d.depth) return;
    var W=hero.clientWidth, H=hero.clientHeight, sc=Math.max(W/d.w,H/d.h), dw=d.w*sc, dh=d.h*sc;
    var px=parseFloat(getComputedStyle(s.querySelector('.fg')).backgroundPositionX)/100;
    if(isNaN(px)) px=.5;
    s.style.setProperty('--org',((W-dw)*px+dw*d.depth.x/100).toFixed(1)+'px '+((H-dh)/2+dh*d.depth.y/100).toFixed(1)+'px');
  }
  window.addEventListener('resize',function(){ slides.forEach(place); markTab(); });

  /* 영상 칸의 <video>를 만든다(지금 칸과 다음 칸만 — 전송량 절약). 재생이 시작되면 대기 사진 위로 서서히 보이고,
     불러오지 못하면 영상을 빼고 사진 칸처럼 넘어간다 */
  function prep(s){
    if(!s || !s._video || s._v) return;
    var v=document.createElement('video');
    v.className='vid'; v.muted=true; v.playsInline=true; v.preload='auto';
    v.setAttribute('muted',''); v.setAttribute('playsinline',''); v.setAttribute('aria-hidden','true');
    v.addEventListener('playing',function(){ v.classList.add('on'); });
    v.addEventListener('error',function(){ if(v.parentNode) s.removeChild(v); s._v=null; s._video=null; });
    v.src=MEDIA_BASE+s._video.src;
    s.appendChild(v); s._v=v;
  }

  function markTab(){
    tabs.forEach(function(b,i){
      b.classList.toggle('on',i===idx);
      if(i===idx) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current');
    });
    /* 탭 줄이 넘쳐 가로로 넘기는 화면(휴대폰)에서는 지금 칸이 가운데 보이게 탭 줄만 민다(페이지는 그대로) */
    var b=tabs[idx];
    if(b && tabsBox.scrollWidth>tabsBox.clientWidth+1)
      tabsBox.scrollTo({ left:b.offsetLeft-(tabsBox.clientWidth-b.offsetWidth)/2, behavior:still.matches ? 'auto' : 'smooth' });
  }
  /* 지금 칸 밑줄이 다음 장까지 남은 시간(ms) 동안 차오른다(main.css .run). 0이면 차오르지 않고 흰 밑줄 그대로(칸이 하나 · 영상 시작 대기) */
  function fill(ms){
    tabs.forEach(function(b){ b.classList.remove('run'); });
    var b=tabs[idx];
    if(!b || !ms) return;
    b.style.setProperty('--t',Math.round(ms)+'ms');
    void b.offsetWidth;   /* 같은 칸이 다시 차오를 때 애니메이션을 처음부터 */
    b.classList.add('run');
  }
  function go(n){ if(!slides.length) return; idx=(n+slides.length)%slides.length;
    slides.forEach(function(s,i){s.classList.toggle('on',i===idx)});
    markTab(); }
  function next(){ go(idx+1); play(); }
  /* 지금 칸에 맞춰 다음으로 넘어갈 때를 정한다. 사진 칸 6초, 영상 칸은 처음부터 다시 틀고 영상 길이만큼(6~20초,
     6초보다 짧으면 반복). 영상이 3초 안에 시작하지 못하면 사진 칸처럼 모두 6초 */
  function play(){
    clearTimeout(timer); fill(0);
    var s=slides[idx], single=slides.length<2;
    if(!s) return;
    slides.forEach(function(o){ if(o!==s && o._v) o._v.pause(); });
    prep(s); if(!single) prep(slides[(idx+1)%slides.length]);
    var v=s._v;
    if(!v){ if(!single){ timer=setTimeout(next,PHOTO_MS); fill(PHOTO_MS); } return; }
    v.loop=single;
    try{ v.currentTime=0; }catch(e){}
    var pr=v.play(); if(pr && pr.catch) pr.catch(function(){});
    if(single) return;
    var onPlaying=function(){
      v.removeEventListener('playing',onPlaying);
      if(slides[idx]!==s || s._v!==v) return;
      var d=isFinite(v.duration) ? v.duration : VIDEO_MIN;
      if(d<VIDEO_MIN) v.loop=true;
      var ms=Math.min(VIDEO_MAX,Math.max(VIDEO_MIN,d))*1000;
      clearTimeout(timer); timer=setTimeout(next,ms); fill(ms);
    };
    v.addEventListener('playing',onPlaying);
    timer=setTimeout(function(){ v.removeEventListener('playing',onPlaying); timer=setTimeout(next,PHOTO_MS-VIDEO_WAIT); fill(PHOTO_MS-VIDEO_WAIT); },VIDEO_WAIT);
  }

  /* 사진을 보이고 움직임을 켠다 (바로 켜면 첫 장은 움직임이 끝난 모습으로 시작함) */
  function show(){
    if(shown) return; shown=true;
    hero.classList.remove('wait');
    requestAnimationFrame(function(){requestAnimationFrame(function(){hero.classList.add('ready')})});
    play();
  }
  var started=false;
  function start(custom,videos){
    if(started) return; started=true;
    var first=build(custom||{},videos||{});
    if(!custom || !custom[first]) return show();
    var urls=[custom[first].fileId].concat(custom[first].fg ? [custom[first].fg.fileId] : []), left=urls.length;
    urls.forEach(function(id){   /* 첫 장은 누끼까지 받은 뒤 보인다 (인물이 나중에 튀어나오지 않게) */
      var img=new Image(); img.onload=img.onerror=function(){ if(--left===0) show(); }; img.src=Board.photoUrl(id,photoWidth());
    });
    setTimeout(show,2000);
  }
  if(window.Board) Board.load().then(function(d){ start(d&&d.hero,d&&d.heroVideo); });
  else start(null);
  setTimeout(function(){ start(null); },3000);   /* 목록이 너무 늦으면 기본 사진으로 (이미 시작했으면 무시) */
})();

/* 표지 확대 (시안 3) — 표지 사진 묶음(.mn3-hz)이 맨 위에서 1.1, 표지를 다 지나면 1로 스크롤에 맞춰 줄어든다(main.css --hz).
   공통 [data-zoom]은 칸이 화면 아래에서 들어와 가운데에 올 때까지라 맨 위에 있는 표지에는 맞지 않아 따로 둔다. 움직임 줄이기면 main.css가 1로 고정 */
(function(){
  var hero=document.getElementById('hero'), box=hero && hero.querySelector('.mn3-hz'), wait=false;
  if(!box) return;
  function set(){
    wait=false;
    var h=hero.offsetHeight, p=h ? Math.min(1,Math.max(0,window.scrollY/h)) : 1;
    box.style.setProperty('--hz',(1.1-.1*p).toFixed(4));
  }
  window.addEventListener('scroll',function(){ if(!wait){ wait=true; requestAnimationFrame(set); } },{passive:true});
  window.addEventListener('resize',set);
  set();
})();

/* 표지 ↔ 본문만 한 번 스크롤로 이동 — 마우스 · 터치패드를 쓰는 창이면 크기와 상관없이 (휴대폰 · 태블릿 터치는 일반 스크롤).
   표지에서 아래로 = 본문 첫 칸(소개) 위로 — 표지는 화면 맨 위(0)부터 깔리고 머리(투명 → 어두운 바탕)는 그 위에 겹치므로 표지 높이만큼 내려간다.
   본문 첫 칸 위쪽(화면 높이 15% 안)에서 위로 = 표지 맨 위로. 그 밖의 본문은 일반 스크롤
   (2026-10-21 사용자 요청 — 예전에는 모든 칸을 한 번에 넘김) */
(function(){
  var hero=document.getElementById('hero'), next=hero && hero.nextElementSibling;
  while(next && next.tagName!=='SECTION') next=next.nextElementSibling;
  if(!hero || !next) return;

  var mouse=window.matchMedia('(pointer:fine)'),
      still=window.matchMedia('(prefers-reduced-motion:reduce)'),
      root=document.documentElement,
      busy=false, waitQuiet=false, lastWheel=0;

  function on(){ return mouse.matches && !still.matches && !document.body.classList.contains('menu-open'); }

  /* 이동할 위치를 정해 움직이면 true, 일반 스크롤에 맡기면 false */
  function step(dir){
    var y=window.scrollY, top=next.offsetTop, to;
    if(dir>0){
      if(y>=top-2) return false;                        /* 이미 본문 — 일반 스크롤 */
      to=top;
    }else{
      if(y<=2 || y>top+window.innerHeight*.15) return false;   /* 맨 위이거나 본문 깊은 곳 — 일반 스크롤 */
      to=0;
    }
    animate(to);
    return true;
  }

  function animate(to){
    var from=window.scrollY, d=to-from, t0=null, dur=700;
    busy=true; root.style.scrollBehavior='auto';
    requestAnimationFrame(function f(t){
      if(t0===null) t0=t;
      var p=Math.min(1,(t-t0)/dur), e=p<.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
      window.scrollTo(0,from+d*e);
      if(p<1) return requestAnimationFrame(f);
      root.style.scrollBehavior=''; busy=false; waitQuiet=true;
    });
  }

  window.addEventListener('wheel',function(e){
    if(!on() || e.ctrlKey || Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
    var now=Date.now(), gap=now-lastWheel; lastWheel=now;
    if(busy){ e.preventDefault(); return; }
    /* 이동 직후 트랙패드 관성으로 이어지는 휠은 무시하고, 한 번 멈춘 뒤의 휠부터 받는다 */
    if(waitQuiet){
      if(gap<200){ e.preventDefault(); return; }
      waitQuiet=false;
    }
    if(step(e.deltaY>0?1:-1)) e.preventDefault();
  },{passive:false});

  var KEYS={PageDown:1,PageUp:-1,ArrowDown:1,ArrowUp:-1};
  window.addEventListener('keydown',function(e){
    var dir=e.key===' ' ? (e.shiftKey?-1:1) : KEYS[e.key];
    if(!dir || !on() || e.altKey || e.ctrlKey || e.metaKey) return;
    if(e.target.closest && e.target.closest('input,textarea,select,button,[contenteditable]')) return;
    if(busy){ e.preventDefault(); return; }
    if(step(dir)) e.preventDefault();
  });
})();

/* 메인 소식 카드 — 공지사항 · 언론홍보를 섞어 날짜 최신순 8개 (시안 3). 같은 날이면 공지 먼저, 그 안에서는 posts.json 순서.
   카드는 board.js의 목록 줄을 그대로 쓴다(본문·사진·첨부가 없는 공지는 누를 수 없음, 기사는 새 탭 + 새 창 표시 — decisions.md 4절).
   맨 위에 금색 분류(「공지」, 언론홍보는 「언론홍보 · 언론사」)를 붙이고, 날짜는 YYYY-MM-DD 그대로 맨 아래. 운영진 입력값은 board.js가 textContent로 넣는다.
   카드 줄은 안쪽에서만 가로로 넘기고(.mn3-nw-vp), ← →는 한 장씩. 끝이면 그쪽 단추를 흐리게(aria-disabled). 불러오지 못해도 나머지 화면은 그대로. */
(function(){
  var ul=document.querySelector('[data-board="latest"]');
  if(!ul || !window.Board) return;
  var vp=ul.parentNode, arrs=[].slice.call(document.querySelectorAll('#news .mn3-arr')),
      still=window.matchMedia('(prefers-reduced-motion:reduce)');
  function msg(t){ var li=document.createElement('li'); li.className='bd-msg'; li.textContent=t; ul.appendChild(li); mark(); }
  function tag(list,kind){ return list.map(function(p,i){ return { p:p, kind:kind, i:i }; }); }
  /* 한 장 = 카드 폭 + 사이 */
  function step(){ var li=ul.querySelector('li'); return li ? li.offsetWidth+(parseFloat(getComputedStyle(ul).columnGap)||0) : vp.clientWidth; }
  function mark(){
    var x=vp.scrollLeft, max=vp.scrollWidth-vp.clientWidth;
    arrs.forEach(function(b){
      var end=b.getAttribute('data-dir')<0 ? x<=1 : x>=max-1;
      b.setAttribute('aria-disabled',end ? 'true' : 'false');
    });
  }
  arrs.forEach(function(b){
    b.addEventListener('click',function(){
      if(b.getAttribute('aria-disabled')==='true') return;
      vp.scrollBy({ left:step()*b.getAttribute('data-dir'), behavior:still.matches ? 'auto' : 'smooth' });
    });
  });
  vp.addEventListener('scroll',mark,{passive:true});
  window.addEventListener('resize',mark);
  mark();
  Board.load().then(function(d){
    if(!d) return msg(Board.MSG.fail);
    var list=tag(d.notices,'공지').concat(tag(d.press,'언론홍보')).sort(function(a,b){
      var x=String(a.p.date||''), y=String(b.p.date||'');
      return x!==y ? (x<y ? 1 : -1) : a.kind!==b.kind ? (a.kind==='공지' ? -1 : 1) : a.i-b.i;
    });
    if(!list.length) return msg('등록된 소식이 없습니다.');
    list.slice(0,8).forEach(function(x,i){
      var li=x.kind==='공지' ? Board.noticeItem(x.p,'news.html#notice/'+encodeURIComponent(x.p.id),false) : Board.pressItem(x.p),
          a=li.firstChild, k=document.createElement('span'), cat=a.querySelector('.cat');
      k.className='kind'; k.textContent=x.kind;
      if(cat){ k.appendChild(document.createTextNode(' · ')); k.appendChild(cat); }   /* 언론사는 분류 뒤로 */
      a.insertBefore(k,a.firstChild);
      li.setAttribute('data-rv',''); li.setAttribute('data-d',String(i%4));
      ul.appendChild(li);
    });
    if(window.__rvObserve) window.__rvObserve(ul);   /* 나중에 붙인 카드도 나타나기 효과 (common.js) */
    mark();
  });
})();
