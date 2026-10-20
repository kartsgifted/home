/* 메인 페이지 전용 — 표지 슬라이드(분야 탭) / 한 번 스크롤 / 소식(공지 · 언론홍보를 섞은 최신 4개) */

/* 표지 — 분야마다 한 장씩 무용 → 음악 → 미술 → 전통예술 순서로 넘어간다 (docs/decisions.md 2절).
   관리자 페이지에서 올린 사진(data/posts.json의 hero)이 있으면 그 사진, 없으면 기본 사진(main.css --img-hero-*),
   둘 다 없는 칸은 건너뛴다. 기본 사진이 올린 사진으로 바뀌며 깜박이지 않도록 #hero.wait 동안은 사진을 숨겨 두고
   목록을 받은 뒤(첫 장이 올린 사진이면 그 사진까지 받은 뒤, 최대 2초) 서서히 보인다.
   동영상을 올린 칸(data/posts.json의 heroVideo, 2안)은 그 칸 사진(첫 장면)을 대기 사진으로 깔고 영상을 소리 없이 튼다 —
   영상은 영상 전용 저장소(MEDIA_BASE)에 있다. 드라이브 영상은 다른 사이트에서 재생되지 않음(2026-10-16 시험).
   넘김 단추는 오른쪽 아래 분야 탭 하나다(4차 피드백 A안 — 원형 이전/다음 단추 · 점 · SCROLL 대신). 탭은 실제로 있는 칸만, 칸 순서대로 */
(function(){
  var hero=document.getElementById('hero');
  if(!hero) return;
  var SLOTS=['dance','music','art','trad'], NAMES={ dance:'무용', music:'음악', art:'미술', trad:'전통예술' },
      MEDIA_BASE='https://kartsgifted.github.io/home-media/',   /* admin.js의 MEDIA_BASE와 맞출 것 */
      PHOTO_MS=6000, VIDEO_MIN=6, VIDEO_MAX=20, VIDEO_WAIT=3000,   /* 사진 칸 6초, 영상 칸은 영상 길이(6~20초), 3초 안에 시작 못 하면 사진처럼 */
      tabsBox=hero.querySelector('.h-tabs'), anchor=hero.querySelector('.hero-in'),
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
    [].slice.call(hero.querySelectorAll('.slide')).forEach(function(s){ s.parentNode.removeChild(s); });
    tabsBox.textContent='';
    slides=list.map(function(k,i){
      var s=document.createElement('div');
      s.className='slide s-'+k+(i===0?' on':'');
      /* 파일ID는 관문이 만든 영숫자라 따옴표가 들어갈 일이 없고, photoUrl이 한 번 더 인코딩한다 */
      if(custom[k]) s.style.setProperty('--img-hero-'+k,'url("'+Board.photoUrl(custom[k].fileId,photoWidth())+'")');
      if(custom[k] && videos[k] && videos[k].src && useVideo){ s._video=videos[k]; s.classList.add('vd'); }   /* 영상은 차례가 가까워지면 부른다(prep) */
      else if(custom[k] && custom[k].fg) addDepth(s,custom[k]);
      hero.insertBefore(s,anchor);   /* .slide가 #hero의 첫 div들이어야 main.css의 nth-of-type(확대 · 축소 번갈아)이 맞는다 */
      s._tone=toneUrl(s,custom[k]);
      if(s._tone) toneImg(s._tone);   /* 머리 색을 잴 작은 사진을 미리 받아 둔다 */
      return s;
    });
    slides.forEach(place);
    /* 분야 탭 — 누르면 그 칸으로 넘어가고 자동 넘김은 그 칸부터 이어진다. 지금 칸은 aria-current, 칸이 하나면 숨긴다 */
    tabs=list.map(function(k,i){
      var b=document.createElement('button');
      b.type='button'; b.textContent=NAMES[k]; b.setAttribute('data-t',NAMES[k]);
      b.addEventListener('click',function(){go(i);play()});
      tabsBox.appendChild(b);
      return b;
    });
    tabsBox.hidden=list.length<2;
    idx=0;
    markTab();
    setTone();
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
  window.addEventListener('resize',function(){ slides.forEach(place); setTone(); });

  /* 머리 색 맞추기 (2안 WBS 8.13, 2026-10-16 차장님 피드백 · 사용자 결정) — 지금 보이는 칸의 사진에서 머리(메뉴 글자 · 메뉴 판)가
     놓이는 윗부분(PC는 메뉴 · 판 자리, 1100px 이하는 머리 높이 × 화면 전체 너비 — toneArea)의 밝기를 재어 #header에 data-tone="light"(밝음) · "dark"(어두움)를 붙인다.
     색은 common.css(세션 A)가 바꾼다. 사진 칸은 그 사진, 동영상 칸은 첫 장면 대기 사진, 2.5D 칸은 배경 사진,
     기본 사진 칸은 assets/img를 잰다. 잴 수 없으면(사진을 못 받음 · canvas 오류 · 사진 없는 칸) 속성을 빼서 지금 모양 그대로.
     밝기 = WCAG 상대 휘도(0~1)의 평균, 표지 덧칠(main.css .slide::after 위쪽 검정 30% → 높이 32%에서 0)을 반영.
     0.20 이상 light, 0.16 미만 dark, 그 사이는 지금 상태 그대로(경계 근처 사진 때문에 왔다 갔다 하지 않게).
     작은 사진(=w160)을 칸마다 한 번만 받아 두고, 넘길 때는 그 사진으로 바로 계산한다 — 표지 넘김을 늦추지 않는다 */
  var TONE_LIGHT=.20, TONE_DARK=.16, toneImgs={};
  function toneImg(url){
    if(!toneImgs[url]) toneImgs[url]=new Promise(function(ok){
      var im=new Image(); im.crossOrigin='anonymous';   /* 드라이브 사진(lh3)은 Access-Control-Allow-Origin: * 를 준다 */
      im.onload=function(){ ok(im); }; im.onerror=function(){ ok(null); };
      im.src=url;
    });
    return toneImgs[url];
  }
  /* 칸이 보여 주는 사진의 작은 주소 — 올린 사진은 드라이브 160px, 기본 사진은 main.css의 그 칸 사진 */
  function toneUrl(s,ph){
    if(ph) return Board.photoUrl(ph.fileId,160);
    var m=getComputedStyle(s,'::before').backgroundImage.match(/url\("?([^")]+)"?\)/);
    return m ? m[1] : null;
  }
  /* 재는 범위(표지 안 좌표) — PC(머리 메뉴가 보일 때, 1101px 이상)는 머리 메뉴 판이 놓이는 곳:
     가로 #gnb 왼쪽 − 56px ~ 오른쪽 + 56px(판 가로 범위, 세션 A와의 약속), 세로 0 ~ 머리 높이 + 판 높이(common.js의 --gnb-panel-h).
     1100px 이하는 머리 높이 × 화면 전체 너비 (2026-10-16 사용자 결정, WBS 8.16) */
  var PANEL_PAD=56;
  function toneArea(W,H){
    var hd=document.getElementById('header'), gnb=document.getElementById('gnb'), top=hd ? hd.offsetHeight : 0;
    if(!top) return null;
    var r=gnb && gnb.getBoundingClientRect();
    if(!r || !r.width) return { x0:0, x1:W, y1:Math.min(top,H) };
    var left=hero.getBoundingClientRect().left, panel=parseFloat(getComputedStyle(hd).getPropertyValue('--gnb-panel-h'))||0;
    return { x0:Math.max(0,r.left-PANEL_PAD-left), x1:Math.min(W,r.right+PANEL_PAD-left), y1:Math.min(H,top+panel) };
  }
  /* 화면에 보이는 대로(cover로 잘린 위치 · 휴대폰 62% 중심) 재는 범위를 48×16칸으로 줄여 잰다 */
  function brightness(s,im){
    var W=hero.clientWidth, H=hero.clientHeight, a=toneArea(W,H);
    if(!im || !im.naturalWidth || !W || !H || !a || a.x1<=a.x0) return null;
    var px=parseFloat(getComputedStyle(s,'::before').backgroundPositionX)/100; if(isNaN(px)) px=.5;
    var iw=im.naturalWidth, ih=im.naturalHeight, sc=Math.max(W/iw,H/ih), ox=(W-iw*sc)*px, oy=(H-ih*sc)/2;
    var cw=48, ch=16, c=document.createElement('canvas'), sum=0, d;
    c.width=cw; c.height=ch;
    try{
      var g=c.getContext('2d'); g.drawImage(im,(a.x0-ox)/sc,-oy/sc,(a.x1-a.x0)/sc,a.y1/sc,0,0,cw,ch);
      d=g.getImageData(0,0,cw,ch).data;
    }catch(e){ return null; }
    function lin(v){ v/=255; return v<=.04045 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); }
    for(var y=0;y<ch;y++){
      var shade=Math.max(0,.30*(1-(y+.5)/ch*a.y1/H/.32));
      for(var x=0;x<cw;x++){ var i=(y*cw+x)*4; sum+=(.2126*lin(d[i])+.7152*lin(d[i+1])+.0722*lin(d[i+2]))*(1-shade); }
    }
    return sum/(cw*ch);
  }
  function setTone(){
    var s=slides[idx], hd=document.getElementById('header');
    if(!s || !hd) return;
    if(!s._tone){ hd.removeAttribute('data-tone'); return; }
    toneImg(s._tone).then(function(im){
      if(slides[idx]!==s) return;   /* 그사이 다른 칸으로 넘어감 */
      var b=s._lum=brightness(s,im), cur=hd.getAttribute('data-tone');
      if(b==null){ hd.removeAttribute('data-tone'); return; }
      hd.setAttribute('data-tone', b>=TONE_LIGHT ? 'light' : b<TONE_DARK ? 'dark' : (cur || 'dark'));
    });
  }

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
  }
  function go(n){ if(!slides.length) return; idx=(n+slides.length)%slides.length;
    slides.forEach(function(s,i){s.classList.toggle('on',i===idx)});
    markTab();
    setTone(); }
  function next(){ go(idx+1); play(); }
  /* 지금 칸에 맞춰 다음으로 넘어갈 때를 정한다. 사진 칸 6초, 영상 칸은 처음부터 다시 틀고 영상 길이만큼(6~20초,
     6초보다 짧으면 반복). 영상이 3초 안에 시작하지 못하면 사진 칸처럼 모두 6초 */
  function play(){
    clearTimeout(timer);
    var s=slides[idx], single=slides.length<2;
    if(!s) return;
    slides.forEach(function(o){ if(o!==s && o._v) o._v.pause(); });
    prep(s); if(!single) prep(slides[(idx+1)%slides.length]);
    var v=s._v;
    if(!v){ if(!single) timer=setTimeout(next,PHOTO_MS); return; }
    v.loop=single;
    try{ v.currentTime=0; }catch(e){}
    var pr=v.play(); if(pr && pr.catch) pr.catch(function(){});
    if(single) return;
    var onPlaying=function(){
      v.removeEventListener('playing',onPlaying);
      if(slides[idx]!==s || s._v!==v) return;
      var d=isFinite(v.duration) ? v.duration : VIDEO_MIN;
      if(d<VIDEO_MIN) v.loop=true;
      clearTimeout(timer); timer=setTimeout(next,Math.min(VIDEO_MAX,Math.max(VIDEO_MIN,d))*1000);
    };
    v.addEventListener('playing',onPlaying);
    timer=setTimeout(function(){ v.removeEventListener('playing',onPlaying); timer=setTimeout(next,PHOTO_MS-VIDEO_WAIT); },VIDEO_WAIT);
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

/* 한 번 스크롤로 다음 칸 이동 — 마우스 · 터치패드를 쓰는 창이면 크기와 상관없이 (휴대폰 · 태블릿 터치는 일반 스크롤).
   화면보다 긴 칸은 안에서 일반 스크롤하다가 끝에 닿으면 다음 칸으로 넘어간다. */
(function(){
  var blocks=[].slice.call(document.querySelectorAll('body > section[id]'));
  var foot=document.getElementById('footer');
  if(!blocks.length) return;
  if(foot) blocks.push(foot);

  var mouse=window.matchMedia('(pointer:fine)'),
      still=window.matchMedia('(prefers-reduced-motion:reduce)'),
      root=document.documentElement,
      busy=false, waitQuiet=false, lastWheel=0;

  function on(){ return mouse.matches && !still.matches && !document.body.classList.contains('menu-open'); }

  /* 이동할 위치를 정해 움직이면 true, 일반 스크롤에 맡기면 false */
  function step(dir){
    var y=window.scrollY, vh=window.innerHeight, max=root.scrollHeight-vh, i=0, to;
    blocks.forEach(function(b,k){ if(b.offsetTop<=y+2) i=k; });
    /* 화면보다 10% 넘게 길어야 긴 칸으로 본다 (표지처럼 조금만 긴 칸은 한 칸으로 이동) */
    var b=blocks[i], top=b.offsetTop, h=b.offsetHeight, long=h>vh*1.1;
    if(dir>0){
      if(long && y+vh<top+h-2) return false;          /* 긴 칸의 아래가 남음 */
      if(i+1>=blocks.length) return false;
      to=Math.min(blocks[i+1].offsetTop,max);
    }else{
      if(long && y>top+2) return false;                /* 긴 칸의 위가 남음 */
      if(y>top+vh*.1){
        to=top;                                        /* 짧은 칸에서 많이 어긋나 있으면 칸 위로 맞춤 */
      }else{
        if(i===0) return false;
        var p=blocks[i-1];
        to=p.offsetHeight>vh*1.1 ? top-vh : p.offsetTop;   /* 긴 칸으로 올라가면 그 칸의 끝 화면부터 */
      }
    }
    if(Math.abs(to-y)<2) return false;
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

/* 메인 청록 띠의 소식 — 공지사항 · 언론홍보를 섞어 날짜 최신순 4개 (4차 피드백 B안). 같은 날이면 공지 먼저, 그 안에서는 posts.json 순서.
   줄은 board.js의 목록 줄을 그대로 쓴다(본문·사진·첨부가 없는 공지는 누를 수 없음, 기사는 새 탭, 언론사는 제목 앞 — decisions.md 4절).
   앞에 「공지」 · 「언론홍보」 이름표를 붙이고 날짜는 MM.DD로 줄인다. 불러오지 못해도 나머지 화면은 그대로. */
(function(){
  var ul=document.querySelector('[data-board="latest"]');
  if(!ul || !window.Board) return;
  function msg(t){ var li=document.createElement('li'); li.className='bd-msg'; li.textContent=t; ul.appendChild(li); }
  function tag(list,kind){ return list.map(function(p,i){ return { p:p, kind:kind, i:i }; }); }
  Board.load().then(function(d){
    if(!d) return msg(Board.MSG.fail);
    var list=tag(d.notices,'공지').concat(tag(d.press,'언론홍보')).sort(function(a,b){
      var x=String(a.p.date||''), y=String(b.p.date||'');
      return x!==y ? (x<y ? 1 : -1) : a.kind!==b.kind ? (a.kind==='공지' ? -1 : 1) : a.i-b.i;
    });
    if(!list.length) return msg('등록된 소식이 없습니다.');
    list.slice(0,4).forEach(function(x){
      var li=x.kind==='공지' ? Board.noticeItem(x.p,'news.html#notice/'+encodeURIComponent(x.p.id),false) : Board.pressItem(x.p),
          a=li.firstChild, k=document.createElement('span'), dt=a.querySelector('.d');
      k.className='kind'; k.textContent=x.kind;
      a.insertBefore(k,a.firstChild);
      dt.textContent=String(x.p.date||'').slice(5).replace('-','.');
      ul.appendChild(li);
    });
  });
})();
