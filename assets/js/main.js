/* 메인 페이지 전용 — 표지 슬라이드 / 워크숍 레일 / 한 번 스크롤 / 소식(공지 · 언론홍보 최신 3개) */

/* 표지 — 분야마다 한 장씩 무용 → 음악 → 미술 → 전통예술 순서로 넘어간다 (docs/decisions.md 2절).
   관리자 페이지에서 올린 사진(data/posts.json의 hero)이 있으면 그 사진, 없으면 기본 사진(main.css --img-hero-*),
   둘 다 없는 칸은 건너뛴다. 기본 사진이 올린 사진으로 바뀌며 깜박이지 않도록 #hero.wait 동안은 사진을 숨겨 두고
   목록을 받은 뒤(첫 장이 올린 사진이면 그 사진까지 받은 뒤, 최대 2초) 서서히 보인다. */
(function(){
  var hero=document.getElementById('hero');
  if(!hero) return;
  var SLOTS=['dance','music','art','trad'],
      dotsBox=hero.querySelector('.dots'), anchor=hero.querySelector('.hero-in'),
      slides=[], dots=[], idx=0, timer, shown=false;

  function hasDefault(k){
    return getComputedStyle(document.documentElement).getPropertyValue('--img-hero-'+k).indexOf('url(')>-1;
  }
  function photoWidth(){ return window.innerWidth*(window.devicePixelRatio||1)>1600 ? 2400 : 1600; }

  function build(custom){
    var list=SLOTS.filter(function(k){ return custom[k] || hasDefault(k); });
    if(!list.length) list=['music'];   /* 사진이 하나도 없으면 음악 칸의 바탕색만 */
    [].slice.call(hero.querySelectorAll('.slide')).forEach(function(s){ s.parentNode.removeChild(s); });
    dotsBox.textContent='';
    slides=list.map(function(k,i){
      var s=document.createElement('div');
      s.className='slide s-'+k+(i===0?' on':'');
      /* 파일ID는 관문이 만든 영숫자라 따옴표가 들어갈 일이 없고, photoUrl이 한 번 더 인코딩한다 */
      if(custom[k]) s.style.setProperty('--img-hero-'+k,'url("'+Board.photoUrl(custom[k].fileId,photoWidth())+'")');
      hero.insertBefore(s,anchor);   /* .slide가 #hero의 첫 div들이어야 main.css의 nth-of-type(확대 · 축소 번갈아)이 맞는다 */
      return s;
    });
    dots=list.map(function(_,i){
      var b=document.createElement('button');
      b.type='button'; b.setAttribute('aria-label',(i+1)+'번째 사진'); if(i===0) b.className='on';
      b.addEventListener('click',function(){go(i);play()});
      dotsBox.appendChild(b);
      return b;
    });
    var one=list.length<2;
    [dotsBox,hero.querySelector('.h-nav.prev'),hero.querySelector('.h-nav.next')].forEach(function(e){ e.hidden=one; });
    idx=0;
    return list[0];
  }
  function go(n){ if(!slides.length) return; idx=(n+slides.length)%slides.length;
    slides.forEach(function(s,i){s.classList.toggle('on',i===idx)});
    dots.forEach(function(d,i){d.classList.toggle('on',i===idx)}); }
  function play(){ clearInterval(timer); if(slides.length>1) timer=setInterval(function(){go(idx+1)},6000); }
  hero.querySelector('.h-nav.next').addEventListener('click',function(){go(idx+1);play()});
  hero.querySelector('.h-nav.prev').addEventListener('click',function(){go(idx-1);play()});

  /* 사진을 보이고 움직임을 켠다 (바로 켜면 첫 장은 움직임이 끝난 모습으로 시작함) */
  function show(){
    if(shown) return; shown=true;
    hero.classList.remove('wait');
    requestAnimationFrame(function(){requestAnimationFrame(function(){hero.classList.add('ready')})});
    play();
  }
  var started=false;
  function start(custom){
    if(started) return; started=true;
    var first=build(custom||{});
    if(!custom || !custom[first]) return show();
    var img=new Image(); img.onload=img.onerror=show; img.src=Board.photoUrl(custom[first].fileId,photoWidth());
    setTimeout(show,2000);
  }
  if(window.Board) Board.load().then(function(d){ start(d&&d.hero); });
  else start(null);
  setTimeout(function(){ start(null); },3000);   /* 목록이 너무 늦으면 기본 사진으로 (이미 시작했으면 무시) */
})();

(function(){
  var rail=document.getElementById('rail');
  if(!rail) return;
  /* 카드가 모두 보이면 좌우 화살표 숨김 */
  function syncArrows(){
    var over = rail.scrollWidth - rail.clientWidth > 4;
    var box = document.querySelector('.arrows');
    if(box) box.style.visibility = over ? 'visible' : 'hidden';
  }
  window.addEventListener('resize', syncArrows); setTimeout(syncArrows, 300);
  document.querySelectorAll('[data-rail]').forEach(function(b){
    b.addEventListener('click',function(){
      var step=rail.querySelector('.card').offsetWidth+20;
      rail.scrollBy({left:b.dataset.rail==='next'?step:-step,behavior:'smooth'});
    });
  });
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

/* 메인 맨 아래 공지사항 · 언론홍보 — data/posts.json의 앞쪽 3개씩(관문이 공지는 고정 글 → 최신순, 언론홍보는 최신순으로 정렬해 둠).
   본문·사진·첨부가 없는 공지는 누를 수 없고, 언론홍보는 기사가 새 탭으로 열린다. 불러오지 못해도 나머지 화면은 그대로. */
(function(){
  if(!window.Board) return;
  function fill(ul,list,make,d){
    if(!ul) return;
    if(!list.length){
      var li=document.createElement('li');li.className='bd-msg';
      li.textContent=d?Board.MSG.empty:Board.MSG.fail;ul.appendChild(li);return;
    }
    list.forEach(function(p){ ul.appendChild(make(p)); });
  }
  Board.load().then(function(d){
    fill(document.querySelector('[data-board="latest"]'),d?d.notices.slice(0,3):[],
      function(n){ return Board.noticeItem(n,'news.html#notice/'+encodeURIComponent(n.id),false); },d);
    fill(document.querySelector('[data-board="latest-press"]'),d?d.press.slice(0,3):[],Board.pressItem,d);
  });
})();
